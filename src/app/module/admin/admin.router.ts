import express, { Router } from "express";
import { authenticate, authorize } from "../../../middleware/auth";
import { Role } from "../../../generated/prisma";
import { adminController } from "./admin.controller";
import { validateRequest } from "../../../middleware/validateRequest";
import { updateRoleSchema } from "./admin.validation";
const router = Router();
router.use(authenticate, authorize(Role.ADMIN))
router.get("/users", adminController.getAllUsers)
router.get("/users/:id", adminController.getUserById)
router.patch("/users/:id/role", validateRequest(updateRoleSchema), adminController.updateRole);
router.delete("/users/:id", adminController.deleteUser);
export const adminRouter: Router = router