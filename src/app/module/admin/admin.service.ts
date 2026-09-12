import status from "http-status";
import AppError from "../../../errorHelper/AppError";
import { prisma } from "../../../lib/prisma";
import { IGetUserQuery, IRoleUpdate, IUserStatusUpdate } from "./admin.interface"
import { IRequestUser } from "../../interface/requestUserInterface";
import { Prisma, Role } from "../../../generated/prisma";
import { sendEmail } from "../../../utils/email";
import { redis } from "../../../lib/redis";
import { invalidateAdminUsersCache } from "../../../utils/invalidateUserCache";
import { blacklistToken } from "../../../utils/tokenBlacklist";

const USER_CACHE_TTL = 10 * 60; // 10 minutes in seconds

const getAlluser = async (query: IGetUserQuery) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const role = query.role || "ALL";
    const search = (query.search || "none").trim().toLowerCase();
    const cacheKey = `admin:users:${page}:${limit}:${role}:${search}`;

    // 1. Check Redis cache
    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            return typeof cached === "string" ? JSON.parse(cached) : cached;
        } catch (e) {
            await redis.del(cacheKey);
        }
    }

    // 2. Fetch from Database on cache miss
    const where: Prisma.UserWhereInput = {};

    if (query.role) {
        where.role = query.role;
    }
    if (query.search) {
        where.OR = [
            {
                name: {
                    contains: query.search,
                    mode: "insensitive",
                },
            },
            {
                email: {
                    contains: query.search,
                    mode: "insensitive",
                },
            },
        ];
    }
    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                image: true,
                emailVerified: true,
                isBlocked: true,
                lastLoginAt: true,
                lastLoginIp: true,
                failedLoginAttempts: true,
                lockedUntil: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: "desc",
            },
            skip,
            take: limit,
        }),
        prisma.user.count({
            where,
        }),
    ]);

    const result = {
        users,
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
    };

    // 3. Store in Redis with 10-minute TTL
    await redis.set(cacheKey, JSON.stringify(result), { ex: USER_CACHE_TTL });

    return result;
};
const getUserById = async (id: string, currentUser: IRequestUser) => {
    if (currentUser.role !== Role.ADMIN) {
        throw new AppError(status.FORBIDDEN, "Only admin can access this");
    }

    const cacheKey = `admin:users:detail:${id}`;

    // 1. Check Redis cache
    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            return typeof cached === "string" ? JSON.parse(cached) : cached;
        } catch (e) {
            await redis.del(cacheKey);
        }
    }

    const user = await prisma.user.findUnique({
        where: {
            id,
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
            address: true,
            phone: true,
            emailVerified: true,
            isBlocked: true,
            blockedReason: true,
            blockedAt: true,
            lastLoginAt: true,
            lastLoginIp: true,
            passwordChangedAt: true,
            failedLoginAttempts: true,
            lockedUntil: true,
            createdAt: true,
            shipments: {
                select: {
                    id: true,
                    userId: true,
                    trackingId: true,
                    status: true,
                    description: true,
                    destination: true,
                    estimatedDate: true,
                    origin: true,
                    weight: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 10,
            },
        },
    });

    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    const result = {
        user,
    };

    // 2. Store in Redis cache for 10 minutes
    await redis.set(cacheKey, JSON.stringify(result), { ex: USER_CACHE_TTL });

    return result;
};
const updateRole = async (payload: IRoleUpdate, currentUser: IRequestUser) => {
    if (currentUser.role !== Role.ADMIN) {
        throw new AppError(status.FORBIDDEN, "Only admin can update role");
    }
    const user = await prisma.user.findUnique({
        where: { id: payload.id },
    });
    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }
    if (user.role === payload.role) {
        throw new AppError(status.BAD_REQUEST, `User is already ${payload.role}`);
    }
    if (payload.id === currentUser.userId) {
        throw new AppError(status.BAD_REQUEST, "You cannot change your own role");
    }
    const updated = await prisma.user.update({
        where: { id: payload.id },
        data: { role: payload.role },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
        },
    });
    try {
        await sendEmail({
            to: user.email,
            subject: "Your Role Has Been Updated - FreightAgent",
            templateName: "roleUpdate",
            templateData: {
                name: user.name,
                previousRole: user.role,
                newRole: payload.role,
                time: new Date().toLocaleString("en-US", {
                    timeZone: "Asia/Dhaka",
                    dateStyle: "medium",
                    timeStyle: "short",
                }),
            },
        });
    } catch (error) {
        console.error("Role update email failed:", error);
    }
    await invalidateAdminUsersCache();
    return updated;
};
const deleteUser = async (id: string, currentUser: IRequestUser) => {
    if (currentUser.role !== Role.ADMIN) {
        throw new AppError(status.FORBIDDEN, "Only admin can delete user");
    }

    const user = await prisma.user.findUnique({
        where: { id },
    });

    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }
    if (id === currentUser.userId) {
        throw new AppError(status.BAD_REQUEST, "You cannot delete yourself");
    }

    if (user.role === Role.ADMIN) {
        throw new AppError(status.FORBIDDEN, "Cannot delete an admin user");
    }
    await prisma.$transaction([
        prisma.statusLog.deleteMany({
            where: { shipment: { userId: id } }
        }),
        prisma.shipment.deleteMany({ where: { userId: id } }),
        prisma.session.deleteMany({ where: { userId: id } }),
        prisma.account.deleteMany({ where: { userId: id } }),
        prisma.user.delete({ where: { id } }),
    ]);

    await invalidateAdminUsersCache();

    return { message: "User deleted successfully" };
};

const updateUserStatus = async (
    payload: IUserStatusUpdate,
    currentUser: IRequestUser
) => {
    if (currentUser.role !== Role.ADMIN) {
        throw new AppError(status.FORBIDDEN, "Only admin can update user status");
    }

    const user = await prisma.user.findUnique({
        where: { id: payload.id },
    });

    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (payload.id === currentUser.userId) {
        throw new AppError(
            status.BAD_REQUEST,
            "You cannot modify your own account status"
        );
    }

    if (user.role === Role.ADMIN) {
        throw new AppError(
            status.FORBIDDEN,
            "Cannot modify the status of an admin account"
        );
    }

    const isSuspending =
        payload.isBlocked !== undefined
            ? payload.isBlocked
            : (payload.status === "BLOCKED" || payload.status === "SUSPENDED");

    if (isSuspending === user.isBlocked) {
        throw new AppError(
            status.BAD_REQUEST,
            isSuspending
                ? "User is already suspended"
                : "User is already active"
        );
    }

    if (isSuspending) {
        const reasonText =
            payload.reason?.trim() ||
            payload.blockedReason?.trim() ||
            "Violation of platform terms of service and security policies";
        const now = new Date();

        // 1. Update user record in Database
        const updated = await prisma.user.update({
            where: { id: payload.id },
            data: {
                isBlocked: true,
                blockedReason: reasonText,
                blockedAt: now,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isBlocked: true,
                blockedReason: true,
                blockedAt: true,
            },
        });

        // 2. Terminate and blacklist all active sessions immediately
        const activeSessions = await prisma.session.findMany({
            where: { userId: payload.id },
            select: { token: true, expiresAt: true },
        });

        if (activeSessions.length > 0) {
            const currentTime = Date.now();
            await Promise.all(
                activeSessions.map((session) => {
                    const ttl = Math.max(
                        60,
                        Math.floor((session.expiresAt.getTime() - currentTime) / 1000)
                    );
                    return blacklistToken(`session:${session.token}`, ttl);
                })
            );

            await prisma.session.deleteMany({
                where: { userId: payload.id },
            });
        }

        // 3. Dispatch suspension notification email
        try {
            const formattedTime = now.toLocaleString("en-US", {
                timeZone: "Asia/Dhaka",
                dateStyle: "medium",
                timeStyle: "short",
            });

            await sendEmail({
                to: user.email,
                subject: "Your Account Has Been Suspended - FreightAgent",
                templateName: "accountSuspended",
                templateData: {
                    name: user.name,
                    email: user.email,
                    reason: reasonText,
                    time: formattedTime,
                },
            });
        } catch (error) {
            console.error("Suspension email dispatch failed:", error);
        }

        // 4. Invalidate Redis admin users cache
        await invalidateAdminUsersCache();

        return updated;
    } else {
        // Reactivating / Unblocking user
        const updated = await prisma.user.update({
            where: { id: payload.id },
            data: {
                isBlocked: false,
                blockedReason: null,
                blockedAt: null,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isBlocked: true,
                blockedReason: true,
                blockedAt: true,
            },
        });

        // Invalidate Redis admin users cache
        await invalidateAdminUsersCache();

        return updated;
    }
};

export const adminService = {
    getAlluser,
    getUserById,
    updateRole,
    updateUserStatus,
    deleteUser
}