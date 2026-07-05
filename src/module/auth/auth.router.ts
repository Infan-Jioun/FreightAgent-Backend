import { Router } from "express";
import { authController } from "./auth.controller";



const router = Router();

// Public routes
router.post("/register", authController.register)
router.post("/login", authController.loginUser)



export const authRouter: Router = router;  