import { prisma } from "../../../lib/prisma";
import { redis } from "../../../lib/redis";
import { Role } from "../../../generated/prisma";
import AppError from "../../../errorHelper/AppError";
import status from "http-status";

export interface IAccessCheckResult {
    allowed: boolean;
    conversation?: {
        id: string;
        customerId: string;
        agentId: string;
        shipmentId: string | null;
    } | null;
}

/**
 * Access Control Matrix:
 * - Admin: Allowed access to any conversation
 * - Customer: Allowed ONLY if conversation.customerId === userId
 * - Agent: Allowed ONLY if conversation.agentId === userId
 * - Any other user: Denied (Forbidden)
 */
export async function canAccessConversation(
    userId: string,
    userRole: Role | string,
    conversationId: string
): Promise<IAccessCheckResult> {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
            id: true,
            customerId: true,
            agentId: true,
            shipmentId: true,
        },
    });

    if (!conversation) {
        return { allowed: false, conversation: null };
    }

    // Admin has global oversight
    if (userRole === Role.ADMIN || userRole === "ADMIN") {
        return { allowed: true, conversation };
    }

    const isParticipant =
        conversation.customerId === userId || conversation.agentId === userId;

    return { allowed: isParticipant, conversation };
}

/**
 * Asserts access permission; throws 403 or 404 immediately if unauthorized.
 */
export async function assertConversationAccess(
    userId: string,
    userRole: Role | string,
    conversationId: string
) {
    const { allowed, conversation } = await canAccessConversation(userId, userRole, conversationId);

    if (!conversation) {
        throw new AppError(status.NOT_FOUND, "Conversation not found");
    }

    if (!allowed) {
        throw new AppError(
            status.FORBIDDEN,
            "Access denied: You are not authorized to view or participate in this conversation."
        );
    }

    return conversation;
}

/**
 * Anti-Spam Rate Limiter:
 * Enforces per-user sliding window counter in Redis (max 5 messages per 5 seconds).
 */
export async function checkChatRateLimit(userId: string): Promise<boolean> {
    const key = `chat:ratelimit:${userId}`;
    const current = await redis.incr(key);

    if (current === 1) {
        await redis.expire(key, 5); // 5 second window
    }

    return current <= 5;
}

/**
 * XSS Content Sanitizer:
 * Strips dangerous HTML tags, javascript directives, and trims length.
 */
export function sanitizeMessageContent(content: string): string {
    if (!content) return "";
    return content
        .replace(/<[^>]*>/g, "") // Strip all HTML tags
        .replace(/javascript:/gi, "") // Remove javascript protocol injections
        .trim()
        .slice(0, 2000); // 2000 character maximum
}
