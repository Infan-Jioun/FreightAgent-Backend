import status from "http-status";
import AppError from "../../../errorHelper/AppError";
import { prisma } from "../../../lib/prisma";
import { Role, ShipmentStatus } from "../../../generated/prisma";
import { getIO } from "../../../lib/socket";
import {
    assertConversationAccess,
    assertChatActiveForShipment,
    checkChatRateLimit,
    sanitizeMessageContent,
    cacheConversationAccess,
} from "./chat.security";
import { saveChatFileLocally } from "../../../utils/chatFileStorage";
import { uploadChatAttachmentToCloudinary } from "../../../utils/cloudinary";
import { envConfig } from "../../../_config/env";

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
            if (shipment.status === ShipmentStatus.DELIVERED) {
                throw new AppError(
                    status.BAD_REQUEST,
                    "Your shipment already delivered. Chat is no longer available."
                );
            }

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

        // Cache participant access in memory for instant validation
        cacheConversationAccess({
            id: conversation.id,
            customerId: conversation.customerId,
            agentId: conversation.agentId,
            shipmentId: conversation.shipmentId,
        });

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
     * Retrieves messages for an authorized conversation with asynchronous non-blocking read-receipts.
     */
    public async getConversationMessages(
        userId: string,
        userRole: Role | string,
        conversationId: string
    ) {
        // Enforce strict authorization check (uses O(1) in-memory cache)
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

        // Mark unread messages from counterparty as read asynchronously (non-blocking)
        prisma.conversationMessage
            .updateMany({
                where: {
                    conversationId,
                    isRead: false,
                    senderId: { not: userId },
                },
                data: { isRead: true },
            })
            .then((result) => {
                if (result.count > 0) {
                    const io = getIO();
                    if (io) {
                        io.to(`conversation_${conversationId}`).emit("messages_read", {
                            conversationId,
                            readBy: userId,
                        });
                    }
                }
            })
            .catch((err) => {
                console.error("[ChatService] Asynchronous read receipt error:", err);
            });

        return messages;
    }

    /**
     * Stores a new message with rate-limiting, content sanitization, concurrent persistence, and immediate socket emit.
     */
    public async sendMessage(
        userId: string,
        userRole: Role | string,
        conversationId: string,
        rawContent: string
    ) {
        // 1. Authorize conversation participation (In-memory cached, O(1))
        const conversation = await assertConversationAccess(userId, userRole, conversationId);

        // 2. Enforce active chat condition (disabled if shipment DELIVERED)
        await assertChatActiveForShipment(conversationId);

        // 3. High-speed rate limiting (<0.001ms)
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

        const now = new Date();

        // 4. Concurrently persist message and update conversation metadata
        const [message] = await Promise.all([
            prisma.conversationMessage.create({
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
            }),
            prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    lastMessage: content,
                    lastMessageAt: now,
                },
            }),
        ]);

        // 5. Broadcast to Socket.io room IMMEDIATELY (sub-50ms WhatsApp speed)
        const io = getIO();
        if (io) {
            io.to(`conversation_${conversationId}`).emit("new_message", message);

            // Notify recipient asynchronously (non-blocking)
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

    /**
     * Explicitly marks messages as read in real time and broadcasts read receipt to the conversation room.
     */
    public async markMessagesAsRead(
        userId: string,
        userRole: Role | string,
        conversationId: string
    ) {
        await assertConversationAccess(userId, userRole, conversationId);

        const result = await prisma.conversationMessage.updateMany({
            where: {
                conversationId,
                isRead: false,
                senderId: { not: userId },
            },
            data: { isRead: true },
        });

        if (result.count > 0) {
            const io = getIO();
            if (io) {
                io.to(`conversation_${conversationId}`).emit("messages_read", {
                    conversationId,
                    readBy: userId,
                });
            }
        }

        return { success: true, count: result.count };
    }

    /**
     * Uploads a file attachment (max 10MB), persists the message with attachment URL,
     * updates conversation lastMessage, and broadcasts to the socket room.
     */
    public async uploadChatAttachment(
        userId: string,
        userRole: Role | string,
        conversationId: string,
        file: Express.Multer.File
    ) {
        // 1. Authorize conversation participation
        const conversation = await assertConversationAccess(userId, userRole, conversationId);

        // 2. Enforce active chat condition (disabled if shipment DELIVERED)
        await assertChatActiveForShipment(conversationId);

        // 3. High-speed rate limiting
        const isAllowed = await checkChatRateLimit(userId);
        if (!isAllowed) {
            throw new AppError(
                status.TOO_MANY_REQUESTS,
                "Message rate limit exceeded. Please wait a few seconds before uploading again."
            );
        }

        // 3. Strict 10MB limit enforcement
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
        if (!file || !file.buffer) {
            throw new AppError(status.BAD_REQUEST, "No file provided for upload.");
        }
        if (file.size > MAX_FILE_SIZE) {
            throw new AppError(
                status.BAD_REQUEST,
                "File size exceeds maximum allowed limit of 10MB."
            );
        }

        // 4. Upload file to Cloudinary (production-ready managed cloud storage) with graceful local fallback
        let fileUrl: string;
        const originalName = file.originalname || "Attachment";

        if (
            envConfig.CLOUDINARY_CLOUD_NAME &&
            envConfig.CLOUDINARY_API_KEY &&
            envConfig.CLOUDINARY_API_SECRET
        ) {
            try {
                const cloudResult = await uploadChatAttachmentToCloudinary(
                    file.buffer,
                    originalName
                );
                fileUrl = cloudResult.url;
            } catch (cloudErr) {
                console.warn("[ChatService] Cloudinary upload failed, falling back to local disk storage:", cloudErr);
                const savedFile = await saveChatFileLocally(file);
                fileUrl = savedFile.url;
            }
        } else {
            const savedFile = await saveChatFileLocally(file);
            fileUrl = savedFile.url;
        }

        const content = fileUrl;
        const now = new Date();
        const displayLabel = `📎 ${originalName}`;

        // 5. Concurrently persist message and update conversation metadata
        const [message] = await Promise.all([
            prisma.conversationMessage.create({
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
            }),
            prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    lastMessage: displayLabel,
                    lastMessageAt: now,
                },
            }),
        ]);

        // 6. Broadcast to Socket.io room IMMEDIATELY
        const io = getIO();
        if (io) {
            io.to(`conversation_${conversationId}`).emit("new_message", message);

            const recipientId =
                conversation.customerId === userId
                    ? conversation.agentId
                    : conversation.customerId;

            io.to(`user_${recipientId}`).emit("notification", {
                title: message.sender?.name
                    ? `New file from ${message.sender.name}`
                    : "New File Attachment",
                message: displayLabel,
                content: displayLabel,
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

    /**
     * Edits an existing message:
     * - Verifies conversation access
     * - Validates message exists and belongs to the conversation
     * - Ensures only original sender can edit their message
     * - Prevents modifying file attachments
     * - Enforces rate limiting and XSS sanitization
     * - Updates conversation.lastMessage if this was the latest message
     * - Broadcasts "message_edited" event via Socket.io
     */
    public async editMessage(
        userId: string,
        userRole: Role | string,
        conversationId: string,
        messageId: string,
        rawContent: string
    ) {
        // 1. Authorize conversation participation (In-memory cached, O(1))
        await assertConversationAccess(userId, userRole, conversationId);

        // 2. Enforce active chat condition (disabled if shipment DELIVERED)
        await assertChatActiveForShipment(conversationId);

        // 3. High-speed rate limiting
        const isAllowed = await checkChatRateLimit(userId);
        if (!isAllowed) {
            throw new AppError(
                status.TOO_MANY_REQUESTS,
                "Action rate limit exceeded. Please wait a few seconds before trying again."
            );
        }

        // 3. Find target message
        const existingMessage = await prisma.conversationMessage.findUnique({
            where: { id: messageId },
            include: {
                sender: {
                    select: { id: true, name: true, role: true, image: true },
                },
            },
        });

        if (!existingMessage) {
            throw new AppError(status.NOT_FOUND, "Message not found");
        }

        if (existingMessage.conversationId !== conversationId) {
            throw new AppError(
                status.BAD_REQUEST,
                "Message does not belong to the specified conversation"
            );
        }

        // 4. Verify ownership: Only original sender can edit their own message
        if (existingMessage.senderId !== userId) {
            throw new AppError(
                status.FORBIDDEN,
                "You are only permitted to edit your own messages."
            );
        }

        // 5. Guard against editing file attachments
        const isAttachment =
            existingMessage.content.includes("/chat_attachments/") ||
            existingMessage.content.includes("/api/v1/chat/files/") ||
            /\.(pdf|png|jpg|jpeg|webp|gif|docx?|xlsx?)$/i.test(existingMessage.content);

        if (isAttachment) {
            throw new AppError(
                status.BAD_REQUEST,
                "File attachments cannot be edited."
            );
        }

        // 6. Sanitize new content against XSS
        const content = sanitizeMessageContent(rawContent);
        if (!content) {
            throw new AppError(status.BAD_REQUEST, "Message content cannot be empty.");
        }

        // If content didn't change, return early
        if (content === existingMessage.content) {
            return existingMessage;
        }

        // 7. Update message in DB with isEdited flag and automatic updatedAt
        const updatedMessage = await prisma.conversationMessage.update({
            where: { id: messageId },
            data: {
                content,
                isEdited: true,
            },
            include: {
                sender: {
                    select: { id: true, name: true, role: true, image: true },
                },
            },
        });

        // 8. If this was the last message of the conversation, update conversation.lastMessage
        const latestMessage = await prisma.conversationMessage.findFirst({
            where: { conversationId },
            orderBy: { createdAt: "desc" },
            select: { id: true },
        });

        if (latestMessage?.id === messageId) {
            await prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    lastMessage: content,
                },
            });
        }

        // 9. Broadcast realtime socket event to conversation room
        const io = getIO();
        if (io) {
            io.to(`conversation_${conversationId}`).emit("message_edited", updatedMessage);
        }

        return updatedMessage;
    }
}

export const chatService = new ChatService();
