import status from "http-status";
import AppError from "../../../errorHelper/AppError";
import { prisma } from "../../../lib/prisma";
import { Role } from "../../../generated/prisma";
import { getIO } from "../../../lib/socket";
import {
    assertConversationAccess,
    checkChatRateLimit,
    sanitizeMessageContent,
} from "./chat.security";

export class ChatService {
    /**
     * Initializes or returns an existing conversation for an assigned shipment.
     */
    public async getOrCreateConversationForShipment(
        userId: string,
        userRole: Role | string,
        shipmentId: string
    ) {
        const shipment = await prisma.shipment.findUnique({
            where: { id: shipmentId },
            select: {
                id: true,
                trackingId: true,
                userId: true,
                agentId: true,
                status: true,
            },
        });

        if (!shipment) {
            throw new AppError(status.NOT_FOUND, "Shipment not found");
        }

        if (!shipment.agentId) {
            throw new AppError(
                status.BAD_REQUEST,
                "No agent has been assigned to this consignment yet. Chat will activate once an agent is assigned."
            );
        }

        // Authorization: Admin, Customer who owns shipment, or Assigned Agent
        const isParticipant =
            userRole === Role.ADMIN ||
            userRole === "ADMIN" ||
            shipment.userId === userId ||
            shipment.agentId === userId;

        if (!isParticipant) {
            throw new AppError(
                status.FORBIDDEN,
                "You do not have permission to access conversations for this shipment"
            );
        }

        let conversation = await prisma.conversation.findUnique({
            where: { shipmentId },
            include: {
                customer: {
                    select: { id: true, name: true, role: true, image: true, email: true },
                },
                agent: {
                    select: { id: true, name: true, role: true, image: true, email: true },
                },
                shipment: {
                    select: { id: true, trackingId: true, origin: true, destination: true, status: true },
                },
            },
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    shipmentId,
                    customerId: shipment.userId,
                    agentId: shipment.agentId,
                },
                include: {
                    customer: {
                        select: { id: true, name: true, role: true, image: true, email: true },
                    },
                    agent: {
                        select: { id: true, name: true, role: true, image: true, email: true },
                    },
                    shipment: {
                        select: { id: true, trackingId: true, origin: true, destination: true, status: true },
                    },
                },
            });
        }

        return conversation;
    }

    /**
     * Lists all authorized conversations for the requesting user.
     */
    public async getUserConversations(userId: string, userRole: Role | string) {
        const whereClause: any = {};

        if (userRole === Role.ADMIN || userRole === "ADMIN") {
            // Admins can inspect all conversations
        } else if (userRole === Role.AGENT || userRole === "AGENT") {
            whereClause.agentId = userId;
        } else {
            whereClause.customerId = userId;
        }

        const conversations = await prisma.conversation.findMany({
            where: whereClause,
            orderBy: { lastMessageAt: "desc" },
            include: {
                customer: {
                    select: { id: true, name: true, role: true, image: true },
                },
                agent: {
                    select: { id: true, name: true, role: true, image: true },
                },
                shipment: {
                    select: { id: true, trackingId: true, origin: true, destination: true, status: true },
                },
                _count: {
                    select: {
                        messages: {
                            where: {
                                isRead: false,
                                senderId: { not: userId },
                            },
                        },
                    },
                },
            },
        });

        return conversations.map((conv) => ({
            ...conv,
            unreadCount: conv._count.messages,
        }));
    }

    /**
     * Retrieves messages for an authorized conversation with automatic read-receipts.
     */
    public async getConversationMessages(
        userId: string,
        userRole: Role | string,
        conversationId: string
    ) {
        // Enforce strict authorization check
        await assertConversationAccess(userId, userRole, conversationId);

        const messages = await prisma.conversationMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: "asc" },
            include: {
                sender: {
                    select: { id: true, name: true, role: true, image: true },
                },
            },
            take: 100,
        });

        // Mark unread messages from counterparty as read
        await prisma.conversationMessage.updateMany({
            where: {
                conversationId,
                isRead: false,
                senderId: { not: userId },
            },
            data: { isRead: true },
        });

        return messages;
    }

    /**
     * Stores a new message with rate-limiting, content sanitization, and trusted senderId.
     */
    public async sendMessage(
        userId: string,
        userRole: Role | string,
        conversationId: string,
        rawContent: string
    ) {
        // 1. Authorize conversation participation
        const conversation = await assertConversationAccess(userId, userRole, conversationId);

        // 2. Per-user Anti-Spam rate limiting (Redis)
        const isAllowed = await checkChatRateLimit(userId);
        if (!isAllowed) {
            throw new AppError(
                status.TOO_MANY_REQUESTS,
                "Message rate limit exceeded. Please wait a few seconds before sending again."
            );
        }

        // 3. Sanitize content against XSS
        const content = sanitizeMessageContent(rawContent);
        if (!content) {
            throw new AppError(status.BAD_REQUEST, "Message content cannot be empty.");
        }

        // 4. Persist message with server-resolved senderId (NEVER trusting client input)
        const message = await prisma.conversationMessage.create({
            data: {
                conversationId,
                senderId: userId,
                content,
            },
            include: {
                sender: {
                    select: { id: true, name: true, role: true, image: true },
                },
            },
        });

        // 5. Update conversation timestamp
        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                lastMessage: content,
                lastMessageAt: new Date(),
            },
        });

        // 6. Broadcast to Socket.io room
        const io = getIO();
        if (io) {
            io.to(`conversation_${conversationId}`).emit("new_message", message);

            // Notify recipient if they are not active in room
            const recipientId =
                conversation.customerId === userId
                    ? conversation.agentId
                    : conversation.customerId;

            io.to(`user_${recipientId}`).emit("notification", {
                title: message.sender?.name
                    ? `New message from ${message.sender.name}`
                    : "New Message",
                message: content.length > 80 ? `${content.slice(0, 77)}...` : content,
                content: content.slice(0, 80),
                type: "NEW_CHAT_MESSAGE",
                conversationId,
                senderName: message.sender?.name || "User",
                sender: message.sender,
                timestamp: message.createdAt,
                createdAt: message.createdAt,
            });
        }

        return message;
    }
}

export const chatService = new ChatService();
