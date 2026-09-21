import { Request, Response } from "express";
import { catchAsync } from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResonse";
import status from "http-status";
import { paymentService } from "./payment.service";
import { calculateFreightCost } from "./pricing.engine";
import AppError from "../../../errorHelper/AppError";
import { IRequestUser } from "../../interface/requestUserInterface";
import { getClientIp, parseUserAgent } from "../../../utils/deviceDetector";

const calculatePricing = catchAsync(async (req: Request, res: Response) => {
    const { origin, destination, weightKg, declaredCargoValueUSD, targetCurrency } = req.body;

    if (!origin || !destination) {
        throw new AppError(status.BAD_REQUEST, "Origin and Destination are required");
    }

    const result = await calculateFreightCost({
        origin,
        destination,
        weightKg: Number(weightKg) || 1,
        declaredCargoValueUSD: Number(declaredCargoValueUSD) || 0,
        targetCurrency: targetCurrency || "USD",
    });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Freight pricing calculated successfully",
        data: result,
    });
});

const createPaymentIntent = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const { shipmentId, currency } = req.body;

    if (!shipmentId) {
        throw new AppError(status.BAD_REQUEST, "Shipment ID is required");
    }

    const result = await paymentService.createPaymentIntent({
        shipmentId,
        userId: user.userId || user.id,
        userRole: user.role,
        currency,
    });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Payment intent initialized successfully",
        data: result,
    });
});

const verifyPaymentStatus = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const { shipmentId } = req.body;

    if (!shipmentId) {
        throw new AppError(status.BAD_REQUEST, "Shipment ID is required");
    }

    const result = await paymentService.verifyPaymentStatus({
        shipmentId,
        userId: user.userId || user.id,
        userRole: user.role,
    });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.success ? "Payment verified and recorded as PAID" : "Payment status checked",
        data: result,
    });
});

/**
 * Handles incoming raw Stripe Webhooks.
 * Notice: req.body is a raw Buffer passed via express.raw middleware.
 */
const handleWebhook = catchAsync(async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"] as string;

    if (!signature) {
        throw new AppError(status.BAD_REQUEST, "Missing stripe-signature header");
    }

    const rawBody = req.body as Buffer;
    const result = await paymentService.handleStripeWebhook(rawBody, signature);

    res.status(status.OK).json(result);
});

const refundPayment = catchAsync(async (req: Request, res: Response) => {
    const admin = req.user as IRequestUser;
    const { shipmentId, reason } = req.body;

    if (!shipmentId || !reason) {
        throw new AppError(status.BAD_REQUEST, "Shipment ID and refund reason are required");
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";

    const result = await paymentService.refundPayment({
        shipmentId,
        reason,
        adminId: admin.id,
        ipAddress,
        userAgent,
    });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Refund processed successfully",
        data: result,
    });
});

const getAdminPaymentStats = catchAsync(async (req: Request, res: Response) => {
    const result = await paymentService.getAdminPaymentStats();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Admin financial statistics retrieved successfully",
        data: result,
    });
});

const getAdminWithdrawals = catchAsync(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await paymentService.getAdminWithdrawals(page, limit);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Admin withdrawals retrieved successfully",
        data: result,
    });
});

const getAgentEarnings = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const agentId = user.userId || user.id;

    const result = await paymentService.getAgentEarnings(agentId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Agent earnings retrieved successfully",
        data: result,
    });
});

const requestAgentWithdrawal = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const agentId = user.userId || user.id;
    const { amount, bankInfo, note } = req.body;

    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";

    const result = await paymentService.requestAgentWithdrawal({
        agentId,
        amount: Number(amount),
        bankInfo,
        note,
        ipAddress,
        userAgent,
    });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Withdrawal processed and PDF voucher generated successfully",
        data: result,
    });
});

const getAgentWithdrawals = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const agentId = user.userId || user.id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await paymentService.getAgentWithdrawals(agentId, page, limit);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Agent withdrawals history retrieved successfully",
        data: result,
    });
});

const streamShipmentInvoicePdf = catchAsync(async (req: Request, res: Response) => {
    const { identifier } = req.params;

    if (!identifier) {
        throw new AppError(status.BAD_REQUEST, "Shipment ID or tracking number is required");
    }

    const { buffer, trackingId } = await paymentService.getShipmentInvoicePdfBuffer(identifier as string);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Invoice_${trackingId}.pdf"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
});

const streamWithdrawalSlipPdf = catchAsync(async (req: Request, res: Response) => {
    const { identifier } = req.params;

    if (!identifier) {
        throw new AppError(status.BAD_REQUEST, "Withdrawal voucher ID or number is required");
    }

    const { buffer, withdrawalNumber } = await paymentService.getWithdrawalSlipPdfBuffer(identifier as string);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Voucher_${withdrawalNumber}.pdf"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
});

export const paymentController = {
    calculatePricing,
    createPaymentIntent,
    verifyPaymentStatus,
    handleWebhook,
    refundPayment,
    getAdminPaymentStats,
    getAdminWithdrawals,
    getAgentEarnings,
    requestAgentWithdrawal,
    getAgentWithdrawals,
    streamShipmentInvoicePdf,
    streamWithdrawalSlipPdf,
};
