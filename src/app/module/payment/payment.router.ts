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

// Direct Browser PDF View Endpoints (Accessible via direct link in new tab)
router.get("/invoice-pdf/:identifier", paymentController.streamShipmentInvoicePdf);
router.get("/withdrawal-slip-pdf/:identifier", paymentController.streamWithdrawalSlipPdf);

// Authenticated Endpoints
router.use(authenticate);

// Create Stripe PaymentIntent for a shipment (Customer, Admin, or Agent)
router.post(
    "/create-intent",
    authorize(Role.CUSTOMER, Role.ADMIN, Role.AGENT),
    paymentController.createPaymentIntent
);

// Direct Verification Endpoint (Customer, Admin, or Agent)
router.post(
    "/verify-status",
    authorize(Role.CUSTOMER, Role.ADMIN, Role.AGENT),
    paymentController.verifyPaymentStatus
);

// Administrative Refund (Admin Only)
router.post(
    "/refund",
    authorize(Role.ADMIN),
    paymentController.refundPayment
);

// Admin Financial Analytics & Metrics (Admin Only)
router.get(
    "/admin/stats",
    authorize(Role.ADMIN),
    paymentController.getAdminPaymentStats
);

// Admin View All Agent Withdrawals (Admin Only)
router.get(
    "/admin/withdrawals",
    authorize(Role.ADMIN),
    paymentController.getAdminWithdrawals
);

// Agent Earnings & Commission Overview (Agent Only - Isolated)
router.get(
    "/agent/earnings",
    authorize(Role.AGENT),
    paymentController.getAgentEarnings
);

// Agent Request Commission Withdrawal (Agent Only)
router.post(
    "/agent/withdraw",
    authorize(Role.AGENT),
    paymentController.requestAgentWithdrawal
);

// Agent Withdrawal History with PDF receipts (Agent Only)
router.get(
    "/agent/withdrawals",
    authorize(Role.AGENT),
    paymentController.getAgentWithdrawals
);

export const paymentRouter = router;
