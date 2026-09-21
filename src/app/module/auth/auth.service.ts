import { Request } from "express";
import crypto from "crypto";
import { IChangePassword, ICreateAdmin, ICreateAgentInput, ILoginInput, IRegisterInput } from "./auth.interface";
import AppError from "../../../errorHelper/AppError";
import status from "http-status";
import { prisma } from "../../../lib/prisma";
import { auth } from "../../../lib/auth";
import { tokenUtils } from "../../../utils/token";
import { Role } from "../../../generated/prisma";
import { IRequestUser } from "../../interface/requestUserInterface";
import { isTempEmail } from "../../../utils/emailValidator";
import { sendEmail } from "../../../utils/email";
import { JwtTokenUtils } from "../../../utils/jwt";
import { blacklistToken, isTokenBlacklisted } from "../../../utils/tokenBlacklist";
import { envConfig } from "../../../_config/env";
import { sendWelcomeEmail } from "../../../utils/sendWelcomeEmail";
import { invalidateAdminUsersCache } from "../../../utils/invalidateUserCache";


const refreshToken = async (token: string) => {
    if (!token) {
        throw new AppError(status.UNAUTHORIZED, "Refresh token missing");
    }

    // Reuse detection: Check if the token was already used and blacklisted
    const isRevoked = await isTokenBlacklisted(token);
    if (isRevoked) {
        throw new AppError(
            status.UNAUTHORIZED,
            "Refresh token has expired, been revoked, or already rotated. Please log in again."
        );
    }

    // Verify Refresh token signature & expiry
    const result = JwtTokenUtils.verifyToken(
        token,
        envConfig.REFRESH_TOKEN_SECRET
    );

    if (!result.success || !result.data) {
        throw new AppError(status.UNAUTHORIZED, "Invalid or expired refresh token");
    }

    const decoded = result.data;

    // Check if associated session has been revoked or expired
    if (decoded.sessionToken) {
        const isSessionRevoked = await isTokenBlacklisted(`session:${decoded.sessionToken}`);
        if (isSessionRevoked) {
            throw new AppError(status.UNAUTHORIZED, "Session has been revoked. Please log in again.");
        }

        const activeSession = await prisma.session.findUnique({
            where: { token: decoded.sessionToken as string },
            select: { id: true, expiresAt: true },
        });

        if (!activeSession || activeSession.expiresAt < new Date()) {
            throw new AppError(status.UNAUTHORIZED, "Session has expired or been revoked. Please log in again.");
        }
    }

    const userExists = await prisma.user.findUnique({
        where: { id: decoded.userId as string },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            image: true,
            emailVerified: true,
            isBlocked: true,
            isDeleted: true,
            createdAt: true,
        },
    });

    if (!userExists || userExists.isBlocked || userExists.isDeleted) {
        throw new AppError(status.UNAUTHORIZED, "User account is unavailable or inactive");
    }

    // Invalidate the consumed refresh token to prevent replay attacks (Rotation)
    const nowSeconds = Math.floor(Date.now() / 1000);
    const remainingSeconds = decoded.exp ? Math.max(60, decoded.exp - nowSeconds) : 7 * 24 * 3600;
    await blacklistToken(token, remainingSeconds);

    // Common payload for new tokens
    const tokenPayload = {
        userId: userExists.id,
        email: userExists.email,
        role: userExists.role,
        image: userExists.image,
        emailVerified: userExists.emailVerified,
        createdAt: userExists.createdAt,
        sessionToken: decoded.sessionToken,
    };

    // Rotate: generate fresh access token and fresh refresh token
    const newAccessToken = tokenUtils.getAccessToken(tokenPayload);
    const newRefreshToken = tokenUtils.getRefreshToken(tokenPayload);

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
            id: userExists.id,
            email: userExists.email,
            name: userExists.name,
            role: userExists.role,
            image: userExists.image,
        },
    };
};
const register = async (payload: IRegisterInput) => {
    if (!payload.email || !payload.password || !payload.name) {
        throw new AppError(status.BAD_REQUEST, "Name, Email and Password are required");
    }
    if (await isTempEmail(payload.email)) {
        throw new AppError(status.BAD_REQUEST, "Temporary emails are not allowed");
    }
    const existingUser = await prisma.user.findUnique({
        where: { email: payload.email }
    });

    if (existingUser) {
        throw new AppError(status.CONFLICT, "User already exists with this email");
    }

    const data = await auth.api.signUpEmail({
        body: {
            name: payload.name,
            email: payload.email,
            password: payload.password,
        }
    });

    if (!data.user) {
        throw new AppError(status.BAD_REQUEST, "User not created");
    }

    await auth.api.sendVerificationOTP({
        body: {
            email: payload.email,
            type: "email-verification"
        }
    });
    // const tokenPayload = {
    //     userId: data.user.id,
    //     email: data.user.email,
    //     role: payload.role || Role.CUSTOMER,
    //     image: data.user.image,
    //     createdAt: data.user.createdAt,
    //     emailVerified: data.user.emailVerified,
    // };

    // const accessToken = tokenUtils.getAccessToken(tokenPayload);
    // const refreshToken = tokenUtils.getRefreshToken(tokenPayload);
    // const sessionToken = data.token;

    return {
        user: data.user,
        // accessToken,
        // refreshToken,
        // sessionToken,
    };
};


const loginUser = async (payload: ILoginInput) => {
    const existingUser = await prisma.user.findUnique({
        where: { email: payload.email as string },
        select: {
            id: true,
            email: true,
            isBlocked: true,
            isDeleted: true,
            failedLoginAttempts: true,
            lockedUntil: true,
        },
    });

    if (existingUser?.isBlocked) {
        throw new AppError(status.FORBIDDEN, "Your account has been suspended");
    }
    if (existingUser?.isDeleted) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    const now = new Date();

    // Check account lockout
    if (existingUser?.lockedUntil && existingUser.lockedUntil > now) {
        const remainingMinutes = Math.ceil(
            (existingUser.lockedUntil.getTime() - now.getTime()) / (1000 * 60)
        );
        throw new AppError(
            status.TOO_MANY_REQUESTS,
            `Account is temporarily locked due to multiple failed login attempts. Please try again after ${remainingMinutes} minute(s).`
        );
    }

    let result: any;
    try {
        result = await auth.api.signInEmail({
            body: {
                email: payload.email as string,
                password: payload.password,
            },
            asResponse: false,
        });
    } catch (err: any) {
        if (existingUser) {
            const MAX_FAILED_ATTEMPTS = 5;
            const isLockExpired = existingUser.lockedUntil && existingUser.lockedUntil <= now;
            const currentAttempts = isLockExpired ? 0 : (existingUser.failedLoginAttempts || 0);
            const newAttempts = currentAttempts + 1;
            const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;
            const lockedUntil = shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null;

            await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    failedLoginAttempts: shouldLock ? 0 : newAttempts,
                    lockedUntil,
                },
                select: {
                    id: true,
                    failedLoginAttempts: true,
                    lockedUntil: true,
                },
            });

            if (shouldLock) {
                throw new AppError(
                    status.TOO_MANY_REQUESTS,
                    "Account has been locked for 15 minutes due to 5 consecutive failed login attempts."
                );
            }

            const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
            throw new AppError(
                status.BAD_REQUEST,
                `Invalid Email or Password. You have ${remaining} attempt(s) remaining before account lockout.`
            );
        }

        throw new AppError(status.BAD_REQUEST, "Invalid Email or Password");
    }

    if (!result) {
        throw new AppError(status.BAD_REQUEST, "Invalid Email or Password");
    }

    if (!result.user.emailVerified) {
        await auth.api.sendVerificationOTP({
            body: {
                email: payload.email as string,
                type: "email-verification",
            },
        });

        throw new AppError(
            status.FORBIDDEN,
            "Email not verified. OTP sent to your email."
        );
    }

    // Reset lockout and record lastLoginAt and lastLoginIp
    await prisma.user.update({
        where: { id: result.user.id },
        data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: now,
            ...(payload.ip && { lastLoginIp: payload.ip }),
        },
    });

    const customer = await prisma.user.findUnique({
        where: { id: result.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
        },
    });

    if (!customer) {
        throw new AppError(status.NOT_FOUND, "Customer not found");
    }

    // ─── Enforce Maximum 3 Devices Limit ───
    // Clean up expired sessions for this user first
    await prisma.session.deleteMany({
        where: {
            userId: customer.id,
            expiresAt: { lte: now },
        },
    });

    const activeSessionsCount = await prisma.session.count({
        where: {
            userId: customer.id,
            expiresAt: { gt: now },
        },
    });

    // signInEmail already inserted the new session row into prisma.session.
    // If active sessions count exceeds 3, check if revokeOthers was requested.
    if (activeSessionsCount > 3) {
        if (payload.revokeOthers) {
            // 1. Find all previous sessions of this user (except the newly created current session)
            const oldSessions = await prisma.session.findMany({
                where: {
                    userId: customer.id,
                    NOT: { token: result.token },
                },
                select: { token: true },
            });

            // Blacklist all other session tokens in Redis
            for (const s of oldSessions) {
                if (s.token) {
                    await blacklistToken(`session:${s.token}`, 7 * 24 * 60 * 60);
                }
            }

            // 2. Delete all other sessions from database
            await prisma.session.deleteMany({
                where: {
                    userId: customer.id,
                    NOT: { token: result.token },
                },
            });
        } else {
            // If user hasn't confirmed revokeOthers yet, delete newly created session and throw 403
            if (result.token) {
                await prisma.session.deleteMany({
                    where: { token: result.token },
                });
            }
            throw new AppError(
                status.FORBIDDEN,
                "Maximum 3 devices can be logged in simultaneously. Please log out from another device to continue."
            );
        }
    }

    const tokenPayload = {
        userId: customer.id,
        email: customer.email,
        role: customer.role,
        name: customer.name,
        sessionToken: result.token,
    };

    const accessToken = tokenUtils.getAccessToken(tokenPayload);
    const refreshToken = tokenUtils.getRefreshToken(tokenPayload);
    const sessionToken = result.token;

    return {
        user: customer,
        accessToken,
        refreshToken,
        sessionToken,
    };
};

const logout = async (accessToken: string, sessionToken: string) => {
    //  Access token decode করো — expire time বের করো
    if (accessToken) {
        const decoded = JwtTokenUtils.decodedToken(accessToken);
        if (decoded && decoded.exp) {
            const now = Math.floor(Date.now() / 1000);
            const expiresIn = decoded.exp - now; // বাকি seconds

            if (expiresIn > 0) {
                await blacklistToken(accessToken, expiresIn); // ← Redis এ রাখো
            }
        }
    }

    if (sessionToken) {
        // Blacklist session in Redis
        await blacklistToken(`session:${sessionToken}`, 7 * 24 * 60 * 60);

        // Delete from Prisma Session table
        await prisma.session.deleteMany({
            where: { token: sessionToken },
        });

        //  BetterAuth session revoke করো
        try {
            await auth.api.revokeSession({
                body: {
                    token: sessionToken
                },
                headers: {
                    authorization: `Bearer ${sessionToken} `
                }
            });
        } catch (e) {
            // ignore if already deleted
        }
    }
};
const sendOtp = async (email: string) => {
    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (user.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Email already verified");
    }
    await auth.api.sendVerificationOTP({
        body: {
            email,
            type: "email-verification"
        }
    });

    return null;
};
const verifyEmail = async (otp: string, email: string) => {
    const result = await auth.api.verifyEmailOTP({
        body: { email, otp }
    });

    if (!result.status) {
        throw new AppError(status.BAD_REQUEST, "Invalid or expired OTP");
    }

    const user = await prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            emailVerified: true,
        }
    });
    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }
    await sendWelcomeEmail(user.name, user.email, user.role);

    // Enforce 3 device limit
    const now = new Date();
    await prisma.session.deleteMany({
        where: {
            userId: result.user.id,
            expiresAt: { lte: now },
        },
    });

    const activeSessionsCount = await prisma.session.count({
        where: {
            userId: result.user.id,
            expiresAt: { gt: now },
        },
    });

    if (activeSessionsCount > 3) {
        if (result.token) {
            await prisma.session.deleteMany({
                where: { token: result.token },
            });
        }
        throw new AppError(
            status.FORBIDDEN,
            "Maximum 3 devices can be logged in simultaneously. Please log out from another device to continue."
        );
    }

    const tokenPayload = {
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role || Role.CUSTOMER,
        emailVerified: true,
        sessionToken: result.token,
    };

    const accessToken = tokenUtils.getAccessToken(tokenPayload);
    const refreshToken = tokenUtils.getRefreshToken(tokenPayload);
    const sessionToken = result.token; // ← BetterAuth session token

    return {
        user: result.user,
        accessToken,
        refreshToken,
        sessionToken,
    };
};

const forgotPassword = async (email: string) => {
    const userExits = await prisma.user.findUnique({
        where: {
            email
        }
    })
    if (!userExits) {
        throw new AppError(status.NOT_FOUND, "User not found")
    }
    if (!userExits.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Eamil Not Verfied")
    }
    await auth.api.requestPasswordResetEmailOTP({
        body: {
            email
        }
    })
    return { message: "OTP sent to your email" };
}
const resetPassword = async (email: string, otp: string, newPassword: string) => {
    const userExits = await prisma.user.findUnique({
        where: { email }
    });

    if (!userExits) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (!userExits.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Email Not Verified");
    }

    await auth.api.resetPasswordEmailOTP({
        body: {
            email,
            otp,
            password: newPassword
        }
    });

    await prisma.user.update({
        where: { id: userExits.id },
        data: {
            passwordChangedAt: new Date(),
            failedLoginAttempts: 0,
            lockedUntil: null,
        },
    });

    await prisma.session.deleteMany({
        where: { userId: userExits.id }
    });
    try {
        await sendEmail({
            to: email,
            subject: "Password Changed Successfully - FreightAgent",
            templateName: "passwordChanged", // ← নতুন template
            templateData: {
                name: userExits.name ?? "User",
                email: userExits.email,
                time: new Date().toLocaleString("en-US", {
                    timeZone: "Asia/Dhaka",
                    dateStyle: "medium",
                    timeStyle: "short",
                }),
            },
        });
    } catch (error) {
        console.error("Email failed:", error);
    }
};
// Send OTP
const sendChangePasswordOTP = async (user: IRequestUser) => {
    const userExists = await prisma.user.findUnique({
        where: { id: user.userId }
    });

    if (!userExists) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    await auth.api.sendVerificationOTP({
        body: {
            email: userExists.email,
            type: "forget-password" // ← এটাই use করো
        }
    });
};

// Verify OTP + Change Password
const changePassword = async (payload: IChangePassword, user: IRequestUser) => {
    const userExists = await prisma.user.findUnique({
        where: { id: user.userId }
    });

    if (!userExists) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    try {
        await auth.api.resetPasswordEmailOTP({
            body: {
                email: userExists.email,
                otp: payload.otp,
                password: payload.newPassword
            }
        });
    } catch (error: any) {
        throw new AppError(status.BAD_REQUEST, "Invalid or expired OTP");
    }

    await prisma.user.update({
        where: { id: user.userId },
        data: {
            passwordChangedAt: new Date(),
            failedLoginAttempts: 0,
            lockedUntil: null,
        },
    });

    await prisma.session.deleteMany({
        where: { userId: user.userId }
    });

    const tokenPayload = {
        userId: user.userId,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,

    };

    const accessToken = tokenUtils.getAccessToken(tokenPayload);
    const refreshToken = tokenUtils.getRefreshToken(tokenPayload);

    await sendEmail({
        to: userExists.email,
        subject: "Password Changed Successfully - FreightAgent",
        templateName: "passwordChanged",
        templateData: {
            name: userExists.name ?? "User",
            email: userExists.email,
            time: new Date().toLocaleString("en-US", {
                timeZone: "Asia/Dhaka",
                dateStyle: "medium",
                timeStyle: "short",
            }),
        },
    });

    return { accessToken, refreshToken };
};
const createAdmin = async (payload: IRegisterInput) => {
    if (!payload.email || !payload.password || !payload.name) {
        throw new AppError(status.BAD_REQUEST, "Name, Email and Password are required");
    }
    if (await isTempEmail(payload.email)) {
        throw new AppError(status.BAD_REQUEST, "Temporary emails are not allowed");
    }
    const existingUser = await prisma.user.findUnique({
        where: { email: payload.email }
    });

    if (existingUser) {
        throw new AppError(status.CONFLICT, "User already exists with this email");
    }
    const adminData = await auth.api.signUpEmail({
        body: {
            email: payload.email,
            name: payload.name,
            password: payload.password,
        }
    });

    await prisma.user.update({
        where: { email: payload.email },
        data: { role: Role.ADMIN }
    });
    if (!adminData.user) {
        throw new AppError(status.BAD_REQUEST, "User not created");
    }
    await auth.api.sendVerificationOTP({
        body: {
            email: payload.email,
            type: "email-verification"
        }
    });
    console.log(adminData);
    await invalidateAdminUsersCache();
    return {
        adminData
    };

}
const createAgent = async (payload: ICreateAgentInput) => {
    if (await isTempEmail(payload.email)) {
        throw new AppError(status.BAD_REQUEST, "Temporary emails are not allowed");
    }
    const existingUser = await prisma.user.findUnique({
        where: { email: payload.email }
    });
    if (existingUser) {
        throw new AppError(status.CONFLICT, "User already exists with this email");
    }
    if (payload.phone) {
        const existingPhone = await prisma.user.findFirst({
            where: { phone: payload.phone, isDeleted: false }
        });
        if (existingPhone) {
            throw new AppError(status.CONFLICT, "Phone number already in use by another account");
        }
    }
    const data = await auth.api.signUpEmail({
        body: {
            name: payload.name,
            email: payload.email,
            password: payload.password,
        }
    });
    if (!data.user) {
        throw new AppError(status.BAD_REQUEST, "Agent not created");
    }
    await prisma.user.update({
        where: { id: data.user.id },
        data: {
            role: Role.AGENT,
            phone: payload.phone,
        }
    });
    await auth.api.sendVerificationOTP({
        body: {
            email: payload.email,
            type: "email-verification"
        }
    });
    await invalidateAdminUsersCache();
    return {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        phone: payload.phone,
        role: Role.AGENT,
        emailVerified: false,
    };
}
const googleCallback = async (
    googleUser: any,
    requestedRole: Role = Role.CUSTOMER,
    revokeOthers = false
) => {
    const email = googleUser.email;
    const name = googleUser.name;
    const image = googleUser.picture;

    let user = await prisma.user.findUnique({
        where: { email },
        select: {
            id: true, name: true, email: true, role: true,
            emailVerified: true, image: true,
        },
    });

    const isNewUser = !user;

    if (isNewUser) {
        const newUser = await prisma.user.create({
            data: {
                id: crypto.randomUUID(),
                email,
                name: name || email.split("@")[0],
                image: image || null,
                role: requestedRole, //  এখানে CUSTOMER বা AGENT বসবে
                emailVerified: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });

        user = {
            id: newUser.id, name: newUser.name, email: newUser.email,
            role: newUser.role, emailVerified: newUser.emailVerified, image: newUser.image,
        };

        try {
            await sendWelcomeEmail(user.name, user.email, user.role);
        } catch (err) {
            console.error("Welcome email failed:", err);
        }
    }
    // ⚠️ existing user হলে role change করা হচ্ছে না ইচ্ছাকৃতভাবে —
    // security ঝুঁকি: কেউ existing customer একাউন্টে "agent google" লিংক দিয়ে
    // ঢুকে নিজেকে agent বানিয়ে ফেলতে পারবে না।

    if (!user) throw new AppError(status.NOT_FOUND, "User not found");

    //  Better-Auth Account link (যদি না থাকে)
    const googleId = googleUser.id || googleUser.sub;
    if (googleId) {
        try {
            const existingAccount = await prisma.account.findFirst({
                where: { providerId: "google", userId: user.id }
            });
            if (!existingAccount) {
                await prisma.account.create({
                    data: {
                        id: crypto.randomUUID(),
                        accountId: String(googleId),
                        providerId: "google",
                        userId: user.id,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    }
                });
            }
        } catch (accErr) {
            console.error("Account linking error:", accErr);
        }
    }

    // Enforce 3 device limit before creating session
    const now = new Date();
    await prisma.session.deleteMany({
        where: {
            userId: user.id,
            expiresAt: { lte: now },
        },
    });

    const activeSessionsCount = await prisma.session.count({
        where: {
            userId: user.id,
            expiresAt: { gt: now },
        },
    });

    if (activeSessionsCount >= 3) {
        if (revokeOthers) {
            // 1. Blacklist old sessions in Redis
            const oldSessions = await prisma.session.findMany({
                where: { userId: user.id },
                select: { token: true },
            });
            for (const s of oldSessions) {
                if (s.token) {
                    await blacklistToken(`session:${s.token}`, 7 * 24 * 60 * 60);
                }
            }

            // 2. Delete all previous sessions from database
            await prisma.session.deleteMany({
                where: { userId: user.id },
            });
        } else {
            throw new AppError(
                status.FORBIDDEN,
                "Maximum 3 devices can be logged in simultaneously. Please log out from another device to continue."
            );
        }
    }

    //  Better-Auth Session তৈরি করো (যাতে Better-Auth getSession() সফল হয়)
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.session.create({
        data: {
            id: crypto.randomUUID(),
            userId: user.id,
            token: sessionToken,
            expiresAt: sessionExpiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    });

    await prisma.user.update({
        where: { id: user.id },
        data: {
            lastLoginAt: new Date(),
            failedLoginAttempts: 0,
            lockedUntil: null,
        },
    });

    const tokenPayload = {
        userId: user.id, email: user.email, role: user.role,
        name: user.name, emailVerified: user.emailVerified, image: user.image,
        sessionToken,
    };

    const accessToken = tokenUtils.getAccessToken(tokenPayload);
    const refreshToken = tokenUtils.getRefreshToken(tokenPayload);

    return { user, accessToken, refreshToken, sessionToken, isNewUser };
};

export const authService = {
    refreshToken,
    register,
    loginUser,
    logout,
    sendOtp,
    verifyEmail,
    forgotPassword,
    resetPassword,
    changePassword,
    sendChangePasswordOTP,
    createAdmin,
    createAgent,
    googleCallback
};