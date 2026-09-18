import { Request, Response } from "express";
import { authService } from "./auth.service";
import { userService } from "../user/user.service";
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
import { JwtTokenUtils } from "../../../utils/jwt";
import { prisma } from "../../../lib/prisma";
import { getClientIp, parseUserAgent } from "../../../utils/deviceDetector";


const refreshToken = catchAsync(
    async (req: Request, res: Response) => {
        const token = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!token) {
            throw new AppError(status.UNAUTHORIZED, "Refresh token missing");
        }
        const result = await authService.refreshToken(token);
        tokenUtils.setAccessTokenCookie(res, req, result.accessToken);
        tokenUtils.setRefreshTokenCookie(res, req, result.refreshToken);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Token refreshed and rotated successfully",
            data: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                user: result.user,
            },
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
    const ip = getClientIp(req);
    const result = await authService.loginUser({ ...req.body, ip });

    const userAgent = req.headers["user-agent"] || "";
    const deviceInfo = parseUserAgent(userAgent);

    if (result.sessionToken) {
        await prisma.session.updateMany({
            where: { token: result.sessionToken },
            data: {
                ipAddress: ip,
                userAgent,
                deviceName: deviceInfo.deviceName,
                deviceType: deviceInfo.deviceType,
                browser: deviceInfo.browser,
                os: deviceInfo.os,
            },
        });
    }

    // Cookie set
    tokenUtils.setAccessTokenCookie(res, req, result.accessToken);
    tokenUtils.setRefreshTokenCookie(res, req, result.refreshToken);
    tokenUtils.setBetterAuthSessionCookie(res, req, result.sessionToken);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Login Successfully",
        data: result
    });
});

const logout = catchAsync(async (req: Request, res: Response) => {
    const accessToken =
        req.cookies?.accessToken ||
        req.headers.authorization?.split(" ")[1];
    let sessionToken = req.cookies?.["better-auth.session_token"];

    if (!sessionToken && accessToken) {
        const decoded = JwtTokenUtils.decodedToken(accessToken);
        if (decoded?.sessionToken) {
            sessionToken = decoded.sessionToken as string;
        }
    }

    if (accessToken || sessionToken) {
        await authService.logout(accessToken || "", sessionToken || "");
    }
    tokenUtils.clearAuthCookies(res, req);

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
    tokenUtils.setRefreshTokenCookie(res, req, result.refreshToken);
    tokenUtils.setBetterAuthSessionCookie(res, req, result.sessionToken as string);

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
        const result = await userService.getMe(user as IRequestUser);
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
        tokenUtils.setRefreshTokenCookie(res, req, result.refreshToken);

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


//  State store — simple in-memory (production এ Redis use করো)
const stateStore = new Map<string, { createdAt: number; role: Role }>();

const googleLogin = async (req: Request, res: Response) => {
    try {
        const isAgent = req.path.includes("/agent");
        const role = req.query.role === "AGENT" || isAgent ? Role.AGENT : Role.CUSTOMER;
        const revokeOthers = req.query.revokeOthers === "true";

        const randomPart = crypto.randomBytes(16).toString("hex");
        const state = `${randomPart}_${role}_${revokeOthers ? "revoke" : "normal"}`;
        stateStore.set(state, { createdAt: Date.now(), role });
        setTimeout(() => stateStore.delete(state), 10 * 60 * 1000);

        const params = new URLSearchParams({
            client_id: envConfig.GOOGLE_CLIENT_ID,
            redirect_uri: `${envConfig.BACKEND_URL}/auth/google/callback`,
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
    let googleUser: any = null;
    try {
        const { code, state, error } = req.query;

        if (error) return res.redirect(`${envConfig.FRONTEND_URL}/login?error=google_denied`);
        if (!code || !state) return res.redirect(`${envConfig.FRONTEND_URL}/login?error=invalid_callback`);

        //  state থেকে role ও revokeOthers বের করো — serverless-safe
        const stateParts = (state as string).split("_");
        if (stateParts.length < 2) {
            return res.redirect(`${envConfig.FRONTEND_URL}/login?error=invalid_state`);
        }

        const roleFromState = stateParts[1] as Role;
        if (!Object.values(Role).includes(roleFromState)) {
            return res.redirect(`${envConfig.FRONTEND_URL}/login?error=invalid_role`);
        }

        const requestedRole = roleFromState;
        const revokeOthers = stateParts[2] === "revoke" || req.query.revokeOthers === "true";

        //  redirect_uri দুই জায়গায় same
        const GOOGLE_REDIRECT_URI = `${envConfig.BACKEND_URL}/auth/google/callback`;

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code: code as string,
                client_id: envConfig.GOOGLE_CLIENT_ID,
                client_secret: envConfig.GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URI,
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
        googleUser = (await userRes.json()) as any;

        if (!googleUser.email) {
            return res.redirect(`${envConfig.FRONTEND_URL}/login?error=no_email`);
        }

        const { accessToken, refreshToken, sessionToken, isNewUser } =
            await authService.googleCallback(googleUser, requestedRole, revokeOthers);

        tokenUtils.setAccessTokenCookie(res, req, accessToken);
        tokenUtils.setRefreshTokenCookie(res, req, refreshToken);
        if (sessionToken) {
            tokenUtils.setBetterAuthSessionCookie(res, req, sessionToken);
        }

        const tempToken = Buffer.from(JSON.stringify({
            accessToken,
            refreshToken,
            sessionToken,
            isNewUser
        })).toString("base64url");

        const searchParams = new URLSearchParams({
            t: tempToken,
            token: tempToken,
            tempToken: tempToken,
            accessToken: accessToken,
            refreshToken: refreshToken,
            sessionToken: sessionToken || "",
            google: "true",
        });

        if (isNewUser) {
            searchParams.set("welcome", "true");
        }

        res.redirect(`${envConfig.FRONTEND_URL}/google/success?${searchParams.toString()}`);
    } catch (err: any) {
        console.error("Google callback error:", err);
        if (
            err.statusCode === status.FORBIDDEN ||
            (err.message && /device|simultaneous|3 devices|session_limit/i.test(err.message))
        ) {
            const emailParam = googleUser?.email ? `&email=${encodeURIComponent(googleUser.email)}` : "";
            const messageParam = err.message ? `&message=${encodeURIComponent(err.message)}` : "";
            return res.redirect(
                `${envConfig.FRONTEND_URL}/login?error=session_limit${emailParam}${messageParam}`
            );
        }
        res.redirect(`${envConfig.FRONTEND_URL}/login?error=server_error`);
    }
});
const googleSetCookie = catchAsync(async (req: Request, res: Response) => {
    const rawToken = req.body?.token || req.body?.t || req.body?.tempToken;
    let accessToken = req.body?.accessToken;
    let refreshToken = req.body?.refreshToken;
    let sessionToken = req.body?.sessionToken;
    let isNewUser = req.body?.isNewUser ?? false;

    if (rawToken) {
        try {
            const decoded = typeof rawToken === "object"
                ? rawToken
                : JSON.parse(Buffer.from(rawToken, "base64url").toString("utf-8"));
            accessToken = decoded.accessToken || accessToken;
            refreshToken = decoded.refreshToken || refreshToken;
            sessionToken = decoded.sessionToken || sessionToken;
            if (decoded.isNewUser !== undefined) {
                isNewUser = decoded.isNewUser;
            }
        } catch (e) {
            if (!accessToken && typeof rawToken === "string") {
                accessToken = rawToken;
            }
        }
    }

    if (!accessToken) {
        throw new AppError(status.BAD_REQUEST, "Token missing");
    }

    //  user data verify
    const payload = JwtTokenUtils.verifyToken(
        accessToken,
        envConfig.ACCESS_TOKEN_SECRET
    );

    let userData: any = payload?.data || null;

    if (payload?.data?.userId) {
        try {
            const dbUser = await prisma.user.findUnique({
                where: { id: payload.data.userId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    emailVerified: true,
                    image: true,
                }
            });
            if (dbUser) {
                userData = dbUser;
            }

            //  যদি sessionToken না থাকে, ইউজারের active session খুঁজুন অথবা তৈরি করুন
            if (!sessionToken) {
                const activeSession = await prisma.session.findFirst({
                    where: {
                        userId: payload.data.userId,
                        expiresAt: { gt: new Date() }
                    },
                    orderBy: { createdAt: "desc" }
                });
                if (activeSession) {
                    sessionToken = activeSession.token;
                } else {
                    sessionToken = crypto.randomBytes(32).toString("hex");
                    const gIp = getClientIp(req);
                    const gUa = req.headers["user-agent"] || "";
                    const gDev = parseUserAgent(gUa);

                    await prisma.session.create({
                        data: {
                            id: crypto.randomUUID(),
                            userId: payload.data.userId,
                            token: sessionToken,
                            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                            ipAddress: gIp,
                            userAgent: gUa,
                            deviceName: gDev.deviceName,
                            deviceType: gDev.deviceType,
                            browser: gDev.browser,
                            os: gDev.os,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        }
                    });
                }
            }
        } catch (sessionErr) {
            console.error("Session lookup/create error:", sessionErr);
        }
    }

    if (payload.data?.userId) {
        const clientIp = getClientIp(req);
        await prisma.user.update({
            where: { id: payload.data.userId },
            data: {
                lastLoginAt: new Date(),
                lastLoginIp: clientIp,
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
        });
    }

    //  এবার same-site / CORS request — ৩টি cookie-ই সেট হবে
    tokenUtils.setAccessTokenCookie(res, req, accessToken);
    if (refreshToken) {
        tokenUtils.setRefreshTokenCookie(res, req, refreshToken);
    }
    if (sessionToken) {
        tokenUtils.setBetterAuthSessionCookie(res, req, sessionToken);
    }

    res.status(200).json({
        success: true,
        message: "Cookies set successfully",
        data: userData,
        accessToken,
        refreshToken,
        sessionToken,
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
    googleSetCookie,
};