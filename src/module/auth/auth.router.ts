import { Router } from "express";
import { authController } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { loginSchema, registerSchema } from "./auth.validations";
import { authenticate, authorize } from "../../middleware/auth";

const router = Router();

// Public routes
router.post("/register", validateRequest(registerSchema), authController.register)
router.post("/login", validateRequest(loginSchema), authController.loginUser)
router.post("/logout", authController.logout)
router.post("/send-otp", authController.verifyEmaiil)

export const authRouter: Router = router;   