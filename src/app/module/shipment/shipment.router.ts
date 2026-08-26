import express, { Router } from "express";
import { authenticate, authorize } from "../../../middleware/auth";
import { shipmentController } from "./shipment.controller";
import { Role } from "../../../generated/prisma";
import { getShipmentRateLimit, updateShipmentRateLimit } from "../../../utils/rateLimit";
import { validateRequest } from "../../../middleware/validateRequest";
import { updateShipmentStatusSchema } from "./shipment.validation";
const router = Router()
router.use(authenticate);

router.post("/", authorize(Role.ADMIN, Role.CUSTOMER, Role.CUSTOMER), shipmentController.createShipment)
router.get("/", authorize(Role.ADMIN, Role.AGENT), getShipmentRateLimit, shipmentController.getAllShipments);
router.get("/my", authorize(Role.CUSTOMER, Role.AGENT, Role.ADMIN), getShipmentRateLimit, shipmentController.getMyShipments);
router.get("/:id", getShipmentRateLimit, shipmentController.getShipmentById);
router.patch("/:id/status", authorize(Role.ADMIN, Role.AGENT), updateShipmentRateLimit,
validateRequest(updateShipmentStatusSchema), shipmentController.updateShipmentStatus);

export const shipmentRouter: Router = router;