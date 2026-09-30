import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { envConfig } from '../_config/env';
import { JwtTokenUtils } from '../utils/jwt';
import { isTokenBlacklisted } from '../utils/tokenBlacklist';
import { canAccessConversation } from '../app/module/chat/chat.security';
import { chatService } from '../app/module/chat/chat.service';
import { Role, MessageType } from '../generated/prisma';
import {
    socketSendMessageSchema,
    socketEditMessageSchema,
    socketConversationRoomSchema,
} from '../app/module/chat/chat.validation';

export interface SendMessagePayload {
    conversationId: string;
    content: string;
    clientMessageId?: string;
    tempId?: string;
    type?: 'TEXT' | 'FILE';
    attachmentUrl?: string | null;
    attachmentName?: string | null;
}

export interface SendMessageAckResponse {
    success: boolean;
    data?: unknown;
    error?: string | undefined;
    tempId?: string | undefined;
    clientMessageId?: string | undefined;
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

function parseCookies(cookieHeader?: string): Record<string, string> {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, str) => {
        const [rawKey, ...rawVal] = str.trim().split('=');
        if (rawKey) {
            acc[rawKey] = decodeURIComponent(rawVal.join('='));
        }
        return acc;
    }, {} as Record<string, string>);
}

const isProduction = envConfig.NODE_ENV === "production";

const allowedOrigins = [
    envConfig.FRONTEND_URL?.replace(/\/$/, ""),
    !isProduction ? "http://localhost:3000" : null,
    !isProduction ? "http://localhost:5000" : null,
    !isProduction ? "http://127.0.0.1:3000" : null,
    !isProduction ? "http://127.0.0.1:5000" : null,
].filter(Boolean) as string[];

// Per-socket typing throttle map: key = `${socket.id}_${conversationId}`, value = timestamp
const typingThrottleMap = new Map<string, number>();

export const initSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) {
                    return callback(null, true);
                }
                const normalized = origin.replace(/\/$/, "");
                if (allowedOrigins.includes(normalized)) {
                    return callback(null, true);
                }
                if (!isProduction) {
                    if (
                        normalized.startsWith("http://localhost:") ||
                        normalized.startsWith("http://127.0.0.1:")
                    ) {
                        return callback(null, true);
                    }
                }
                return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
            },
            methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
            credentials: true,
        },
        transports: ['websocket'],
        perMessageDeflate: false,
    });

    // Handshake Authentication Middleware (Dual support: auth.token / Bearer header OR httpOnly cookie)
    io.use(async (socket: Socket, next) => {
        try {
            const cookies = parseCookies(socket.handshake.headers?.cookie);
            const token =
                (socket.handshake.auth?.token as string | undefined) ||
                socket.handshake.headers?.authorization?.split(" ")[1] ||
                cookies.accessToken;

            if (!token) {
                return next(new Error("Unauthorized: Authentication token is required"));
            }

            // Check if token has been revoked / blacklisted
            const isBlacklisted = await isTokenBlacklisted(token);
            if (isBlacklisted) {
                return next(new Error("Unauthorized: Token has been revoked"));
            }

            const decoded = JwtTokenUtils.verifyToken(token, envConfig.ACCESS_TOKEN_SECRET);
            if (!decoded.success || !decoded.data) {
                return next(new Error("Unauthorized: Invalid or expired token"));
            }

            const userId = (decoded.data.userId || decoded.data.id) as string;
            const role = (decoded.data.role || Role.CUSTOMER) as Role | string;
            const exp = decoded.data.exp as number | undefined;

            if (!userId) {
                return next(new Error("Unauthorized: Token payload missing user identification"));
            }

            if (exp) {
                const remainingMs = exp * 1000 - Date.now();
                if (remainingMs <= 0) {
                    return next(new Error("Unauthorized: Token has expired"));
                }
                socket.data.exp = exp;
            }

            socket.data.userId = userId;
            socket.data.role = role;
            return next();
        } catch (err: unknown) {
            const error = err as Error;
            return next(new Error(error.message || "Unauthorized: Handshake authentication failed"));
        }
    });

    io.on('connection', (socket: Socket) => {
        const userId = socket.data.userId as string;
        const role = socket.data.role as Role | string;
        const exp = socket.data.exp as number | undefined;

        // Auto-disconnect on JWT token expiry
        let expiryTimer: NodeJS.Timeout | null = null;
        if (exp) {
            const remainingMs = exp * 1000 - Date.now();
            if (remainingMs > 0) {
                expiryTimer = setTimeout(() => {
                    socket.emit("session_expired", {
                        message: "Access token has expired. Please re-authenticate.",
                    });
                    socket.disconnect(true);
                }, remainingMs);
            }
        }

        // 1. Join personal user room & role rooms
        socket.join(`user_${userId}`);

        if (role) {
            socket.join(`role_${String(role).toUpperCase()}`);
        }

        if (role === Role.ADMIN || role === "ADMIN") {
            socket.join('admin_room');
        }

        console.log(`[Socket] Connected: ${userId} (${role})`);

        // 2. Secure Conversation Room Joining (Zod validated)
        socket.on('join_conversation', async (rawPayload: unknown) => {
            const parsed = socketConversationRoomSchema.safeParse(rawPayload);
            if (!parsed.success) {
                socket.emit('chat_error', {
                    statusCode: 400,
                    message: parsed.error.issues[0]?.message || 'Invalid conversation payload',
                });
                return;
            }

            const { conversationId } = parsed.data;
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

        // 3. Leave Conversation Room (Zod validated)
        socket.on('leave_conversation', (rawPayload: unknown) => {
            const parsed = socketConversationRoomSchema.safeParse(rawPayload);
            if (!parsed.success) return;
            const { conversationId } = parsed.data;
            socket.leave(`conversation_${conversationId}`);
        });

        // 4. Secure Realtime Message Sender Handler (Zod validated, WhatsApp-style instant ACK)
        socket.on(
            'send_message',
            async (
                rawPayload: unknown,
                ackCallback?: (res: SendMessageAckResponse) => void
            ) => {
                const parsed = socketSendMessageSchema.safeParse(rawPayload);
                const tempId = (rawPayload as { tempId?: string })?.tempId;
                const clientMessageId =
                    (rawPayload as { clientMessageId?: string })?.clientMessageId || tempId;

                if (!parsed.success) {
                    const validationError =
                        parsed.error.issues[0]?.message || 'Invalid send_message payload';
                    if (typeof ackCallback === 'function') {
                        ackCallback({
                            success: false,
                            error: validationError,
                            tempId,
                            clientMessageId,
                        });
                    }
                    socket.emit('chat_error', {
                        statusCode: 400,
                        message: validationError,
                        tempId,
                        clientMessageId,
                    });
                    return;
                }

                const { conversationId, content, type } = parsed.data;

                try {
                    const message = await chatService.sendMessage(
                        userId,
                        role,
                        conversationId,
                        content,
                        clientMessageId,
                        type as MessageType
                    );

                    if (typeof ackCallback === 'function') {
                        ackCallback({
                            success: true,
                            data: message,
                            tempId,
                            clientMessageId,
                        });
                    }
                } catch (err: unknown) {
                    const error = err as { statusCode?: number; message?: string };
                    const errorMessage = error.message || 'Failed to deliver message.';

                    if (typeof ackCallback === 'function') {
                        ackCallback({
                            success: false,
                            error: errorMessage,
                            tempId,
                            clientMessageId,
                        });
                    }
                    socket.emit('chat_error', {
                        statusCode: error.statusCode || 500,
                        message: errorMessage,
                        tempId,
                        clientMessageId,
                    });
                }
            }
        );

        // 4b. Realtime Message Edit Handler (Zod validated)
        socket.on(
            'edit_message',
            async (
                rawPayload: unknown,
                ackCallback?: (res: EditMessageAckResponse) => void
            ) => {
                const parsed = socketEditMessageSchema.safeParse(rawPayload);
                if (!parsed.success) {
                    const validationError =
                        parsed.error.issues[0]?.message || 'Invalid edit_message payload';
                    if (typeof ackCallback === 'function') {
                        ackCallback({
                            success: false,
                            error: validationError,
                        });
                    }
                    socket.emit('chat_error', {
                        statusCode: 400,
                        message: validationError,
                    });
                    return;
                }

                const { conversationId, messageId, content } = parsed.data;

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

        // 5. Realtime mark as read handler (Zod validated)
        socket.on('mark_read', async (rawPayload: unknown) => {
            const parsed = socketConversationRoomSchema.safeParse(rawPayload);
            if (!parsed.success) return;

            const { conversationId } = parsed.data;
            try {
                await chatService.markMessagesAsRead(userId, role, conversationId);
            } catch (err) {
                console.error('[Socket] Failed to mark read:', err);
            }
        });

        // 6. Typing Indicators (Zod validated, Room Guarded, and Throttled to max 1 event / 2s)
        socket.on('typing', (rawPayload: unknown) => {
            const parsed = socketConversationRoomSchema.safeParse(rawPayload);
            if (!parsed.success) return;

            const { conversationId } = parsed.data;

            // Room guard: user must be an active occupant in the room
            if (!socket.rooms.has(`conversation_${conversationId}`)) {
                return;
            }

            // Server-side throttle: max 1 typing event per 2s per socket & conversation
            const throttleKey = `${socket.id}_${conversationId}`;
            const now = Date.now();
            const lastTime = typingThrottleMap.get(throttleKey) || 0;
            if (now - lastTime < 2000) {
                return;
            }
            typingThrottleMap.set(throttleKey, now);

            socket.to(`conversation_${conversationId}`).emit('user_typing', {
                userId,
                conversationId,
            });
        });

        socket.on('stop_typing', (rawPayload: unknown) => {
            const parsed = socketConversationRoomSchema.safeParse(rawPayload);
            if (!parsed.success) return;

            const { conversationId } = parsed.data;

            // Room guard: user must be an active occupant in the room
            if (!socket.rooms.has(`conversation_${conversationId}`)) {
                return;
            }

            socket.to(`conversation_${conversationId}`).emit('user_stop_typing', {
                userId,
                conversationId,
            });
        });

        socket.on('disconnect', () => {
            if (expiryTimer) {
                clearTimeout(expiryTimer);
            }
            // Clear typing throttle entries for this socket
            for (const key of typingThrottleMap.keys()) {
                if (key.startsWith(`${socket.id}_`)) {
                    typingThrottleMap.delete(key);
                }
            }
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