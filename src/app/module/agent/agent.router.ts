import { Router } from "express";
import { authenticate, authorize } from "../../../middleware/auth";
import { Role } from "../../../generated/prisma";
import { agentController } from "./agent.controller";
import { validateRequest } from "../../../middleware/validateRequest";
import {
    acceptShipmentSchema,
    updateAgentShipmentStatusSchema,
    updateAvailabilitySchema,
} from "./agent.validation";
import {
    getShipmentRateLimit,
    updateShipmentRateLimit,
} from "../../../utils/rateLimit";

const router = Router();

// All agent routes require authentication and AGENT role
router.use(authenticate, authorize(Role.AGENT));

// ─── 1. Assigned Shipments ─────────────────────────────
router.get("/assigned", getShipmentRateLimit, agentController.getAssignedShipments);
router.get("/shipments", getShipmentRateLimit, agentController.getAssignedShipments);

// ─── 2. Agent Profile & Availability ───────────────────
router.get("/profile", agentController.getAgentProfile);
router.patch(
    "/availability",
    validateRequest(updateAvailabilitySchema),
    agentController.toggleAvailability
);

// ─── 3. Specific Shipment Operations ───────────────────
router.get("/shipments/:id", getShipmentRateLimit, agentController.getAssignedShipmentById);

router.patch(
    "/shipments/:id/accept",
    validateRequest(acceptShipmentSchema),
    updateShipmentRateLimit,
    agentController.acceptShipment
);

router.patch(
    "/shipments/:id/status",
    validateRequest(updateAgentShipmentStatusSchema),
    updateShipmentRateLimit,
    agentController.updateShipmentStatus
);

export const agentRouter: Router = router;
