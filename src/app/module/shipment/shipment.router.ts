import express, { Router } from "express";
import { authenticate, authorize } from "../../../middleware/auth";
import { shipmentController } from "./shipment.controller";
import { Role } from "../../../generated/prisma";
import { getShipmentRateLimit } from "../../../utils/rateLimit";
const router = Router()
router.use(authenticate);

router.post("/", authorize(Role.ADMIN, Role.CUSTOMER, Role.CUSTOMER), shipmentController.createShipment)
router.get("/", authorize(Role.ADMIN, Role.AGENT), getShipmentRateLimit,
    shipmentController.getAllShipments);
router.get("/:id", getShipmentRateLimit, shipmentController.getShipmentById);
export const shipmentRouter: Router = router;