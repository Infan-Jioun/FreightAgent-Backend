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
import {
    profileUpdateRateLimit,
    phoneRequestRateLimit,
    phoneVerifyRateLimit,
} from "../../../utils/rateLimit";

const router = Router();

const allRoles = [Role.ADMIN, Role.AGENT, Role.CUSTOMER];

router.use(authenticate, authorize(...allRoles));

router.get("/me", userController.getMe);
router.patch(
    "/profile",
    uploadSingleImage("image"),
    validateRequest(updateProfileSchema),
    profileUpdateRateLimit,
    userController.updateProfile
);
router.post(
    "/avatar",
    uploadSingleImage("image"),
    profileUpdateRateLimit,
    userController.uploadAvatar
);
router.post(
    "/phone/request",
    validateRequest(requestPhoneVerificationSchema),
    phoneRequestRateLimit,
    userController.requestPhoneVerification
);
router.post(
    "/phone/verify",
    validateRequest(verifyPhoneSchema),
    phoneVerifyRateLimit,
    userController.verifyAndSavePhone
);
router.get("/sessions", userController.getActiveSessions);
router.delete("/sessions/:sessionId", userController.revokeSession);

export const userRouter = router;