import { Request, Response } from "express";
import { authService } from "./auth.service";
import status from "http-status";
import { catchAsync } from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResonse";
import { auth } from "../../../lib/auth";
import { IRequestUser } from "../../interface/requestUserInterface";
import { tokenUtils } from "../../../utils/token";
import AppError from "../../../errorHelper/AppError";


const refreshToken = catchAsync(
    async (req: Request, res: Response) => {
        const token = req.cookies?.refreshToken;
        if (!token) {
            throw new AppError(status.UNAUTHORIZED, "Refresh token missing");
        }
        const result = await authService.refreshToken(token);
        tokenUtils.setAccessTokenCookie(res, req, result.accessToken);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Token refreshed successfully",
            data: null,
        });
    }
);
const register = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "User registered. Please verify your email.",
        data: {
            user: result.user,
            // accessToken: result.accessToken,
        }
    });
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.loginUser(req.body);

    // Cookie set
    tokenUtils.setAccessTokenCookie(res, req, result.accessToken);
    tokenUtils.setRefreshTokenCookie(res, result.refreshToken);
    tokenUtils.setBetterAuthSessionCookie(res, result.sessionToken);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Login Successfully",
        data: result
    });
});

const logout = catchAsync(async (req: Request, res: Response) => {
    const accessToken = req.cookies?.accessToken;
    const sessionToken = req.cookies?.["better-auth.session_token"];

    if (accessToken && sessionToken) {
        await authService.logout(accessToken, sessionToken);
    }
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.clearCookie("better-auth.session_token");

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Logged out successfully",
        data: {
            accessToken,
            sessionToken
        },
    });
});

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
const verifyEmail = catchAsync(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const result = await authService.verifyEmail(otp, email);
    tokenUtils.setAccessTokenCookie(res, req, result.accessToken);
    tokenUtils.setRefreshTokenCookie(res, result.refreshToken);
    tokenUtils.setBetterAuthSessionCookie(res, result.sessionToken as string);

    sendResponse(res, {
        httpStatusCode: 200,
        success: true,
        message: "Email verified successfully",
        data: { user: result.user }, // token body তে না!
    });
});
const getMe = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await authService.getMe(user as IRequestUser);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "User Successfully Fetched",
            data: result
        })
    }
)
const forgotPassword = catchAsync(
    async (req: Request, res: Response) => {
        const { email } = req.body;
        await authService.forgotPassword(email as string)
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Password reset OTP send to email successfully",

        })
    }
)
const resetPassword = catchAsync(
    async (req: Request, res: Response) => {
        const { email, otp, newPassword } = req.body;
        const result = await authService.resetPassword(email as string, otp as string, newPassword as string)
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Password reset Successfully",
            data: result
        })
    }
)
const sendChangePasswordOTP = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user as IRequestUser;
        const result = await authService.sendChangePasswordOTP(user);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "OTP sent to your email",
            data: result,
        });
    }
);

const changePassword = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user as IRequestUser;
        const sessionToken = req.cookies?.["better-auth.session_token"];

        if (!sessionToken) {
            throw new AppError(status.UNAUTHORIZED, "Session token missing");
        }

        const result = await authService.changePassword(
            { ...req.body, sessionToken },
            user
        );

        tokenUtils.setAccessTokenCookie(res, req, result.accessToken);
        tokenUtils.setRefreshTokenCookie(res, result.refreshToken);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Password changed successfully",
            data: result,
        });
    }
);
const createAdmin = catchAsync(async (req: Request, res: Response) => {
    const result = authService.createAdmin(req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Successfully Registered Admin! Please verify your email.",
        data: {
                user: (await result).adminData      
        }
    })
})
export const authController = {
    refreshToken,
    register,
    loginUser,
    logout,
    sendOtp,
    verifyEmail,
    getMe,
    forgotPassword,
    resetPassword,
    sendChangePasswordOTP,
    changePassword,
    createAdmin
};