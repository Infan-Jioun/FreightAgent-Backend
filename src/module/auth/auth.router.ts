import { Router } from "express";
import { authController } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { loginSchema, registerSchema } from "./auth.validations";
import { authenticate, authorize } from "../../middleware/auth";

const router = Router();

// Public routes
router.post("/register", authController.register)
router.post("/login",  authController.loginUser)
router.post("/logout", authController.logout)


export const authRouter: Router = router;   