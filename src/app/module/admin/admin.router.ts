import express, { Router } from "express";
import { authenticate, authorize } from "../../../middleware/auth";
import { Role } from "../../../generated/prisma";
import { adminController } from "./admin.controller";
const router = Router();
router.use(authenticate, authorize(Role.ADMIN))
router.get("/users", adminController.getAllUsers)
router.get("/users/:id", adminController.getUserById)
export const adminRouter: Router = router