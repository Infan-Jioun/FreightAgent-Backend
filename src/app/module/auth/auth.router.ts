import { Router } from "express";
import { authController } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.validations";
import { validateRequest } from "../../../middleware/validateRequest";

const router = Router();
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jioun
 *               email:
 *                 type: string
 *                 example: jioun@gmail.com
 *               password:
 *                 type: string
 *                 example: Test@123
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 */
router.post("/register", validateRequest(registerSchema), authController.register);
router.post("/login", validateRequest(loginSchema), authController.loginUser);
router.post("/logout", authController.logout);
router.post("/send-otp", authController.sendOtp);       
router.post("/verify-otp", authController.verifyEmail); 
router.get("/me" ,authController.getMe)
export const authRouter: Router = router;