import { Router } from "express";
import { authController } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { loginSchema, registerSchema } from "./auth.validations";
import { authenticate, authorize } from "../../middleware/auth";
import { Role } from "../../generated/prisma";
const router = Router();

// Public routes
router.post("/register", authController.register)
router.post("/login", validateRequest(loginSchema), authController.loginUser)
router.post("/logout", authenticate)


export const authRouter: Router = router;  