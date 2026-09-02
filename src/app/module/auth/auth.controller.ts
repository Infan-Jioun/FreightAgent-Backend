import { Request, Response } from "express";
import { authService } from "./auth.service";
import status from "http-status";
import { catchAsync } from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResonse";
import { auth } from "../../../lib/auth";
import { IRequestUser } from "../../interface/requestUserInterface";
import { tokenUtils } from "../../../utils/token";
import AppError from "../../../errorHelper/AppError";
import { envConfig } from "../../../_config/env";
import crypto from "crypto";
import { Role } from "../../../generated/prisma";


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
const createAgent = catchAsync(
    async (req: Request, res: Response) => {
        const result = await authService.createAgent(req.body);
        sendResponse(res, {
            httpStatusCode: status.CREATED,
            success: true,
            message: "Agent registered. Please verify your email.",
            data: { user: result },
        });
    }
);


// ✅ State store — simple in-memory (production এ Redis use করো)
const stateStore = new Map<string, { createdAt: number; role: Role }>();

const googleLogin = async (req: Request, res: Response) => {
    try {
        const isAgent = req.path.includes("/agent");
        const role = isAgent ? Role.AGENT : Role.CUSTOMER;

        const state = crypto.randomBytes(16).toString("hex");
        stateStore.set(state, { createdAt: Date.now(), role });
        setTimeout(() => stateStore.delete(state), 10 * 60 * 1000);

        const params = new URLSearchParams({
            client_id: envConfig.GOOGLE_CLIENT_ID,
            redirect_uri: `${envConfig.BETTER_AUTH_URL}/api/v1/auth/google/callback`,
            response_type: "code",
            scope: "openid email profile",
            state,
            access_type: "offline",
            prompt: "select_account",
        });

        res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    } catch (err) {
        console.error("Google login error:", err);
        res.redirect(`${envConfig.FRONTEND_URL}/login?error=google_init_failed`);
    }
};

const googleCallback = catchAsync(async (req: Request, res: Response) => {
    try {
        const { code, state, error } = req.query;

        if (error) return res.redirect(`${envConfig.FRONTEND_URL}/login?error=google_denied`);
        if (!code || !state) return res.redirect(`${envConfig.FRONTEND_URL}/login?error=invalid_callback`);

        const stateEntry = stateStore.get(state as string);
        if (!stateEntry) {
            return res.redirect(`${envConfig.FRONTEND_URL}/login?error=invalid_state`);
        }
        stateStore.delete(state as string);
        const requestedRole = stateEntry.role; // ✅ CUSTOMER বা AGENT

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code: code as string,
                client_id: envConfig.GOOGLE_CLIENT_ID,
                client_secret: envConfig.GOOGLE_CLIENT_SECRET,
                redirect_uri: `${envConfig.BETTER_AUTH_URL}/api/v1/auth/google/callback`,
                grant_type: "authorization_code",
            }),
        });

        const tokenData = (await tokenRes.json()) as any;
        if (!tokenData.access_token) {
            return res.redirect(`${envConfig.FRONTEND_URL}/login?error=token_failed`);
        }

        const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const googleUser = (await userRes.json()) as any;
        if (!googleUser.email) {
            return res.redirect(`${envConfig.FRONTEND_URL}/login?error=no_email`);
        }

        const { accessToken, refreshToken, isNewUser } =
            await authService.googleCallback(googleUser, requestedRole); // ✅ role pass

        tokenUtils.setAccessTokenCookie(res, req, accessToken);
        tokenUtils.setRefreshTokenCookie(res, refreshToken);

        res.redirect(
            isNewUser
                ? `${envConfig.FRONTEND_URL}/dashboard?welcome=true`
                : `${envConfig.FRONTEND_URL}/dashboard`
        );
    } catch (err: any) {
        console.error("Google callback error:", err);
        res.redirect(`${envConfig.FRONTEND_URL}/login?error=server_error`);
    }
});
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
    createAdmin,
    createAgent,
    googleLogin,
    // googleSuccess,
    googleCallback,
};