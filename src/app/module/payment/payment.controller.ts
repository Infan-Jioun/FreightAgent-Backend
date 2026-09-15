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

export const paymentController = {
    calculatePricing,
    createPaymentIntent,
    handleWebhook,
    refundPayment,
};
