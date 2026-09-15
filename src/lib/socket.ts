import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { envConfig } from '../_config/env';

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
        const userId = socket.handshake.query.userId as string;
        const role = socket.handshake.query.role as string | undefined;

        if (!userId) {
            socket.disconnect();
            return;
        }

        // প্রতিটা user এর নিজস্ব room
        socket.join(`user_${userId}`);

        // Admin room
        if (role === 'ADMIN') {
            socket.join('admin_room');
        }

        console.log(`[Socket] Connected: ${userId} (${role || 'USER'})`);

        socket.on('disconnect', () => {
            console.log(`[Socket] Disconnected: ${userId}`);
        });
    });

    return io;
};

export const getIO = (): Server | undefined => {
    return io;
};

export const notifyAgent = (agentId: string, data: object, event = 'new_shipment') => {
    if (!io) return;
    io.to(`user_${agentId}`).emit(event, data);
    // Also emit generic 'notification' event for universal UI toast listeners
    io.to(`user_${agentId}`).emit('notification', {
        type: 'AGENT_NOTIFICATION',
        event,
        ...data,
    });
};

export const notifyCustomer = (customerId: string, data: object, event = 'shipment_update') => {
    if (!io) return;
    io.to(`user_${customerId}`).emit(event, data);
    // Also emit generic 'notification' event for universal UI toast listeners
    io.to(`user_${customerId}`).emit('notification', {
        type: 'CUSTOMER_NOTIFICATION',
        event,
        ...data,
    });
};

export const notifyAdmin = (data: object, event = 'admin_shipment_update') => {
    if (!io) return;
    io.to('admin_room').emit(event, data);
    io.to('admin_room').emit('notification', {
        type: 'ADMIN_NOTIFICATION',
        event,
        ...data,
    });
};