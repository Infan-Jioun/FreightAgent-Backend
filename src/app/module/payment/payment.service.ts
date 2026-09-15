import Stripe from "stripe";
import { envConfig } from "../../../_config/env";
import { redis } from "../../../lib/redis";
import { prisma } from "../../../lib/prisma";
import AppError from "../../../errorHelper/AppError";
import status from "http-status";
import { invalidateShipmentCache } from "../../../utils/invalidateShipmentCache";
import { calculateFreightCost } from "./pricing.engine";
import { notifyCustomer, notifyAdmin, notifyAgent } from "../../../lib/socket";

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

export interface IPaymentService {
    createPaymentIntent: (params: {
        shipmentId: string;
        userId: string;
        userRole: string;
        currency?: string;
    }) => Promise<CreatePaymentIntentResult>;
    handleStripeWebhook: (rawBody: Buffer, signature: string) => Promise<StripeWebhookResult>;
    refundPayment: (params: {
        shipmentId: string;
        reason: string;
        adminId: string;
        ipAddress?: string;
        userAgent?: string;
    }) => Promise<RefundPaymentResult>;
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
                const shipment = await prisma.shipment.findUnique({
                    where: { id: shipmentId },
                });

                if (shipment) {
                    await prisma.$transaction([
                        prisma.shipment.update({
                            where: { id: shipmentId },
                            data: {
                                paymentStatus: "PAID",
                                paidAt: new Date(),
                            },
                        }),
                        prisma.statusLog.create({
                            data: {
                                shipmentId,
                                status: shipment.status,
                                location: "Stripe Online Gateway",
                                note: `Payment of $${(paymentIntent.amount / 100).toFixed(
                                    2
                                )} USD confirmed via Stripe (Intent: ${paymentIntent.id}).`,
                            },
                        }),
                    ]);

                    await invalidateShipmentCache(
                        shipmentId,
                        shipment.userId,
                        shipment.agentId || undefined
                    );

                    // Socket notifications
                    notifyCustomer(shipment.userId, {
                        type: "PAYMENT_SUCCESS",
                        shipmentId,
                        trackingId: shipment.trackingId,
                        amount: paymentIntent.amount / 100,
                        currency: "USD",
                        message: "Your freight payment was successfully processed.",
                    });

                    if (shipment.agentId) {
                        notifyAgent(shipment.agentId, {
                            type: "SHIPMENT_PAID",
                            shipmentId,
                            trackingId: shipment.trackingId,
                            message: "Assigned shipment has been marked as PAID.",
                        });
                    }

                    notifyAdmin({
                        type: "PAYMENT_RECEIVED",
                        shipmentId,
                        trackingId: shipment.trackingId,
                        amount: paymentIntent.amount / 100,
                        message: `Payment received for shipment ${shipment.trackingId}.`,
                    });
                }
            }
            break;
        }

        case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const shipmentId = paymentIntent.metadata?.shipmentId;
            const failureReason =
                paymentIntent.last_payment_error?.message || "Payment processing failed";

            if (shipmentId) {
                const shipment = await prisma.shipment.findUnique({
                    where: { id: shipmentId },
                });

                if (shipment) {
                    await prisma.$transaction([
                        prisma.shipment.update({
                            where: { id: shipmentId },
                            data: { paymentStatus: "FAILED" },
                        }),
                        prisma.statusLog.create({
                            data: {
                                shipmentId,
                                status: shipment.status,
                                location: "Stripe Online Gateway",
                                note: `Payment failed: ${failureReason}`,
                            },
                        }),
                    ]);

                    await invalidateShipmentCache(
                        shipmentId,
                        shipment.userId,
                        shipment.agentId || undefined
                    );

                    notifyCustomer(shipment.userId, {
                        type: "PAYMENT_FAILED",
                        shipmentId,
                        trackingId: shipment.trackingId,
                        error: failureReason,
                        message: "Your payment attempt failed. Please try another payment method.",
                    });
                }
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
                details: `Refunded $${(refund.amount / 100).toFixed(2)} USD for shipment ${shipment.trackingId
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
                note: `Refund of $${(refund.amount / 100).toFixed(2)} USD processed. Refund ID: ${refund.id
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

export const paymentService: IPaymentService = {
    createPaymentIntent,
    handleStripeWebhook,
    refundPayment,
};
