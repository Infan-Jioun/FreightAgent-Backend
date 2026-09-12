import { Router } from "express";
import { authController } from "./auth.controller";
import { adminRegisterSchema, changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, verifyOtpSchema } from "./auth.validations";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorize } from "../../../middleware/auth";
import {
    adminRegisterRateLimit,
    changePasswordOtpRateLimit,
    changePasswordRateLimit,
    loginRateLimit,
    otpRateLimit,
    registerRateLimit,
} from "../../../utils/rateLimit";
import { Role } from "../../../generated/prisma";
const router = Router();
router.post("/refresh-token", authController.refreshToken);
router.post("/register", registerRateLimit, validateRequest(registerSchema), authController.register);
router.post("/login", loginRateLimit, validateRequest(loginSchema), authController.loginUser);
router.post("/logout", authController.logout);
router.post("/send-otp", otpRateLimit, authController.sendOtp);
router.post("/verify-otp", validateRequest(verifyOtpSchema), authController.verifyEmail);
router.post("/forgot-password", otpRateLimit, validateRequest(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", validateRequest(resetPasswordSchema), authController.resetPassword);
router.get("/me", authenticate, authorize(Role.CUSTOMER, Role.ADMIN, Role.AGENT), authController.getMe)
router.post("/change-password/send-otp", authenticate, authorize(Role.CUSTOMER, Role.ADMIN, Role.AGENT), changePasswordOtpRateLimit, authController.sendChangePasswordOTP);
router.post("/change-password", authenticate, authorize(Role.CUSTOMER, Role.ADMIN, Role.AGENT), validateRequest(changePasswordSchema), changePasswordRateLimit, authController.changePassword);
router.post("/create-admin", adminRegisterRateLimit, validateRequest(adminRegisterSchema), authController.createAdmin)
router.post("/create-agent", registerRateLimit, validateRequest(registerSchema), authController.createAgent)
router.get("/google", authController.googleLogin);
router.get("/google/agent", authController.googleLogin);
router.get("/google/callback", authController.googleCallback);
router.post("/google/set-cookie", authController.googleSetCookie);

export const authRouter: Router = router;