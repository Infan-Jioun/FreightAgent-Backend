import { Request, Response } from "express";
import { authService } from "./auth.service";

import { auth } from "../../lib/auth";
import { catchAsync } from "../../shared/catchAsync";
import status from "http-status";
import { sendResponse } from "../../shared/sendResonse";

const register = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "User registered. Please verify your email.",
        data: result
    });
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.loginUser(req.body);
    sendResponse(res, {
        httpStatusCode: 200,
        success: true,
        message: "Login successful",
        data: result
    });
});

const logout = catchAsync(async (req: Request, res: Response) => {
    const sessionToken = req.cookies?.['better-auth.session_token'];
    const result = await authService.logout(sessionToken);
    sendResponse(res, {
        httpStatusCode: 200,
        success: true,
        message: "Logout successful",
        data: result
    });
});

// ✅ OTP পাঠানোর function
const sendOtp = catchAsync(async (req: Request, res: Response) => {
    const { email } = req.body;

    await auth.api.sendVerificationOTP({
        body: {
            email,
            type: "email-verification"
        }
    });

    sendResponse(res, {
        httpStatusCode: 200,
        success: true,
        message: "OTP sent to your email",
        data: null
    });
});

// ✅ OTP verify করার function
const verifyEmail = catchAsync(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const result = await authService.verifyEmail(otp, email);
    sendResponse(res, {
        httpStatusCode: 200,
        success: true,
        message: "Email verified successfully",
        data: result
    });
});

export const authController = {
    register,
    loginUser,
    logout,
    sendOtp,    // ✅
    verifyEmail // ✅
};