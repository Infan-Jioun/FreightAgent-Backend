import { Router } from "express";
import { authenticate, authorize } from "../../../middleware/auth";
import { Role } from "../../../generated/prisma";
import { notificationController } from "./notification.controller";

const router = Router();

// All notification operations require authentication across all platform roles
router.use(authenticate, authorize(Role.ADMIN, Role.AGENT, Role.CUSTOMER));

router.get("/", notificationController.getUserNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.patch("/read-all", notificationController.markAllAsRead);
router.patch("/:id/read", notificationController.markAsRead);
router.delete("/:id", notificationController.deleteNotification);

export const notificationRouter: Router = router;
