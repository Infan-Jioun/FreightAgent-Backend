import { Router } from "express";
import { authController } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { registerSchema } from "./auth.validations";
import { authenticate, authorize } from "../../middleware/auth";




const router = Router();

// Public routes
router.post("/register",  validateRequest(registerSchema), authController.register)
router.post("/login", authController.loginUser)



export const authRouter: Router = router;  