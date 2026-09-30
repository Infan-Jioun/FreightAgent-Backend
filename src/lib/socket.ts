import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { envConfig } from '../_config/env';
import { JwtTokenUtils } from '../utils/jwt';
import { canAccessConversation } from '../app/module/chat/chat.security';
import { chatService } from '../app/module/chat/chat.service';
import { Role } from '../generated/prisma';

export interface SendMessagePayload {
    conversationId: string;
    content: string;
    tempId?: string;
}

export interface SendMessageAckResponse {
    success: boolean;
    data?: unknown;
    error?: string | undefined;
    tempId?: string | undefined;
}

export interface EditMessagePayload {
    conversationId: string;
    messageId: string;
    content: string;
}

export interface EditMessageAckResponse {
    success: boolean;
    data?: unknown;
    error?: string | undefined;
}

let io: Server;

const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5000",
    envConfig.FRONTEND_URL?.replace(/\/$/, ""),
].filter(Boolean);

export const initSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                const normalizedOrigin = origin.replace(/\/$/, "");
                if (
                    allowedOrigins.includes(normalizedOrigin) ||
                    normalizedOrigin.startsWith("http://localhost:") ||
                    normalizedOrigin.startsWith("http://127.0.0.1:") ||
                    normalizedOrigin.endsWith(".vercel.app")
                ) {
                    return callback(null, true);
                }
                return callback(null, true);
            },
            methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
            credentials: true,
        },
    });

    io.on('connection', (socket: Socket) => {
        // Resolve authenticated user from JWT token or fallback handshake
        let resolvedUserId = (socket.handshake.auth?.userId || socket.handshake.query?.userId) as string | undefined;
        let resolvedRole = (socket.handshake.auth?.role || socket.handshake.query?.role) as string | undefined;

        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
        if (token) {
            const decoded = JwtTokenUtils.verifyToken(token, envConfig.ACCESS_TOKEN_SECRET);
            if (decoded.success && decoded.data) {
                resolvedUserId = (decoded.data.userId || decoded.data.id) as string;
                resolvedRole = decoded.data.role as string;
            }
        }

        if (!resolvedUserId) {
            socket.disconnect();
            return;
        }

        const userId = resolvedUserId;
        const role = resolvedRole || Role.CUSTOMER;

        // 1. Join personal user room & role rooms
        socket.join(`user_${userId}`);

        if (role) {
            socket.join(`role_${role.toUpperCase()}`);
        }

        if (role ===  Role.ADMIN) {
            socket.join('admin_room');
        }

        console.log(`[Socket] Connected: ${userId} (${role})`);

        // 2. Secure Conversation Room Joining
        socket.on('join_conversation', async ({ conversationId }: { conversationId: string }) => {
            if (!conversationId) return;

            const { allowed } = await canAccessConversation(userId, role, conversationId);
            if (!allowed) {
                socket.emit('chat_error', {
                    statusCode: 403,
                    message: 'Forbidden: You are not authorized to access this conversation.',
                });
                return;
            }

            socket.join(`conversation_${conversationId}`);
            socket.emit('conversation_joined', { conversationId });
        });

        // 3. Leave Conversation Room
        socket.on('leave_conversation', ({ conversationId }: { conversationId: string }) => {
            if (!conversationId) return;
            socket.leave(`conversation_${conversationId}`);
        });

        // 4. Secure Realtime Message Sender Handler (Supports WhatsApp-style instant ACK with tempId)
        socket.on(
            'send_message',
            async (
                payload: SendMessagePayload,
                ackCallback?: (res: SendMessageAckResponse) => void
            ) => {
                const { conversationId, content, tempId } = payload || {};
                if (!conversationId || !content) {
                    if (typeof ackCallback === 'function') {
                        ackCallback({
                            success: false,
                            error: 'Invalid payload: conversationId and content are required',
                            tempId,
                        });
                    }
                    return;
                }

                try {
                    // chatService.sendMessage enforces cached authorization, sub-ms rate limiting, concurrent DB writes, and instant broadcast
                    const message = await chatService.sendMessage(userId, role, conversationId, content);

                    if (typeof ackCallback === 'function') {
                        ackCallback({ success: true, data: message, tempId });
                    }
                } catch (err: unknown) {
                    const error = err as { statusCode?: number; message?: string };
                    const errorMessage = error.message || 'Failed to deliver message.';

                    if (typeof ackCallback === 'function') {
                        ackCallback({
                            success: false,
                            error: errorMessage,
                            tempId,
                        });
                    }
                    socket.emit('chat_error', {
                        statusCode: error.statusCode || 500,
                        message: errorMessage,
                        tempId,
                    });
                }
            }
        );

        // 4b. Realtime Message Edit Handler
        socket.on(
            'edit_message',
            async (
                payload: EditMessagePayload,
                ackCallback?: (res: EditMessageAckResponse) => void
            ) => {
                const { conversationId, messageId, content } = payload || {};
                if (!conversationId || !messageId || !content) {
                    if (typeof ackCallback === 'function') {
                        ackCallback({
                            success: false,
                            error: 'Invalid payload: conversationId, messageId, and content are required',
                        });
                    }
                    return;
                }

                try {
                    const message = await chatService.editMessage(
                        userId,
                        role,
                        conversationId,
                        messageId,
                        content
                    );

                    if (typeof ackCallback === 'function') {
                        ackCallback({ success: true, data: message });
                    }
                } catch (err: unknown) {
                    const error = err as { statusCode?: number; message?: string };
                    const errorMessage = error.message || 'Failed to edit message.';

                    if (typeof ackCallback === 'function') {
                        ackCallback({
                            success: false,
                            error: errorMessage,
                        });
                    }
                    socket.emit('chat_error', {
                        statusCode: error.statusCode || 500,
                        message: errorMessage,
                    });
                }
            }
        );

        // Realtime mark as read handler (for WhatsApp-like double blue checkmarks)
        socket.on('mark_read', async ({ conversationId }: { conversationId: string }) => {
            if (!conversationId) return;
            try {
                await chatService.markMessagesAsRead(userId, role, conversationId);
            } catch (err) {
                console.error('[Socket] Failed to mark read:', err);
            }
        });

        // 5. Typing Indicators
        socket.on('typing', ({ conversationId }: { conversationId: string }) => {
            if (!conversationId) return;
            socket.to(`conversation_${conversationId}`).emit('user_typing', {
                userId,
                conversationId,
            });
        });

        socket.on('stop_typing', ({ conversationId }: { conversationId: string }) => {
            if (!conversationId) return;
            socket.to(`conversation_${conversationId}`).emit('user_stop_typing', {
                userId,
                conversationId,
            });
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Disconnected: ${userId}`);
        });
    });

    return io;
};

export const getIO = (): Server | undefined => {
    return io;
};

export const emitToUser = (userId: string, event: string, payload: unknown) => {
    if (!io) return;
    io.to(`user_${userId}`).emit(event, payload);
};

export const emitToRole = (role: string, event: string, payload: unknown) => {
    if (!io) return;
    io.to(`role_${role.toUpperCase()}`).emit(event, payload);
};

export const notifyAgent = (agentId: string, data: object, event = 'new_shipment') => {
    if (!io) return;
    io.to(`user_${agentId}`).emit(event, data);
    io.to(`user_${agentId}`).emit('notification', {
        type: Role.AGENT,
        event,
        ...data,
    });
};

export const notifyCustomer = (customerId: string, data: object, event = 'shipment_update') => {
    if (!io) return;
    io.to(`user_${customerId}`).emit(event, data);
    io.to(`user_${customerId}`).emit('notification', {
        type: Role.CUSTOMER,
        event,
        ...data,
    });
};

export const notifyAdmin = (data: object, event = 'admin_shipment_update') => {
    if (!io) return;
    io.to('admin_room').emit(event, data);
    io.to('admin_room').emit('notification', {
        type: Role.ADMIN,
        event,
        ...data,
    });
};