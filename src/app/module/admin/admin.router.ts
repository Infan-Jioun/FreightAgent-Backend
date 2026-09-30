import { Router } from "express";
import { authenticate, authorize } from "../../../middleware/auth";
import { Role } from "../../../generated/prisma";
import { adminController } from "./admin.controller";
import {
    assignRoadAgentSchema,
    updateRoleSchema,
    updateUserStatusSchema,
    getUserSessionsSchema,
    revokeUserSessionSchema,
    adminSessionsQuerySchema,
} from "./admin.validation";
import { validateRequest } from "../../../middleware/validateRequest";

const router = Router();

router.use(authenticate, authorize(Role.ADMIN));

// ─── Users Management ─────────────────────────────────
router.get("/users", adminController.getAllUsers);
router.get("/users/:id", adminController.getUserById);
router.patch("/users/:id/role", validateRequest(updateRoleSchema), adminController.updateRole);
router.patch("/users/:id/status", validateRequest(updateUserStatusSchema), adminController.updateUserStatus);
router.patch("/users/:id/block", validateRequest(updateUserStatusSchema), adminController.updateUserStatus);
router.delete("/users/:id", adminController.deleteUser);

// ─── User Device & Session Management ─────────────────
router.get("/users/:id/sessions", validateRequest(getUserSessionsSchema), adminController.getUserActiveSessions);
router.delete("/users/:id/sessions/:sessionId", validateRequest(revokeUserSessionSchema), adminController.revokeUserSession);
router.delete("/users/:id/sessions", validateRequest(getUserSessionsSchema), adminController.revokeAllUserSessions);
router.get("/sessions", validateRequest(adminSessionsQuerySchema), adminController.getAllActiveSessions);


// ─── Road Agents & Shipments Management ───────────────
router.get("/agents", adminController.getRoadAgents);
router.patch(
    "/shipments/:id/assign",
    validateRequest(assignRoadAgentSchema),
    adminController.assignRoadAgent
);

export const adminRouter: Router = router;