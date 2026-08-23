import { Router } from "express";
import { authController } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.validations";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorize } from "../../../middleware/auth";
import { Role } from "../../../generated/prisma";

const router = Router();

router.post("/register", validateRequest(registerSchema), authController.register);
router.post("/login", validateRequest(loginSchema), authController.loginUser);
router.post("/logout", authController.logout);
router.post("/send-otp", authController.sendOtp);
router.post("/verify-otp", authController.verifyEmail);
router.post("/forgot-password", authController.forgotPassword)
router.post("/reset-password", authController.resetPassword)
router.get("/me", authenticate, authorize(Role.CUSTOMER, Role.ADMIN, Role.AGENT), authController.getMe)
router.post("/change-password/send-otp", authenticate, authController.sendChangePasswordOTP);
router.post("/change-password", authenticate, authController.changePassword);
export const authRouter: Router = router;