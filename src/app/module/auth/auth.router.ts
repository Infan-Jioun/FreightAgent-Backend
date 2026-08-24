import { Router } from "express";
import { authController } from "./auth.controller";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, verifyOtpSchema } from "./auth.validations";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorize } from "../../../middleware/auth";
import { Role } from "../../../generated/prisma";
import { adminRegisterRateLimit, loginRateLimit, otpRateLimit, registerRateLimit } from "../../../utils/rateLimit";

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
router.post("/change-password/send-otp", otpRateLimit, authenticate, authController.sendChangePasswordOTP);
router.post("/change-password", authenticate, validateRequest(changePasswordSchema) );
router.post("/create-admin", adminRegisterRateLimit, authController.createAdmin)
export const authRouter: Router = router;