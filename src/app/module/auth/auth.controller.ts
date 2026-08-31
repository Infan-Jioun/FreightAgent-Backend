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

const googleLogin = async (req: Request, res: Response) => {
    try {

        const response = await auth.api.signInSocial({
            body: {
                provider: "google",
                callbackURL: `${envConfig.BETTER_AUTH_URL}/api/auth/callback/google`,
            },
            headers: req.headers as any,
            asResponse: true,
        });

        const location = response.headers.get("location");
        if (location) return res.redirect(location);

        res.redirect(`${envConfig.FRONTEND_URL}/login?error=google_init_failed`);
    } catch (err) {
        console.error("Google login error:", err);
        res.redirect(`${envConfig.FRONTEND_URL}/login?error=google_init_failed`);
    }
};
// const googleSuccess = catchAsync(async (req: Request, res: Response) => {
//     try {
//         const session = await auth.api.getSession({
//             headers: req.headers as any,
//         });
//         console.log("Headers:", req.headers);
//         console.log("Cookies:", req.cookies);
//         if (!session?.user) {
//             return res.redirect(`${envConfig.FRONTEND_URL}/login?error=google_failed`);
//         }

//         const { accessToken, refreshToken, isNewUser } =
//             await authService.googleCallback(session.user);

//         tokenUtils.setAccessTokenCookie(res, req, accessToken);
//         tokenUtils.setRefreshTokenCookie(res, refreshToken);

//         res.redirect(
//             isNewUser
//                 ? `${envConfig.FRONTEND_URL}/dashboard?welcome=true`
//                 : `${envConfig.FRONTEND_URL}/dashboard`
//         );
//     } catch (err) {
//         console.error("Google success error:", err);
//         res.redirect(`${envConfig.FRONTEND_URL}/login?error=server_error`);
//     }
// });
const googleCallback = catchAsync(async (req: Request, res: Response) => {
    // ✅ Better Auth নিজেই /api/auth/callback/google handle করে
    // এই route শুধু session থেকে user নিয়ে JWT দেবে
    const session = await auth.api.getSession({
        headers: req.headers as any,
    });

    if (!session?.user) {
        return res.redirect(`${envConfig.FRONTEND_URL}/login?error=google_failed`);
    }

    const { accessToken, refreshToken, isNewUser } =
        await authService.googleCallback(session.user);

    tokenUtils.setAccessTokenCookie(res, req, accessToken);
    tokenUtils.setRefreshTokenCookie(res, refreshToken);

    res.redirect(
        isNewUser
            ? `${envConfig.FRONTEND_URL}/dashboard?welcome=true`
            : `${envConfig.FRONTEND_URL}/dashboard`
    );
});
const googleJWT = catchAsync(async (req: Request, res: Response) => {
    // Better Auth callback এর পরে frontend এই route call করবে
    const session = await auth.api.getSession({
        headers: req.headers as any,
    });

    if (!session?.user) {
        return res.status(401).json({ error: "No session found" });
    }

    const { user, accessToken, refreshToken, isNewUser } =
        await authService.googleCallback(session.user);

    tokenUtils.setAccessTokenCookie(res, req, accessToken);
    tokenUtils.setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
        success: true,
        user,
        isNewUser,
    });
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
    googleJWT
};