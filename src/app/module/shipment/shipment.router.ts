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

// ─── 1. Public Tracking Route (Accessible by anyone with trackingId, placed before /:id) ───
// GET /api/v1/shipment/track/:trackingId
router.get(
    "/track/:trackingId",
    getShipmentRateLimit,
    shipmentController.trackShipment
);

// ─── All routes below require authentication ──────────────────────────────────────────────
router.use(authenticate);

// ─── 2. Create Shipment ───
// POST /api/v1/shipment
router.post(
    "/",
    authorize(Role.ADMIN, Role.CUSTOMER, Role.AGENT),
    createShipmentRateLimit,
    validateRequest(createShipmentSchema),
    shipmentController.createShipment
);

// ─── 3. Get All Shipments (Admin & Agent only) ───
// GET /api/v1/shipment
router.get(
    "/",
    authorize(Role.ADMIN, Role.AGENT),
    getShipmentRateLimit,
    shipmentController.getAllShipments
);

// ─── 4. Get Logged-in User Shipments (Customer, Agent, Admin) ───
// GET /api/v1/shipment/my
router.get(
    "/my",
    authorize(Role.CUSTOMER, Role.AGENT, Role.ADMIN),
    getShipmentRateLimit,
    shipmentController.getMyShipments
);

// ─── 5. Update Shipment Status ───
// PATCH /api/v1/shipment/:id/status
router.patch(
    "/:id/status",
    authorize(Role.ADMIN, Role.AGENT),
    updateShipmentRateLimit,
    validateRequest(updateShipmentStatusSchema),
    shipmentController.updateShipmentStatus
);

// ─── 6. Delete Shipment (Admin only) ───
// DELETE /api/v1/shipment/:id
router.delete(
    "/:id",
    authorize(Role.ADMIN),
    deleteShipmentRateLimit,
    shipmentController.deleteShipment
);

// ─── 7. Get Shipment By ID (Placed after static sub-routes /my and /track) ───
// GET /api/v1/shipment/:id
router.get(
    "/:id",
    getShipmentRateLimit,
    shipmentController.getShipmentById
);

export const shipmentRouter: Router = router;