import { Router } from "express";
import { authenticate, authorize } from "../../../middleware/auth";
import { shipmentController } from "./shipment.controller";
import { Role } from "../../../generated/prisma";
import {
    createShipmentRateLimit,
    deleteShipmentRateLimit,
    getShipmentRateLimit,
    updateShipmentRateLimit,
} from "../../../utils/rateLimit";
import { validateRequest } from "../../../middleware/validateRequest";
import {
    createShipmentSchema,
    updateShipmentStatusSchema,
} from "./shipment.validation";

const router = Router();

// ─── 1. Public ───────────────────────────────────────
router.get(
    "/track/:trackingId",
    getShipmentRateLimit,
    shipmentController.trackShipment
);

router.use(authenticate);

// ─── 2. Create Shipment ──────────────────────────────
router.post(
    "/",
    authorize(Role.ADMIN, Role.CUSTOMER, Role.AGENT),
    createShipmentRateLimit,
    validateRequest(createShipmentSchema),
    shipmentController.createShipment
);

// ─── 3. Admin — All Shipments (Admin Only) ───────────
router.get(
    "/",
    authorize(Role.ADMIN),
    getShipmentRateLimit,
    shipmentController.getAllShipments
);

// ─── 4. Customer — My Shipments ──────────────────────
router.get(
    "/my",
    authorize(Role.CUSTOMER, Role.AGENT, Role.ADMIN),
    getShipmentRateLimit,
    shipmentController.getMyShipments
);

// ─── 5. Agent — Assigned Shipments ✅ নতুন ───────────
// GET /api/v1/shipment/agent/assigned
router.get(
    "/agent/assigned",
    authorize(Role.ADMIN, Role.AGENT),
    getShipmentRateLimit,
    shipmentController.getAgentShipments
);

// ─── 6. Update Status ────────────────────────────────
router.patch(
    "/:id/status",
    authorize(Role.ADMIN, Role.AGENT),
    updateShipmentRateLimit,
    validateRequest(updateShipmentStatusSchema),
    shipmentController.updateShipmentStatus
);

// ─── 7. Delete ───────────────────────────────────────
router.delete(
    "/:id",
    authorize(Role.ADMIN),
    deleteShipmentRateLimit,
    shipmentController.deleteShipment
);

// ─── 8. Get By ID — সবার শেষে রাখো ─────────────────
// (static routes যেমন /my, /agent/assigned এর পরে)
router.get(
    "/:id",
    getShipmentRateLimit,
    shipmentController.getShipmentById
);

export const shipmentRouter: Router = router;