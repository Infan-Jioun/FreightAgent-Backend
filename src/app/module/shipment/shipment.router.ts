import express, { Router } from "express";
import { authenticate, authorize } from "../../../middleware/auth";
import { shipmentController } from "./shipment.controller";
import { Role } from "../../../generated/prisma";
const router = Router()
router.use(authenticate);

router.post("/", authorize(Role.ADMIN, Role.CUSTOMER, Role.CUSTOMER), shipmentController.createShipment)
export const shipmentRouter: Router = router;