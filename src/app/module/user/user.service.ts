// user.service.ts

import status from "http-status";
import { prisma } from "../../../lib/prisma";
import AppError from "../../../errorHelper/AppError";
import { IRequestUser } from "../../interface/requestUserInterface";
import { sendEmail } from "../../../utils/email";
import {
    IUpdateProfilePayload,
    IRequestPhonePayload,
    IVerifyPhonePayload,
} from "./user.interface";
import {
    uploadBufferToCloudinary,
    deleteFromCloudinary,
    extractPublicIdFromUrl,
} from "../../../utils/cloudinary";
import { parseUserAgent } from "../../../utils/deviceDetector";
import { blacklistToken } from "../../../utils/tokenBlacklist";
import { auth } from "../../../lib/auth";

// ─── Constants ────────────────────────────────────────────
const PHONE_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const MAX_CODE_ATTEMPTS = 5;

// ─── Helpers ──────────────────────────────────────────────
const generateSixDigitCode = (): string =>
    Math.floor(100000 + Math.random() * 900000).toString();
const getMe = async (user: IRequestUser) => {
    if (!user) throw new AppError(status.UNAUTHORIZED, "Unauthorized User");

    const existingUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
            phone: true,
            address: true,
            emailVerified: true,
            isBlocked: true,
            isDeleted: true,
            createdAt: true,
            shipments: {
                select: {
                    id: true,
                    trackingId: true,
                    origin: true,
                    destination: true,
                    weight: true,
                    status: true,
                    estimatedDate: true,
                    createdAt: true,
                    statusLogs: {
                        select: {
                            id: true,
                            status: true,
                            location: true,
                            note: true,
                            createdAt: true,
                        },
                        orderBy: { createdAt: "desc" },
                    },
                },
                orderBy: { createdAt: "desc" },
                take: 10,
            },
        },
    });

    if (!existingUser || existingUser.isDeleted)
        throw new AppError(status.NOT_FOUND, "User not found!");
    if (existingUser.isBlocked)
        throw new AppError(status.FORBIDDEN, "Your account has been suspended");
    if (!existingUser.emailVerified)
        throw new AppError(status.FORBIDDEN, "Email not verified");

    return existingUser;
};

// ─── 2. Update Profile ────────────────────────────────────
const updateProfile = async (
    user: IRequestUser,
    payload: IUpdateProfilePayload,
    file?: Express.Multer.File
) => {
    if (!user) throw new AppError(status.UNAUTHORIZED, "Unauthorized User");

    const existingUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { id: true, image: true, emailVerified: true, isBlocked: true, isDeleted: true },
    });

    if (!existingUser || existingUser.isDeleted)
        throw new AppError(status.NOT_FOUND, "User not found!");
    if (existingUser.isBlocked)
        throw new AppError(status.FORBIDDEN, "Your account has been suspended");
    if (!existingUser.emailVerified)
        throw new AppError(status.FORBIDDEN, "Email not verified");

    let imageUrl = payload.image;

    if (file) {
        const uploadResult = await uploadBufferToCloudinary(
            file.buffer,
            "freightagent/avatars"
        );
        imageUrl = uploadResult.secure_url;

        // Clean up previous Cloudinary avatar if it exists
        if (existingUser.image) {
            const oldPublicId = extractPublicIdFromUrl(existingUser.image);
            if (oldPublicId) {
                await deleteFromCloudinary(oldPublicId);
            }
        }
    }

    const updatedUser = await prisma.user.update({
        where: { id: user.userId },
        data: {
            ...(payload.name && { name: payload.name }),
            ...(imageUrl && { image: imageUrl }),
            ...(payload.address && { address: payload.address }),
        },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            address: true,
            updatedAt: true,
        },
    });

    return updatedUser;
};

// ─── 3. Upload Avatar Only ────────────────────────────────
const uploadAvatar = async (
    user: IRequestUser,
    file?: Express.Multer.File
) => {
    if (!user) throw new AppError(status.UNAUTHORIZED, "Unauthorized User");
    if (!file) throw new AppError(status.BAD_REQUEST, "Please provide an image file");

    const existingUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { id: true, image: true, isBlocked: true, isDeleted: true },
    });

    if (!existingUser || existingUser.isDeleted)
        throw new AppError(status.NOT_FOUND, "User not found!");
    if (existingUser.isBlocked)
        throw new AppError(status.FORBIDDEN, "Your account has been suspended");

    const uploadResult = await uploadBufferToCloudinary(
        file.buffer,
        "freightagent/avatars"
    );

    if (existingUser.image) {
        const oldPublicId = extractPublicIdFromUrl(existingUser.image);
        if (oldPublicId) {
            await deleteFromCloudinary(oldPublicId);
        }
    }

    const updatedUser = await prisma.user.update({
        where: { id: user.userId },
        data: { image: uploadResult.secure_url },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            updatedAt: true,
        },
    });

    return updatedUser;
};

// ─── 3. Request Phone Verification ───────────────────────
const requestPhoneVerification = async (
    user: IRequestUser,
    payload: IRequestPhonePayload
) => {
    if (!user) throw new AppError(status.UNAUTHORIZED, "Unauthorized User");

    const existingUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            emailVerified: true,
            isBlocked: true,
            isDeleted: true,
        },
    });

    if (!existingUser || existingUser.isDeleted)
        throw new AppError(status.NOT_FOUND, "User not found!");
    if (existingUser.isBlocked)
        throw new AppError(status.FORBIDDEN, "Your account has been suspended");
    if (!existingUser.emailVerified)
        throw new AppError(status.FORBIDDEN, "Email not verified");

    // Check if phone number is already registered by another account
    const phoneTaken = await prisma.user.findFirst({
        where: {
            phone: payload.phone,
            id: { not: user.userId },
        },
        select: { id: true },
    });

    if (phoneTaken)
        throw new AppError(status.CONFLICT, "Phone number already in use");

    // Delete existing pending unverified requests for this user
    await prisma.phoneVerification.deleteMany({
        where: {
            userId: user.userId,
            verified: false,
        },
    });

    const code = generateSixDigitCode();
    const expiresAt = new Date(Date.now() + PHONE_CODE_EXPIRY);

    await prisma.phoneVerification.create({
        data: {
            userId: user.userId,
            phone: payload.phone,
            code,
            expiresAt,
        },
    });

    // Send verification code to user's registered email
    await sendEmail({
        to: existingUser.email,
        subject: "Phone Number Verification Code - FreightAgent",
        templateName: "otp",
        templateData: {
            name: existingUser.name ?? "User",
            title: "Verify Phone Number",
            message: `Use the OTP below to verify and link your phone number (${payload.phone}) to your FreightAgent account.`,
            otp: code,
        },
    });

    return { message: "Verification code sent to your email" };
};

// ─── 4. Verify Phone & Save ───────────────────────────────
const verifyAndSavePhone = async (
    user: IRequestUser,
    payload: IVerifyPhonePayload
) => {
    if (!user) throw new AppError(status.UNAUTHORIZED, "Unauthorized User");

    const verification = await prisma.phoneVerification.findFirst({
        where: {
            userId: user.userId,
            phone: payload.phone,
            verified: false,
        },
    });

    if (!verification)
        throw new AppError(status.NOT_FOUND, "No pending verification found");

    // Expiry check
    if (verification.expiresAt < new Date()) {
        await prisma.phoneVerification.delete({ where: { id: verification.id } });
        throw new AppError(status.GONE, "Verification code has expired");
    }

    // Brute force threshold check
    if (verification.attempts >= MAX_CODE_ATTEMPTS) {
        await prisma.phoneVerification.delete({ where: { id: verification.id } });
        throw new AppError(
            status.TOO_MANY_REQUESTS,
            "Too many attempts. Request a new code"
        );
    }

    // Code matching check
    if (verification.code !== payload.code) {
        await prisma.phoneVerification.update({
            where: { id: verification.id },
            data: { attempts: { increment: 1 } },
        });
        const remaining = MAX_CODE_ATTEMPTS - (verification.attempts + 1);
        throw new AppError(
            status.BAD_REQUEST,
            `Invalid code. ${remaining} attempt(s) remaining`
        );
    }

    // Correct code: persist in an atomic transaction
    const [updatedUser] = await prisma.$transaction([
        prisma.user.update({
            where: { id: user.userId },
            data: { phone: payload.phone },
            select: { id: true, name: true, email: true, phone: true },
        }),
        prisma.phoneVerification.update({
            where: { id: verification.id },
            data: { verified: true },
        }),
    ]);

    return updatedUser;
};

// ─── 5. Get Active Sessions ───────────────────────────────
const getActiveSessions = async (
    user: IRequestUser,
    currentSessionToken?: string
) => {
    if (!user) throw new AppError(status.UNAUTHORIZED, "Unauthorized User");

    const now = new Date();

    // Clean up expired sessions for this user
    await prisma.session.deleteMany({
        where: {
            userId: user.userId,
            expiresAt: { lte: now },
        },
    });

    const rawSessions = await prisma.session.findMany({
        where: {
            userId: user.userId,
            expiresAt: { gt: now },
        },
        select: {
            id: true,
            token: true,
            userAgent: true,
            deviceName: true,
            deviceType: true,
            browser: true,
            os: true,
            ipAddress: true,
            isCurrent: true,
            createdAt: true,
            expiresAt: true,
        },
        orderBy: { createdAt: "desc" },
    });

    const sessions = rawSessions.map((session) => {
        const detected = parseUserAgent(session.userAgent);
        const isCurrent =
            Boolean(currentSessionToken && session.token === currentSessionToken) ||
            Boolean(session.isCurrent);

        return {
            id: session.id,
            deviceName: session.deviceName || detected.deviceName,
            deviceType:
                (session.deviceType as "desktop" | "mobile" | "tablet") ||
                detected.deviceType,
            browser: session.browser || detected.browser,
            os: session.os || detected.os,
            ipAddress: session.ipAddress || "127.0.0.1",
            isCurrent,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
        };
    });

    const breakdown = {
        total: sessions.length,
        mobile: sessions.filter((s) => s.deviceType === "mobile").length,
        tablet: sessions.filter((s) => s.deviceType === "tablet").length,
        desktop: sessions.filter((s) => s.deviceType === "desktop").length,
    };

    return { sessions, breakdown };
};

// ─── 6. Revoke Session ────────────────────────────────────
const revokeSession = async (
    user: IRequestUser,
    sessionId: string,
    currentSessionToken?: string
) => {
    if (!user) throw new AppError(status.UNAUTHORIZED, "Unauthorized User");

    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, userId: true, isCurrent: true, token: true },
    });

    if (!session) {
        throw new AppError(status.NOT_FOUND, "Session not found");
    }
    if (session.userId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "Cannot revoke another user's session");
    }
    if (currentSessionToken && session.token === currentSessionToken) {
        throw new AppError(
            status.BAD_REQUEST,
            "Cannot revoke your current session. Please use logout instead."
        );
    }

    // 1. Blacklist session token in Redis so any requests on that device immediately fail with 401
    await blacklistToken(`session:${session.token}`, 7 * 24 * 60 * 60);

    // 2. Revoke from BetterAuth if available
    try {
        await auth.api.revokeSession({
            body: { token: session.token },
            headers: { authorization: `Bearer ${session.token}` },
        });
    } catch (err) {
        // ignore if already deleted or unsupported
    }

    // 3. Delete session record from Prisma (deleteMany avoids P2025 error if BetterAuth already removed it)
    await prisma.session.deleteMany({
        where: {
            id: sessionId,
            userId: user.userId,
        },
    });

    return { message: "Session revoked successfully" };
};

export const userService = {
    getMe,
    updateProfile,
    uploadAvatar,
    requestPhoneVerification,
    verifyAndSavePhone,
    getActiveSessions,
    revokeSession,
};