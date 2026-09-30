import { prisma } from "../../../lib/prisma";
import { Role, ShipmentStatus } from "../../../generated/prisma";
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

interface ICachedConversation {
    id: string;
    customerId: string;
    agentId: string;
    shipmentId: string | null;
    expiresAt: number;
}

const CONVERSATION_ACCESS_CACHE = new Map<string, ICachedConversation>();
const CACHE_TTL_MS = 15 * 1000; // 15 seconds L1 in-memory cache (amendment 2)

export function cacheConversationAccess(conversation: {
    id: string;
    customerId: string;
    agentId: string;
    shipmentId: string | null;
}) {
    CONVERSATION_ACCESS_CACHE.set(conversation.id, {
        ...conversation,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
}

export function invalidateConversationCache(conversationId: string) {
    CONVERSATION_ACCESS_CACHE.delete(conversationId);
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
    const now = Date.now();
    const cached = CONVERSATION_ACCESS_CACHE.get(conversationId);
    let conversation: {
        id: string;
        customerId: string;
        agentId: string;
        shipmentId: string | null;
    } | null = null;

    if (cached && cached.expiresAt > now) {
        conversation = cached;
    } else {
        conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: {
                id: true,
                customerId: true,
                agentId: true,
                shipmentId: true,
            },
        });

        if (conversation) {
            cacheConversationAccess(conversation);
        }
    }

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
 * Asserts that the conversation's shipment is active and not delivered.
 * When a shipment is DELIVERED, active chatting is disabled.
 */
export async function assertChatActiveForShipment(conversationId: string) {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
            id: true,
            shipmentId: true,
            shipment: {
                select: {
                    id: true,
                    status: true,
                    trackingId: true,
                },
            },
        },
    });

    if (!conversation) {
        throw new AppError(status.NOT_FOUND, "Conversation not found");
    }

    if (conversation.shipment?.status === ShipmentStatus.DELIVERED) {
        throw new AppError(
            status.BAD_REQUEST,
            "Your shipment already delivered. Chat is closed for this consignment."
        );
    }

    return conversation;
}

interface IRateLimitRecord {
    count: number;
    resetAt: number;
}

const RATE_LIMIT_CACHE = new Map<string, IRateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 5000; // 5 second sliding window
const MAX_MESSAGES_PER_WINDOW = 10; // WhatsApp allows seamless typing without throttling

// Clean up expired entries every 60s
setInterval(() => {
    const now = Date.now();
    for (const [userId, record] of RATE_LIMIT_CACHE.entries()) {
        if (record.resetAt < now) {
            RATE_LIMIT_CACHE.delete(userId);
        }
    }
    for (const [convId, cached] of CONVERSATION_ACCESS_CACHE.entries()) {
        if (cached.expiresAt < now) {
            CONVERSATION_ACCESS_CACHE.delete(convId);
        }
    }
}, 60000).unref();

/**
 * High-Speed Anti-Spam Rate Limiter:
 * Uses ultra-fast in-memory sliding window (<0.001ms) instead of slow remote Upstash HTTP calls.
 */
export async function checkChatRateLimit(userId: string): Promise<boolean> {
    const now = Date.now();
    const record = RATE_LIMIT_CACHE.get(userId);

    if (!record || now > record.resetAt) {
        RATE_LIMIT_CACHE.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (record.count >= MAX_MESSAGES_PER_WINDOW) {
        return false;
    }

    record.count += 1;
    return true;
}

/**
 * Content Sanitizer:
 * Enforces length limit (<= 2000 chars) and trims leading/trailing whitespace.
 * Preserves raw user text intact without regex stripping '<...>' (which corrupts math like 'a < b').
 * Safe rendering is guaranteed by frontend rendering plain text without dangerouslySetInnerHTML.
 */
export function sanitizeMessageContent(content: string): string {
    if (!content) return "";
    return content.trim().slice(0, 2000);
}
