import { Router } from "express";
import { authenticate, authorize } from "../../../middleware/auth";
import { paymentController } from "./payment.controller";
import { Role } from "../../../generated/prisma";
import express from "express";

const router = Router();

// Public Pricing Calculation Endpoint (Used by frontend quote calculator)
router.post("/calculate-pricing", paymentController.calculatePricing);

// Raw Webhook Endpoint (Can also be mounted directly on app with express.raw)
router.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    paymentController.handleWebhook
);

// Authenticated Endpoints
router.use(authenticate);

// Create Stripe PaymentIntent for a shipment (Customer, Admin, or Agent)
router.post(
    "/create-intent",
    authorize(Role.CUSTOMER, Role.ADMIN, Role.AGENT),
    paymentController.createPaymentIntent
);

// Administrative Refund (Admin Only)
router.post(
    "/refund",
    authorize(Role.ADMIN),
    paymentController.refundPayment
);

export const paymentRouter = router;
