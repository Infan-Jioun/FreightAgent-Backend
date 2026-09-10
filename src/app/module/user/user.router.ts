import { Router } from "express";
import { authenticate, authorize } from "../../../middleware/auth";
import { validateRequest } from "../../../middleware/validateRequest";
import { uploadSingleImage } from "../../../middleware/fileUpload";
import { userController } from "./user.controller";
import {
    updateProfileSchema,
    requestPhoneVerificationSchema,
    verifyPhoneSchema,
} from "./user.validation";
import { Role } from "../../../generated/prisma";

const router = Router();

const allRoles = [Role.ADMIN, Role.AGENT, Role.CUSTOMER];

router.use(authenticate, authorize(...allRoles));

router.get("/me", userController.getMe);
router.patch(
    "/profile",
    uploadSingleImage("image"),
    validateRequest(updateProfileSchema),
    userController.updateProfile
);
router.post(
    "/avatar",
    uploadSingleImage("image"),
    userController.uploadAvatar
);
router.post("/phone/request", validateRequest(requestPhoneVerificationSchema), userController.requestPhoneVerification);
router.post("/phone/verify", validateRequest(verifyPhoneSchema), userController.verifyAndSavePhone);
router.get("/sessions", userController.getActiveSessions);
router.delete("/sessions/:sessionId", userController.revokeSession);

export const userRouter = router;
export const userRoutes = router;