import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { envConfig } from '../_config/env';
import { JwtTokenUtils } from '../utils/jwt';
import { canAccessConversation } from '../app/module/chat/chat.security';
import { chatService } from '../app/module/chat/chat.service';
import { Role } from '../generated/prisma';

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

        // 4. Secure Realtime Message Sender Handler
        socket.on('send_message', async ({ conversationId, content }: { conversationId: string; content: string }) => {
            if (!conversationId || !content) return;

            try {
                // chatService.sendMessage enforces canAccessConversation, rate limiting, and sanitization
                await chatService.sendMessage(userId, role, conversationId, content);
            } catch (err: any) {
                socket.emit('chat_error', {
                    statusCode: err.statusCode || 500,
                    message: err.message || 'Failed to deliver message.',
                });
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