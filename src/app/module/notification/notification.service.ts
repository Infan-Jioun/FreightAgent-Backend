import { prisma } from "../../../lib/prisma";
import { emitToRole, emitToUser } from "../../../lib/socket";
import { NotificationType, Prisma } from "../../../generated/prisma";
import {
    ICreateNotificationPayload,
    IBroadcastNotificationPayload,
    IGetNotificationQuery,
} from "./notification.interface";
import AppError from "../../../errorHelper/AppError";
import status from "http-status";

/**
 * Persists and broadcasts a real-time notification to a specific user.
 */
const createAndSendNotification = async (payload: ICreateNotificationPayload) => {
    const { userId, title, message, type = NotificationType.GENERAL, link, data } = payload;

    try {
        const notification = await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
                link: link ?? null,
                data: data ? (data as Prisma.InputJsonValue) : Prisma.JsonNull,
            },
        });

        // Calculate active unread count
        const unreadCount = await prisma.notification.count({
            where: { userId, isRead: false },
        });

        // 1. Instant delivery to user's private socket room
        emitToUser(userId, "notification", {
            ...notification,
            unreadCount,
        });

        // 2. Real-time badge counter increment
        emitToUser(userId, "unread_count_updated", { unreadCount });

        return notification;
    } catch (error) {
        console.error(`[NotificationService] Error creating notification for user ${userId}:`, error);
        return null;
    }
};

/**
 * Broadcasts notification to all users matching a specified role or across the entire platform.
 */
const createAndSendBroadcast = async (payload: IBroadcastNotificationPayload) => {
    const { role, title, message, type = NotificationType.GENERAL, link, data } = payload;

    try {
        const users = await prisma.user.findMany({
            where: {
                ...(role ? { role } : {}),
                isBlocked: false,
                isDeleted: false,
            },
            select: { id: true },
        });

        if (!users.length) return [];

        const notificationsData = users.map((u) => ({
            userId: u.id,
            title,
            message,
            type,
            link: link ?? null,
            data: data ? (data as Prisma.InputJsonValue) : Prisma.JsonNull,
        }));

        await prisma.notification.createMany({
            data: notificationsData,
        });

        // Emit to target role room or universal room
        const socketPayload = {
            title,
            message,
            type,
            link,
            data,
            createdAt: new Date(),
        };

        if (role) {
            emitToRole(role, "notification", socketPayload);
        } else {
            // Emitted to every connected user
            users.forEach((u) => {
                emitToUser(u.id, "notification", socketPayload);
            });
        }

        return users.length;
    } catch (error) {
        console.error("[NotificationService] Broadcast notification error:", error);
        return 0;
    }
};

/**
 * Retrieves paginated notification list for authenticated user.
 */
const getUserNotifications = async (userId: string, query: IGetNotificationQuery) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
        userId,
    };

    if (query.isRead !== undefined && query.isRead !== "") {
        where.isRead = query.isRead === true || query.isRead === "true";
    }

    if (query.type) {
        where.type = query.type as NotificationType;
    }

    const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
        notifications,
        unreadCount,
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
    };
};

/**
 * Returns unread notification counter for badge synchronization.
 */
const getUnreadCount = async (userId: string) => {
    const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
    });
    return { unreadCount };
};

/**
 * Marks single notification as read and pushes updated unread count to client socket.
 */
const markAsRead = async (userId: string, notificationId: string) => {
    const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId },
    });

    if (!notification) {
        throw new AppError(status.NOT_FOUND, "Notification not found");
    }

    const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: {
            isRead: true,
            readAt: new Date(),
        },
    });

    const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
    });

    emitToUser(userId, "unread_count_updated", { unreadCount });

    return updated;
};

/**
 * Marks all notifications for a user as read.
 */
const markAllAsRead = async (userId: string) => {
    const result = await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: {
            isRead: true,
            readAt: new Date(),
        },
    });

    emitToUser(userId, "unread_count_updated", { unreadCount: 0 });

    return { count: result.count };
};

/**
 * Deletes a notification by id.
 */
const deleteNotification = async (userId: string, notificationId: string) => {
    const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId },
    });

    if (!notification) {
        throw new AppError(status.NOT_FOUND, "Notification not found");
    }

    await prisma.notification.delete({
        where: { id: notificationId },
    });

    const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
    });

    emitToUser(userId, "unread_count_updated", { unreadCount });

    return { message: "Notification deleted successfully" };
};

export const notificationService = {
    createAndSendNotification,
    createAndSendBroadcast,
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
};
