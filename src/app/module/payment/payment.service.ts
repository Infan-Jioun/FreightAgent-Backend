import Stripe from "stripe";
import crypto from "crypto";
import { envConfig } from "../../../_config/env";
import { redis } from "../../../lib/redis";
import { prisma } from "../../../lib/prisma";
import AppError from "../../../errorHelper/AppError";
import status from "http-status";
import { invalidateShipmentCache } from "../../../utils/invalidateShipmentCache";
import { calculateFreightCost } from "./pricing.engine";
import { notifyCustomer, notifyAdmin, notifyAgent } from "../../../lib/socket";
import { generatePaymentReceiptPdf, generateWithdrawalSlipPdf } from "../../../utils/pdfGenerator";
import { uploadPdfToCloudinary } from "../../../utils/cloudinary";
import { sendEmail } from "../../../utils/email";
import { AuditAction, Prisma } from "../../../generated/prisma";

const getStripeClient = (): Stripe => {
    if (!envConfig.STRIPE_SECRET_KEY) {
        throw new AppError(
            status.INTERNAL_SERVER_ERROR,
            "Stripe is not configured. Please set STRIPE_SECRET_KEY in the environment file."
        );
    }
    return new Stripe(envConfig.STRIPE_SECRET_KEY, {
        apiVersion: "2025-02-24.acacia" as any,
    });
};

export interface CreatePaymentIntentResult {
    clientSecret: string | null;
    paymentIntentId: string;
    amountUSD: number;
    amountInCents: number;
    status: string;
}

export interface StripeWebhookResult {
    received: boolean;
    idempotent?: boolean;
    eventId: string;
    type: string;
}

export interface RefundPaymentResult {
    success: boolean;
    refundId: string;
    status: string | null;
    amountUSD: number;
}

export type ShipmentWithRelations = Prisma.ShipmentGetPayload<{
    include: {
        cost: true;
        user: true;
        agent: true;
    };
}>;

export interface VerifyPaymentStatusResult {
    success: boolean;
    paymentStatus: string;
    invoiceUrl?: string | null;
    shipment?: ShipmentWithRelations;
    message?: string;
    reason?: string;
    stripeStatus?: string;
}

/**
 * Creates or retrieves a Stripe PaymentIntent for a shipment.
 */
const createPaymentIntent = async (params: {
    shipmentId: string;
    userId: string;
    userRole: string;
    currency?: string;
}): Promise<CreatePaymentIntentResult> => {
    const stripe = getStripeClient();

    const shipment = await prisma.shipment.findUnique({
        where: { id: params.shipmentId },
        include: {
            cost: true,
            user: { select: { id: true, email: true, name: true } },
        },
    });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }

    // Role verification: Customers and Agents can only pay for their own shipments (or assigned shipments)
    if (params.userRole === "CUSTOMER" && shipment.userId !== params.userId) {
        throw new AppError(status.FORBIDDEN, "Access denied to initiate payment for this shipment");
    }

    if (
        params.userRole === "AGENT" &&
        shipment.userId !== params.userId &&
        shipment.agentId !== params.userId
    ) {
        throw new AppError(status.FORBIDDEN, "Access denied to initiate payment for this shipment");
    }

    if (shipment.paymentStatus === "PAID") {
        throw new AppError(status.BAD_REQUEST, "Shipment is already paid");
    }

    // Ensure cost breakdown exists; if missing, calculate and save
    let totalCostUSD = shipment.cost?.totalCost;
    if (!totalCostUSD) {
        const pricing = await calculateFreightCost({
            origin: shipment.origin,
            destination: shipment.destination,
            weightKg: shipment.weight,
            declaredCargoValueUSD: shipment.declaredCargoValue || 0,
        });

        const createdCost = await prisma.shipmentCost.create({
            data: {
                shipmentId: shipment.id,
                originHandling: pricing.breakdown.originHandling,
                oceanFreight: pricing.breakdown.oceanFreight,
                bafSurcharge: pricing.breakdown.bafSurcharge,
                thcOrigin: pricing.breakdown.thcOrigin,
                thcDestination: pricing.breakdown.thcDestination,
                transshipmentFee: pricing.breakdown.transshipmentFee,
                customsClearance: pricing.breakdown.customsClearance,
                customsDuty: pricing.breakdown.customsDuty,
                vat: pricing.breakdown.vat,
                destinationHandling: pricing.breakdown.destinationHandling,
                cargoInsurance: pricing.breakdown.cargoInsurance,
                lastMileDelivery: pricing.breakdown.lastMileDelivery,
                agencyFee: pricing.breakdown.agencyFee,
                platformFee: pricing.breakdown.platformFee,
                totalCost: pricing.totalUSD,
                currency: "USD",
                exchangeRate: 1.0,
                convertedTotal: pricing.totalUSD,
            },
        });
        totalCostUSD = createdCost.totalCost;
    }

    const amountInCents = Math.round(totalCostUSD * 100);

    // Reuse existing incomplete PaymentIntent if available
    if (shipment.stripePaymentIntentId) {
        try {
            const existingIntent = await stripe.paymentIntents.retrieve(
                shipment.stripePaymentIntentId
            );
            if (existingIntent.status === "requires_payment_method" || existingIntent.status === "requires_action") {
                return {
                    clientSecret: existingIntent.client_secret,
                    paymentIntentId: existingIntent.id,
                    amountUSD: totalCostUSD,
                    amountInCents,
                    status: existingIntent.status,
                };
            }
        } catch {
            // Intent expired or missing on Stripe, proceed to create new one
        }
    }

    const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
            shipmentId: shipment.id,
            trackingId: shipment.trackingId,
            userId: shipment.userId,
            customerEmail: shipment.user.email,
        },
        description: `Freight Payment for Shipment ${shipment.trackingId}`,
    });

    await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
            stripePaymentIntentId: paymentIntent.id,
            paymentStatus: "PROCESSING",
        },
    });

    await invalidateShipmentCache(shipment.id, shipment.userId, shipment.agentId || undefined);

    return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amountUSD: totalCostUSD,
        amountInCents,
        status: paymentIntent.status,
    };
};

/**
 * Common Settlement Core:
 * Marks shipment PAID, generates PDF invoice, uploads to Cloudinary,
 * logs status, updates Redis cache, sends socket events, and emails customer with PDF.
 */
export const settleSuccessfulPayment = async (params: {
    shipmentId: string;
    stripePaymentIntentId?: string;
    amountUSD?: number;
}): Promise<ShipmentWithRelations> => {
    const shipment = await prisma.shipment.findUnique({
        where: { id: params.shipmentId },
        include: {
            cost: true,
            user: true,
            agent: true,
        },
    });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }

    if (shipment.paymentStatus === "PAID" && shipment.invoiceUrl) {
        return shipment;
    }

    const totalUSD = params.amountUSD || shipment.cost?.totalCost || 0;
    const paidAt = new Date();

    // 1. Generate Vector PDF Invoice
    const pdfBuffer = generatePaymentReceiptPdf({
        shipment: {
            id: shipment.id,
            trackingId: shipment.trackingId,
            origin: shipment.origin,
            destination: shipment.destination,
            weight: shipment.weight,
            declaredCargoValue: shipment.declaredCargoValue,
            stripePaymentIntentId: params.stripePaymentIntentId || shipment.stripePaymentIntentId,
            paidAt,
        },
        cost: shipment.cost,
        user: {
            name: shipment.user.name,
            email: shipment.user.email,
            phone: shipment.user.phone,
            address: shipment.user.address,
        },
    });

    // 2. Direct streaming URL for 100% instant, reliable in-browser PDF viewing
    const invoiceUrl = `${envConfig.BACKEND_URL}/api/v1/payment/invoice-pdf/${shipment.trackingId}`;
    try {
        await uploadPdfToCloudinary(
            pdfBuffer,
            `invoice_${shipment.trackingId}`,
            "freightagent/invoices"
        );
    } catch (uploadErr) {
        console.error("[Payment] Failed to upload PDF invoice to Cloudinary backup:", uploadErr);
    }

    // 3. Update Database in a transaction
    const [updatedShipment] = await prisma.$transaction([
        prisma.shipment.update({
            where: { id: shipment.id },
            data: {
                paymentStatus: "PAID",
                paidAt,
                invoiceUrl: invoiceUrl || shipment.invoiceUrl,
                stripePaymentIntentId: params.stripePaymentIntentId || shipment.stripePaymentIntentId,
            },
            include: {
                cost: true,
                user: true,
                agent: true,
            },
        }),
        prisma.statusLog.create({
            data: {
                shipmentId: shipment.id,
                status: shipment.status,
                location: "Stripe Online Gateway",
                note: `Payment of $${totalUSD.toFixed(
                    2
                )} USD confirmed via Stripe. Receipt generated & stored in vault.`,
            },
        }),
    ]);

    // 4. Invalidate Cache
    await invalidateShipmentCache(
        shipment.id,
        shipment.userId,
        shipment.agentId || undefined
    );

    // 5. Socket Notifications
    notifyCustomer(shipment.userId, {
        type: "PAYMENT_SUCCESS",
        shipmentId: shipment.id,
        trackingId: shipment.trackingId,
        amount: totalUSD,
        currency: "USD",
        invoiceUrl: invoiceUrl || undefined,
        message: "Your freight payment was successfully processed.",
    });

    if (shipment.agentId) {
        notifyAgent(shipment.agentId, {
            type: "SHIPMENT_PAID",
            shipmentId: shipment.id,
            trackingId: shipment.trackingId,
            agencyFee: shipment.cost?.agencyFee || 0,
            message: `Assigned shipment ${shipment.trackingId} has been marked as PAID. Agency commission earned.`,
        });
    }

    notifyAdmin({
        type: "PAYMENT_RECEIVED",
        shipmentId: shipment.id,
        trackingId: shipment.trackingId,
        amount: totalUSD,
        message: `Payment received for shipment ${shipment.trackingId}.`,
    });

    // 6. Send Email with PDF Attachment & Download link
    try {
        await sendEmail({
            to: shipment.user.email,
            subject: `Payment Confirmed: Shipment ${shipment.trackingId}`,
            templateName: "paymentSuccess",
            templateData: {
                customerName: shipment.user.name,
                trackingId: shipment.trackingId,
                origin: shipment.origin,
                destination: shipment.destination,
                weight: shipment.weight,
                amount: totalUSD,
                currency: "USD",
                invoiceUrl: invoiceUrl || "",
                paidAt: paidAt.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                }),
            },
            attachments: [
                {
                    fileName: `Receipt_${shipment.trackingId}.pdf`,
                    content: pdfBuffer,
                    contentType: "application/pdf",
                },
            ],
        });
    } catch (mailErr) {
        console.error("[Payment] Failed to send payment confirmation email:", mailErr);
    }

    return updatedShipment;
};

/**
 * Handles payment failure / cancellation:
 * Updates DB, creates status log, notifies via socket, and sends failure email to customer.
 */
export const handlePaymentFailure = async (params: {
    shipmentId: string;
    reason?: string;
}): Promise<void> => {
    const shipment = await prisma.shipment.findUnique({
        where: { id: params.shipmentId },
        include: { user: true },
    });

    if (!shipment) return;

    await prisma.$transaction([
        prisma.shipment.update({
            where: { id: shipment.id },
            data: { paymentStatus: "FAILED" },
        }),
        prisma.statusLog.create({
            data: {
                shipmentId: shipment.id,
                status: shipment.status,
                location: "Stripe Online Gateway",
                note: `Payment attempt failed or was cancelled. Reason: ${params.reason || "Declined / Cancelled"}`,
            },
        }),
    ]);

    await invalidateShipmentCache(shipment.id, shipment.userId, shipment.agentId || undefined);

    notifyCustomer(shipment.userId, {
        type: "PAYMENT_FAILED",
        shipmentId: shipment.id,
        trackingId: shipment.trackingId,
        error: params.reason,
        message: "Your payment attempt failed. Please try another payment method.",
    });

    try {
        await sendEmail({
            to: shipment.user.email,
            subject: `Payment Alert: Shipment ${shipment.trackingId}`,
            templateName: "paymentFailed",
            templateData: {
                customerName: shipment.user.name,
                trackingId: shipment.trackingId,
                origin: shipment.origin,
                destination: shipment.destination,
                reason: params.reason || "Payment was declined or cancelled.",
            },
        });
    } catch (mailErr) {
        console.error("[Payment] Failed to send payment failure email:", mailErr);
    }
};

/**
 * Direct Client Verification Endpoint:
 * Allows frontend to verify Stripe payment state immediately after stripe.confirmPayment()
 */
const verifyPaymentStatus = async (params: {
    shipmentId: string;
    userId: string;
    userRole: string;
}): Promise<VerifyPaymentStatusResult> => {
    const stripe = getStripeClient();

    const shipment = await prisma.shipment.findUnique({
        where: { id: params.shipmentId },
        include: {
            cost: true,
            user: true,
            agent: true,
        },
    });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }

    // Role verification
    if (params.userRole === "CUSTOMER" && shipment.userId !== params.userId) {
        throw new AppError(status.FORBIDDEN, "Access denied to verify payment for this shipment");
    }

    if (
        params.userRole === "AGENT" &&
        shipment.userId !== params.userId &&
        shipment.agentId !== params.userId
    ) {
        throw new AppError(status.FORBIDDEN, "Access denied to verify payment for this shipment");
    }

    if (shipment.paymentStatus === "PAID") {
        return {
            success: true,
            paymentStatus: "PAID",
            invoiceUrl: shipment.invoiceUrl,
            shipment,
        };
    }

    if (!shipment.stripePaymentIntentId) {
        return {
            success: false,
            paymentStatus: shipment.paymentStatus,
            message: "No active payment intent found for this shipment",
        };
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(shipment.stripePaymentIntentId);

    if (paymentIntent.status === "succeeded") {
        const updated = await settleSuccessfulPayment({
            shipmentId: shipment.id,
            stripePaymentIntentId: paymentIntent.id,
            amountUSD: paymentIntent.amount / 100,
        });

        return {
            success: true,
            paymentStatus: "PAID",
            invoiceUrl: updated.invoiceUrl,
            shipment: updated,
        };
    } else if (
        paymentIntent.status === "canceled" ||
        (paymentIntent.status === "requires_payment_method" && paymentIntent.last_payment_error)
    ) {
        await handlePaymentFailure({
            shipmentId: shipment.id,
            reason: paymentIntent.last_payment_error?.message || "Payment intent was cancelled or failed.",
        });

        return {
            success: false,
            paymentStatus: "FAILED",
            ...(paymentIntent.last_payment_error?.message !== undefined && {
                reason: paymentIntent.last_payment_error.message,
            }),
        };
    }

    return {
        success: false,
        paymentStatus: shipment.paymentStatus,
        stripeStatus: paymentIntent.status as string,
    };
};

/**
 * Handles incoming raw Stripe Webhooks with:
 * 1. Cryptographic signature verification
 * 2. Strict Redis idempotency key check (stripe:event:{id})
 * 3. 24-hour replay attack protection
 */
const handleStripeWebhook = async (
    rawBody: Buffer,
    signature: string
): Promise<StripeWebhookResult> => {
    const stripe = getStripeClient();

    if (!envConfig.STRIPE_WEBHOOK_SECRET) {
        throw new AppError(
            status.INTERNAL_SERVER_ERROR,
            "STRIPE_WEBHOOK_SECRET is not configured in .env"
        );
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            envConfig.STRIPE_WEBHOOK_SECRET
        );
    } catch (err: any) {
        console.error("⚠️ Stripe Webhook signature verification failed:", err.message);
        throw new AppError(status.BAD_REQUEST, `Webhook Signature Verification Failed: ${err.message}`);
    }

    // ─── IDEMPOTENCY & REPLAY ATTACK CHECK ────────────────────────────────
    const idempotencyKey = `stripe:event:${event.id}`;
    const alreadyProcessed = await redis.get(idempotencyKey);

    if (alreadyProcessed) {
        console.info(
            `[Stripe Webhook] Duplicate detected! Event ${event.id} (${event.type}) was already processed. Acknowledging with HTTP 200.`
        );
        return {
            received: true,
            idempotent: true,
            eventId: event.id,
            type: event.type,
        };
    }

    // Lock event for 24 hours (86,400s) to prevent double-charging or replay
    await redis.set(
        idempotencyKey,
        JSON.stringify({
            type: event.type,
            processedAt: new Date().toISOString(),
        }),
        { ex: 86400 }
    );

    // ─── PROCESS SUPPORTED EVENTS ─────────────────────────────────────────
    switch (event.type) {
        case "payment_intent.succeeded": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const shipmentId = paymentIntent.metadata?.shipmentId;

            if (shipmentId) {
                await settleSuccessfulPayment({
                    shipmentId,
                    stripePaymentIntentId: paymentIntent.id,
                    amountUSD: paymentIntent.amount / 100,
                });
            }
            break;
        }

        case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const shipmentId = paymentIntent.metadata?.shipmentId;
            const failureReason =
                paymentIntent.last_payment_error?.message || "Payment processing failed";

            if (shipmentId) {
                await handlePaymentFailure({
                    shipmentId,
                    reason: failureReason,
                });
            }
            break;
        }

        case "charge.refunded": {
            const charge = event.data.object as Stripe.Charge;
            const paymentIntentId =
                typeof charge.payment_intent === "string"
                    ? charge.payment_intent
                    : charge.payment_intent?.id;

            if (paymentIntentId) {
                const shipment = await prisma.shipment.findFirst({
                    where: { stripePaymentIntentId: paymentIntentId },
                });

                if (shipment) {
                    await prisma.shipment.update({
                        where: { id: shipment.id },
                        data: { paymentStatus: "REFUNDED" },
                    });

                    await invalidateShipmentCache(
                        shipment.id,
                        shipment.userId,
                        shipment.agentId || undefined
                    );
                }
            }
            break;
        }

        default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return { received: true, eventId: event.id, type: event.type };
};

/**
 * Initiates an administrative refund via Stripe and records in AdminAuditLog
 */
const refundPayment = async (params: {
    shipmentId: string;
    reason: string;
    adminId: string;
    ipAddress?: string;
    userAgent?: string;
}): Promise<RefundPaymentResult> => {
    const stripe = getStripeClient();

    const shipment = await prisma.shipment.findUnique({
        where: { id: params.shipmentId },
        include: { cost: true, user: true },
    });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }

    if (shipment.paymentStatus !== "PAID") {
        throw new AppError(status.BAD_REQUEST, "Cannot refund an unpaid shipment");
    }

    if (!shipment.stripePaymentIntentId) {
        throw new AppError(status.BAD_REQUEST, "No Stripe PaymentIntent associated with this shipment");
    }

    // Call Stripe Refund API
    const refund = await stripe.refunds.create({
        payment_intent: shipment.stripePaymentIntentId,
        reason: "requested_by_customer",
        metadata: {
            shipmentId: shipment.id,
            refundedByAdminId: params.adminId,
            reason: params.reason,
        },
    });

    await prisma.$transaction([
        prisma.shipment.update({
            where: { id: shipment.id },
            data: {
                paymentStatus: "REFUNDED",
                stripeRefundId: refund.id,
            },
        }),
        prisma.adminAuditLog.create({
            data: {
                adminId: params.adminId,
                action: "PROCESS_REFUND",
                targetType: "Shipment",
                targetId: shipment.id,
                details: `Refunded $${(refund.amount / 100).toFixed(2)} USD for shipment ${
                    shipment.trackingId
                }. Reason: ${params.reason}. Stripe Refund ID: ${refund.id}`,
                ipAddress: params.ipAddress ?? null,
                userAgent: params.userAgent ?? null,
            },
        }),
        prisma.statusLog.create({
            data: {
                shipmentId: shipment.id,
                status: shipment.status,
                location: "Stripe Online Gateway",
                updateBy: params.adminId,
                note: `Refund of $${(refund.amount / 100).toFixed(2)} USD processed. Refund ID: ${
                    refund.id
                }`,
            },
        }),
    ]);

    await invalidateShipmentCache(shipment.id, shipment.userId, shipment.agentId || undefined);

    notifyCustomer(shipment.userId, {
        type: "PAYMENT_REFUNDED",
        shipmentId: shipment.id,
        trackingId: shipment.trackingId,
        refundId: refund.id,
        amount: refund.amount / 100,
        message: "Your payment has been refunded to your original payment method.",
    });

    return {
        success: true,
        refundId: refund.id,
        status: refund.status as string,
        amountUSD: refund.amount / 100,
    };
};

/**
 * Admin Financial Stats:
 * Total shipments, paid shipments, gross revenue, platform earnings,
 * agent liabilities, completed payouts, and recent transactions.
 */
const getAdminPaymentStats = async () => {
    const [
        totalShipments,
        paidShipments,
        costAggregations,
        withdrawalAggregations,
        pendingWithdrawals,
        recentPaidShipments,
    ] = await Promise.all([
        prisma.shipment.count(),
        prisma.shipment.count({ where: { paymentStatus: "PAID" } }),
        prisma.shipmentCost.aggregate({
            _sum: {
                totalCost: true,
                platformFee: true,
                agencyFee: true,
            },
            where: {
                shipment: {
                    paymentStatus: "PAID",
                },
            },
        }),
        prisma.withdrawal.aggregate({
            _sum: { amount: true },
            where: { status: "COMPLETED" },
        }),
        prisma.withdrawal.aggregate({
            _sum: { amount: true },
            where: { status: "PENDING" },
        }),
        prisma.shipment.findMany({
            where: { paymentStatus: "PAID" },
            select: {
                id: true,
                trackingId: true,
                origin: true,
                destination: true,
                paidAt: true,
                invoiceUrl: true,
                cost: {
                    select: {
                        totalCost: true,
                        platformFee: true,
                        agencyFee: true,
                        currency: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                agent: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: { paidAt: "desc" },
            take: 15,
        }),
    ]);

    const totalRevenueUSD = Number((costAggregations._sum.totalCost || 0).toFixed(2));
    const totalPlatformFeeUSD = Number((costAggregations._sum.platformFee || 0).toFixed(2));
    const totalAgencyFeeUSD = Number((costAggregations._sum.agencyFee || 0).toFixed(2));
    const totalWithdrawalsPaidUSD = Number((withdrawalAggregations._sum.amount || 0).toFixed(2));
    const totalWithdrawalsPendingUSD = Number((pendingWithdrawals._sum.amount || 0).toFixed(2));
    const netPlatformBalanceUSD = Number((totalRevenueUSD - totalWithdrawalsPaidUSD).toFixed(2));

    return {
        totalShipments,
        paidShipments,
        financialOverview: {
            totalRevenueUSD,
            totalPlatformFeeUSD,
            totalAgencyFeeUSD,
            totalWithdrawalsPaidUSD,
            totalWithdrawalsPendingUSD,
            netPlatformBalanceUSD,
        },
        recentTransactions: recentPaidShipments,
    };
};

/**
 * Admin View: All Agent Withdrawals
 */
const getAdminWithdrawals = async (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
            include: {
                agent: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        assignedArea: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.withdrawal.count(),
    ]);

    return {
        withdrawals: withdrawals.map((w) => ({
            ...w,
            voucherNumber: w.withdrawalNumber,
        })),
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
    };
};

/**
 * Agent View: Strictly secure personal earnings & available balance
 */
const getAgentEarnings = async (agentId: string) => {
    const [paidShipments, completedWithdrawals, pendingWithdrawals] = await Promise.all([
        prisma.shipment.findMany({
            where: {
                agentId: agentId,
                paymentStatus: "PAID",
            },
            select: {
                id: true,
                trackingId: true,
                origin: true,
                destination: true,
                paidAt: true,
                invoiceUrl: true,
                cost: {
                    select: {
                        totalCost: true,
                        agencyFee: true,
                        currency: true,
                    },
                },
            },
            orderBy: { paidAt: "desc" },
        }),
        prisma.withdrawal.aggregate({
            _sum: { amount: true },
            where: {
                agentId: agentId,
                status: "COMPLETED",
            },
        }),
        prisma.withdrawal.aggregate({
            _sum: { amount: true },
            where: {
                agentId: agentId,
                status: "PENDING",
            },
        }),
    ]);

    const totalEarnedUSD = paidShipments.reduce(
        (sum, s) => sum + (s.cost?.agencyFee || 0),
        0
    );
    const totalWithdrawnUSD = completedWithdrawals._sum.amount || 0;
    const pendingWithdrawnUSD = pendingWithdrawals._sum.amount || 0;
    const availableBalanceUSD = Math.max(
        0,
        Number((totalEarnedUSD - totalWithdrawnUSD - pendingWithdrawnUSD).toFixed(2))
    );

    return {
        agentId,
        summary: {
            totalEarnedUSD: Number(totalEarnedUSD.toFixed(2)),
            totalWithdrawnUSD: Number(totalWithdrawnUSD.toFixed(2)),
            pendingWithdrawnUSD: Number(pendingWithdrawnUSD.toFixed(2)),
            availableBalanceUSD,
            paidShipmentsCount: paidShipments.length,
        },
        shipmentEarnings: paidShipments,
    };
};

/**
 * Agent Withdrawal Request & Execution:
 * Validates available balance, generates PDF withdrawal voucher,
 * uploads to Cloudinary, creates withdrawal record, and audits action.
 */
const requestAgentWithdrawal = async (params: {
    agentId: string;
    amount: number;
    bankInfo?: string;
    note?: string;
    ipAddress?: string;
    userAgent?: string;
}) => {
    if (!params.amount || params.amount <= 0) {
        throw new AppError(status.BAD_REQUEST, "Withdrawal amount must be greater than zero");
    }

    const agent = await prisma.user.findUnique({
        where: { id: params.agentId },
    });

    if (!agent) {
        throw new AppError(status.NOT_FOUND, "Agent not found");
    }

    // Compute balance securely
    const earnings = await getAgentEarnings(params.agentId);
    const availableBalance = earnings.summary.availableBalanceUSD;

    if (params.amount > availableBalance) {
        throw new AppError(
            status.BAD_REQUEST,
            `Insufficient available balance. You currently have $${availableBalance.toFixed(
                2
            )} USD available to withdraw.`
        );
    }

    const remainingBalance = Number((availableBalance - params.amount).toFixed(2));
    const withdrawalNumber = `WD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // Generate Vector PDF Slip
    const withdrawalDate = new Date();
    const pdfBuffer = generateWithdrawalSlipPdf({
        agent: {
            id: agent.id,
            name: agent.name,
            email: agent.email,
            phone: agent.phone,
            assignedArea: agent.assignedArea,
        },
        withdrawal: {
            id: withdrawalNumber,
            withdrawalNumber,
            amount: params.amount,
            currency: "USD",
            status: "COMPLETED",
            bankInfo: params.bankInfo ?? null,
            note: params.note ?? null,
            createdAt: withdrawalDate,
        },
        balanceBefore: availableBalance,
        remainingBalance,
    });

    // Direct streaming URL for 100% instant, reliable in-browser PDF viewing
    const receiptUrl = `${envConfig.BACKEND_URL}/api/v1/payment/withdrawal-slip-pdf/${withdrawalNumber}`;
    try {
        await uploadPdfToCloudinary(
            pdfBuffer,
            `withdrawal_${withdrawalNumber}`,
            "freightagent/withdrawals"
        );
    } catch (uploadErr) {
        console.error("[Payment] Failed to upload withdrawal slip to Cloudinary backup:", uploadErr);
    }

    // Create Withdrawal & Audit Log in database
    const [withdrawal] = await prisma.$transaction([
        prisma.withdrawal.create({
            data: {
                withdrawalNumber,
                agentId: agent.id,
                amount: params.amount,
                currency: "USD",
                status: "COMPLETED",
                bankInfo: params.bankInfo || null,
                receiptUrl: receiptUrl || null,
                note: params.note || null,
            },
        }),
        prisma.adminAuditLog.create({
            data: {
                adminId: agent.id,
                action: AuditAction.AGENT_WITHDRAWAL,
                targetType: "Withdrawal",
                targetId: withdrawalNumber,
                details: `Agent ${agent.name} withdrew $${params.amount.toFixed(
                    2
                )} USD. Voucher: ${withdrawalNumber}`,
                ipAddress: params.ipAddress ?? null,
                userAgent: params.userAgent ?? null,
            },
        }),
    ]);

    // Socket Notifications
    notifyAgent(agent.id, {
        type: "WITHDRAWAL_PROCESSED",
        amount: params.amount,
        withdrawalNumber,
        receiptUrl: receiptUrl || undefined,
        remainingBalance,
        message: `Your withdrawal of $${params.amount.toFixed(2)} USD was successfully processed.`,
    });

    notifyAdmin({
        type: "AGENT_WITHDRAWAL_PROCESSED",
        agentName: agent.name,
        amount: params.amount,
        withdrawalNumber,
        receiptUrl: receiptUrl || undefined,
        message: `Agent ${agent.name} withdrew $${params.amount.toFixed(2)} USD.`,
    });

    return {
        withdrawal: {
            ...withdrawal,
            voucherNumber: withdrawal.withdrawalNumber,
        },
        receiptUrl,
        balanceBefore: availableBalance,
        remainingBalance,
    };
};

/**
 * Agent View: History of their own withdrawals with PDF slips
 */
const getAgentWithdrawals = async (agentId: string, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
            where: { agentId },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.withdrawal.count({ where: { agentId } }),
    ]);

    return {
        withdrawals: withdrawals.map((w) => ({
            ...w,
            voucherNumber: w.withdrawalNumber,
        })),
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
    };
};

/**
 * Generates and returns the PDF buffer for direct browser streaming
 */
const getShipmentInvoicePdfBuffer = async (identifier: string): Promise<{ buffer: Buffer; trackingId: string }> => {
    const shipment = await prisma.shipment.findFirst({
        where: {
            OR: [
                { id: identifier },
                { trackingId: identifier },
            ],
        },
        include: {
            cost: true,
            user: true,
        },
    });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }

    const buffer = generatePaymentReceiptPdf({
        shipment: {
            id: shipment.id,
            trackingId: shipment.trackingId,
            origin: shipment.origin,
            destination: shipment.destination,
            weight: shipment.weight,
            declaredCargoValue: shipment.declaredCargoValue,
            stripePaymentIntentId: shipment.stripePaymentIntentId,
            paidAt: shipment.paidAt || shipment.createdAt,
        },
        cost: shipment.cost,
        user: {
            name: shipment.user.name,
            email: shipment.user.email,
            phone: shipment.user.phone,
            address: shipment.user.address,
        },
    });

    return { buffer, trackingId: shipment.trackingId };
};

/**
 * Generates and returns the Withdrawal Slip PDF buffer for direct browser streaming
 */
const getWithdrawalSlipPdfBuffer = async (identifier: string): Promise<{ buffer: Buffer; withdrawalNumber: string }> => {
    // Resilient extraction: if identifier contains "WD-XXXX" from filename, extract it
    const wdMatch = identifier.match(/WD-[A-Za-z0-9]+/i);
    const voucherQuery = wdMatch ? wdMatch[0].toUpperCase() : identifier;

    const withdrawal = await prisma.withdrawal.findFirst({
        where: {
            OR: [
                { id: identifier },
                { withdrawalNumber: identifier },
                { withdrawalNumber: voucherQuery },
            ],
        },
        include: {
            agent: true,
        },
    });

    if (!withdrawal) {
        throw new AppError(status.NOT_FOUND, "Withdrawal voucher not found");
    }

    const earnings = await getAgentEarnings(withdrawal.agentId);

    const buffer = generateWithdrawalSlipPdf({
        agent: {
            id: withdrawal.agent.id,
            name: withdrawal.agent.name,
            email: withdrawal.agent.email,
            phone: withdrawal.agent.phone,
            assignedArea: withdrawal.agent.assignedArea,
        },
        withdrawal: {
            id: withdrawal.id,
            withdrawalNumber: withdrawal.withdrawalNumber,
            amount: withdrawal.amount,
            currency: withdrawal.currency,
            status: withdrawal.status,
            bankInfo: withdrawal.bankInfo,
            note: withdrawal.note,
            createdAt: withdrawal.createdAt,
        },
        balanceBefore: earnings.summary.availableBalanceUSD + withdrawal.amount,
        remainingBalance: earnings.summary.availableBalanceUSD,
    });

    return { buffer, withdrawalNumber: withdrawal.withdrawalNumber };
};

export const paymentService = {
    createPaymentIntent,
    settleSuccessfulPayment,
    handlePaymentFailure,
    verifyPaymentStatus,
    handleStripeWebhook,
    refundPayment,
    getAdminPaymentStats,
    getAdminWithdrawals,
    getAgentEarnings,
    requestAgentWithdrawal,
    getAgentWithdrawals,
    getShipmentInvoicePdfBuffer,
    getWithdrawalSlipPdfBuffer,
};
