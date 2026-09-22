import status from "http-status";
import AppError from "../../../errorHelper/AppError";
import { prisma } from "../../../lib/prisma";
import {
    IGetUserQuery,
    IRoleUpdate,
    IUserStatusUpdate,
    IRoadAgentQuery,
    IAssignRoadAgent,
    IAdminSessionsQuery,
} from "./admin.interface";
import { IRequestUser } from "../../interface/requestUserInterface";
import { Prisma, Role, ShipmentStatus } from "../../../generated/prisma";
import { sendEmail } from "../../../utils/email";
import { redis } from "../../../lib/redis";
import { invalidateAdminUsersCache } from "../../../utils/invalidateUserCache";
import { invalidateShipmentCache } from "../../../utils/invalidateShipmentCache";
import { invalidateRoadAgentsCache, invalidateAgentCache } from "../../../utils/invalidateAgentCache";
import { blacklistToken } from "../../../utils/tokenBlacklist";
import { notifyAgent, notifyCustomer, notifyAdmin } from "../../../lib/socket";
import { envConfig } from "../../../_config/env";
import { parseUserAgent } from "../../../utils/deviceDetector";
import { auth } from "../../../lib/auth";

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
            customerShipments: {
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

    const now = new Date();

    // Clean up expired sessions for this user
    await prisma.session.deleteMany({
        where: {
            userId: id,
            expiresAt: { lte: now },
        },
    });

    const rawSessions = await prisma.session.findMany({
        where: {
            userId: id,
            expiresAt: { gt: now },
        },
        select: {
            id: true,
            userAgent: true,
            deviceName: true,
            deviceType: true,
            browser: true,
            os: true,
            ipAddress: true,
            createdAt: true,
            expiresAt: true,
            updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
    });

    const sessions = rawSessions.map((session) => {
        const detected = parseUserAgent(session.userAgent);
        return {
            id: session.id,
            deviceName: session.deviceName || detected.deviceName,
            deviceType:
                (session.deviceType as "desktop" | "mobile" | "tablet") ||
                detected.deviceType,
            browser: session.browser || detected.browser,
            os: session.os || detected.os,
            ipAddress: session.ipAddress || "127.0.0.1",
            userAgent: session.userAgent,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            lastActiveAt: session.updatedAt,
        };
    });

    const sessionBreakdown = {
        total: sessions.length,
        mobile: sessions.filter((s) => s.deviceType === "mobile").length,
        tablet: sessions.filter((s) => s.deviceType === "tablet").length,
        desktop: sessions.filter((s) => s.deviceType === "desktop").length,
    };

    const result = {
        user: {
            ...user,
            shipments: user.customerShipments,
            sessions,
            sessionBreakdown,
        },
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

const getRoadAgents = async (query: IRoadAgentQuery) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const area = query.area || "all";
    const isAvailable = query.isAvailable !== undefined ? String(query.isAvailable) : "all";
    const search = query.search || "none";
    const cacheKey = `admin:agents:${page}:${limit}:${area}:${isAvailable}:${search}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            return typeof cached === "string" ? JSON.parse(cached) : cached;
        } catch (e) {
            await redis.del(cacheKey);
        }
    }

    const where: Prisma.UserWhereInput = {
        role: Role.AGENT,
        isDeleted: false,
    };

    if (query.area) {
        where.assignedArea = {
            contains: query.area,
            mode: "insensitive",
        };
    }

    if (query.isAvailable !== undefined) {
        const isAvail = query.isAvailable === true || query.isAvailable === "true";
        where.isAvailable = isAvail;
    }

    if (query.search) {
        where.OR = [
            { name: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
            { phone: { contains: query.search, mode: "insensitive" } },
            { assignedArea: { contains: query.search, mode: "insensitive" } },
        ];
    }

    const [agents, total] = await Promise.all([
        prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
                assignedArea: true,
                isAvailable: true,
                isBlocked: true,
                createdAt: true,
                _count: {
                    select: {
                        agentShipments: {
                            where: {
                                status: {
                                    in: [
                                        ShipmentStatus.ASSIGNED,
                                        ShipmentStatus.ACCEPTED,
                                        ShipmentStatus.PICKED_UP,
                                        ShipmentStatus.IN_TRANSIT,
                                        ShipmentStatus.AT_CUSTOMS,
                                        ShipmentStatus.OUT_FOR_DELIVERY,
                                    ],
                                },
                            },
                        },
                    },
                },
            },
            orderBy: [{ isAvailable: "desc" }, { createdAt: "desc" }],
            skip,
            take: limit,
        }),
        prisma.user.count({ where }),
    ]);

    const formatted = agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        image: agent.image,
        assignedArea: agent.assignedArea,
        isAvailable: agent.isAvailable,
        isBlocked: agent.isBlocked,
        createdAt: agent.createdAt,
        activeShipmentsCount: agent._count.agentShipments,
    }));

    const result = {
        agents: formatted,
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
    };

    await redis.set(cacheKey, JSON.stringify(result), { ex: 60 });

    return result;
};

const assignRoadAgent = async (
    payload: IAssignRoadAgent,
    adminUser: IRequestUser
) => {
    const shipment = await prisma.shipment.findUnique({
        where: { id: payload.shipmentId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
        },
    });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }

    if (shipment.status === ShipmentStatus.DELIVERED) {
        throw new AppError(
            status.BAD_REQUEST,
            "Cannot assign agent to an already delivered shipment"
        );
    }

    if (shipment.status === ShipmentStatus.CANCELLED) {
        throw new AppError(
            status.BAD_REQUEST,
            "Cannot assign agent to a cancelled shipment"
        );
    }

    const agent = await prisma.user.findFirst({
        where: {
            id: payload.agentId,
            role: Role.AGENT,
            isDeleted: false,
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            assignedArea: true,
            isBlocked: true,
            isAvailable: true,
        },
    });

    if (!agent) {
        throw new AppError(status.NOT_FOUND, "Agent not found or is not an active agent");
    }

    if (agent.isBlocked) {
        throw new AppError(
            status.BAD_REQUEST,
            "Cannot assign a blocked agent to shipment"
        );
    }

    const assignLocation = agent.assignedArea || shipment.origin;
    const assignNote =
        payload.note ||
        `Assigned to road agent ${agent.name} (${agent.assignedArea || "Road Agent"}) by Admin ${adminUser.name}`;

    const [updated] = await prisma.$transaction([
        prisma.shipment.update({
            where: { id: payload.shipmentId },
            data: {
                agentId: agent.id,
                assignedById: adminUser.userId,
                assignedAt: new Date(),
                status: ShipmentStatus.ASSIGNED,
                updateBy: adminUser.userId,
            },
            select: {
                id: true,
                trackingId: true,
                origin: true,
                destination: true,
                weight: true,
                status: true,
                agentId: true,
                assignedById: true,
                assignedAt: true,
                updatedAt: true,
                agent: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        assignedArea: true,
                    },
                },
                assignedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
        }),
        prisma.statusLog.create({
            data: {
                shipmentId: payload.shipmentId,
                status: ShipmentStatus.ASSIGNED,
                location: assignLocation,
                note: assignNote,
                updateBy: adminUser.userId,
            },
        }),
    ]);

    await invalidateShipmentCache();
    await invalidateRoadAgentsCache();
    await invalidateAgentCache(agent.id);

    // ─── 1. Socket.IO Notifications ─────────────────────
    // Notify Agent
    notifyAgent(agent.id, {
        event: "shipment_assigned",
        message: `New road shipment #${shipment.trackingId} assigned to you by Admin ${adminUser.name}`,
        trackingId: shipment.trackingId,
        shipmentId: shipment.id,
        origin: shipment.origin,
        destination: shipment.destination,
        weight: shipment.weight,
        customer: {
            name: shipment.user.name,
            phone: shipment.user.phone,
        },
        assignedBy: {
            name: adminUser.name,
            email: adminUser.email,
        },
    }, "shipment_assigned");

    // Notify Customer
    notifyCustomer(shipment.userId, {
        event: "agent_assigned",
        message: `Road Agent ${agent.name} has been assigned to your shipment #${shipment.trackingId}`,
        trackingId: shipment.trackingId,
        shipmentId: shipment.id,
        agent: {
            id: agent.id,
            name: agent.name,
            email: agent.email,
            phone: agent.phone,
            assignedArea: agent.assignedArea,
        },
        assignedBy: {
            name: adminUser.name,
            email: adminUser.email,
        },
    }, "agent_assigned");

    // Notify Admin Dashboard
    notifyAdmin({
        event: "agent_assigned",
        message: `Admin ${adminUser.name} assigned ${agent.name} to shipment #${shipment.trackingId}`,
        trackingId: shipment.trackingId,
        agentId: agent.id,
        adminId: adminUser.userId,
    });

    // ─── 2. Email Notifications ──────────────────────────
    // Send email to Agent
    try {
        await sendEmail({
            to: agent.email,
            subject: `New Road Shipment Assigned: #${shipment.trackingId} - FreightAgent`,
            templateName: "agentAssigned",
            templateData: {
                agentName: agent.name,
                trackingId: shipment.trackingId,
                origin: shipment.origin,
                destination: shipment.destination,
                weight: shipment.weight,
                description: shipment.description,
                customerName: shipment.user.name,
                customerPhone: shipment.user.phone,
                assignedByName: adminUser.name,
                assignedByEmail: adminUser.email,
                assignedAt: new Date().toLocaleString("en-US", {
                    timeZone: "Asia/Dhaka",
                    dateStyle: "medium",
                    timeStyle: "short",
                }),
                dashboardUrl: envConfig.FRONTEND_URL,
            },
        });
    } catch (err) {
        console.error("Agent assignment email dispatch failed:", err);
    }

    // Send email to Customer
    try {
        await sendEmail({
            to: shipment.user.email,
            subject: `Road Agent Assigned to Your Shipment: #${shipment.trackingId} - FreightAgent`,
            templateName: "customerAgentAssigned",
            templateData: {
                customerName: shipment.user.name,
                trackingId: shipment.trackingId,
                agentName: agent.name,
                agentEmail: agent.email,
                agentPhone: agent.phone,
                assignedArea: agent.assignedArea,
                assignedByName: adminUser.name,
                origin: shipment.origin,
                destination: shipment.destination,
                trackUrl: envConfig.FRONTEND_URL,
            },
        });
    } catch (err) {
        console.error("Customer agent assignment email dispatch failed:", err);
    }

    return updated;
};

const getUserActiveSessions = async (
    userId: string,
    currentUser: IRequestUser
) => {
    if (currentUser.role !== Role.ADMIN) {
        throw new AppError(status.FORBIDDEN, "Only admin can view user sessions");
    }

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
            isBlocked: true,
            lastLoginAt: true,
            lastLoginIp: true,
        },
    });

    if (!targetUser) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    const now = new Date();

    // Clean up expired sessions
    await prisma.session.deleteMany({
        where: {
            userId,
            expiresAt: { lte: now },
        },
    });

    const rawSessions = await prisma.session.findMany({
        where: {
            userId,
            expiresAt: { gt: now },
        },
        select: {
            id: true,
            userAgent: true,
            deviceName: true,
            deviceType: true,
            browser: true,
            os: true,
            ipAddress: true,
            createdAt: true,
            expiresAt: true,
            updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
    });

    const sessions = rawSessions.map((session) => {
        const detected = parseUserAgent(session.userAgent);
        return {
            id: session.id,
            deviceName: session.deviceName || detected.deviceName,
            deviceType:
                (session.deviceType as "desktop" | "mobile" | "tablet") ||
                detected.deviceType,
            browser: session.browser || detected.browser,
            os: session.os || detected.os,
            ipAddress: session.ipAddress || "127.0.0.1",
            userAgent: session.userAgent,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            lastActiveAt: session.updatedAt,
        };
    });

    const breakdown = {
        total: sessions.length,
        mobile: sessions.filter((s) => s.deviceType === "mobile").length,
        tablet: sessions.filter((s) => s.deviceType === "tablet").length,
        desktop: sessions.filter((s) => s.deviceType === "desktop").length,
    };

    return {
        user: targetUser,
        sessions,
        breakdown,
    };
};

const revokeUserSession = async (
    userId: string,
    sessionId: string,
    currentUser: IRequestUser
) => {
    if (currentUser.role !== Role.ADMIN) {
        throw new AppError(status.FORBIDDEN, "Only admin can revoke user sessions");
    }

    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, userId: true, token: true, expiresAt: true },
    });

    if (!session || session.userId !== userId) {
        throw new AppError(status.NOT_FOUND, "Session not found for this user");
    }

    // 1. Blacklist token in Redis
    const ttl = Math.max(
        60,
        Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)
    );
    await blacklistToken(`session:${session.token}`, ttl);

    // 2. Revoke from BetterAuth if applicable
    try {
        await auth.api.revokeSession({
            body: { token: session.token },
            headers: { authorization: `Bearer ${session.token}` },
        });
    } catch (err) {
        // ignore if already deleted or unsupported
    }

    // 3. Delete session record from Prisma
    await prisma.session.deleteMany({
        where: { id: sessionId, userId },
    });

    // Invalidate user detail cache if cached
    await redis.del(`admin:users:detail:${userId}`);

    return { message: "User session revoked successfully" };
};

const revokeAllUserSessions = async (
    userId: string,
    currentUser: IRequestUser
) => {
    if (currentUser.role !== Role.ADMIN) {
        throw new AppError(status.FORBIDDEN, "Only admin can revoke user sessions");
    }

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
    });

    if (!targetUser) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    const activeSessions = await prisma.session.findMany({
        where: { userId },
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
            where: { userId },
        });
    }

    await redis.del(`admin:users:detail:${userId}`);

    return { message: "All sessions for this user revoked successfully" };
};

const getAllActiveSessions = async (
    query: IAdminSessionsQuery,
    currentUser: IRequestUser
) => {
    if (currentUser.role !== Role.ADMIN) {
        throw new AppError(status.FORBIDDEN, "Only admin can view active sessions");
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.SessionWhereInput = {
        expiresAt: { gt: now },
    };

    if (query.deviceType) {
        where.deviceType = query.deviceType;
    }

    if (query.role || query.search) {
        where.user = {};
        if (query.role) {
            where.user.role = query.role;
        }
        if (query.search) {
            const trimmed = query.search.trim();
            where.user.OR = [
                { name: { contains: trimmed, mode: "insensitive" } },
                { email: { contains: trimmed, mode: "insensitive" } },
            ];
        }
    }

    const [rawSessions, total] = await Promise.all([
        prisma.session.findMany({
            where,
            select: {
                id: true,
                userId: true,
                deviceName: true,
                deviceType: true,
                browser: true,
                os: true,
                ipAddress: true,
                userAgent: true,
                createdAt: true,
                expiresAt: true,
                updatedAt: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        image: true,
                        isBlocked: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.session.count({ where }),
    ]);

    const sessions = rawSessions.map((session) => {
        const detected = parseUserAgent(session.userAgent);
        return {
            id: session.id,
            userId: session.userId,
            user: session.user,
            deviceName: session.deviceName || detected.deviceName,
            deviceType:
                (session.deviceType as "desktop" | "mobile" | "tablet") ||
                detected.deviceType,
            browser: session.browser || detected.browser,
            os: session.os || detected.os,
            ipAddress: session.ipAddress || "127.0.0.1",
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            lastActiveAt: session.updatedAt,
        };
    });

    return {
        sessions,
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
    };
};

export const adminService = {
    getAlluser,
    getUserById,
    updateRole,
    updateUserStatus,
    deleteUser,
    getRoadAgents,
    assignRoadAgent,
    getUserActiveSessions,
    revokeUserSession,
    revokeAllUserSessions,
    getAllActiveSessions,
};