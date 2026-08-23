import { Router } from "express";
import { authController } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.validations";
import { validateRequest } from "../../../middleware/validateRequest";

const router = Router();

router.post("/register", validateRequest(registerSchema), authController.register);
router.post("/login", validateRequest(loginSchema), authController.loginUser);
router.post("/logout", authController.logout);
router.post("/send-otp", authController.sendOtp);       
router.post("/verify-otp", authController.verifyEmail); 

export const authRouter: Router = router;