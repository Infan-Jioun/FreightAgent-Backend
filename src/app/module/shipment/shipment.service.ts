import status from "http-status";
import AppError from "../../../errorHelper/AppError";
import { Role, ShipmentStatus } from "../../../generated/prisma";
import { prisma } from "../../../lib/prisma";
import { redis } from "../../../lib/redis";
import { IRequestUser } from "../../interface/requestUserInterface";
import { ICreateShipment, IQueryShipment, IUpdateShipmentStatus } from "./shipment.interface";

const CACHE_TTL = 60;
const invalidateShipmentCache = async (userId?: string) => {
    const keys = await redis.keys("shipment");
    if (keys.length > 0) {
        await Promise.all(keys.map((key) => redis.del(key)))
    }
}

const createShipment = async (payload: ICreateShipment, user: IRequestUser) => {
    const shipment = await prisma.shipment.create({
        data: {
            origin: payload.origin,
            destination: payload.destination,
            weight: payload.weight,
            description: payload.description,
            estimatedDate: payload.estimatedDate
                ? new Date(payload.estimatedDate)
                : null,
            userId: user.userId,
            status: ShipmentStatus.PENDING,

        },
        select: {
            id: true,
            trackingId: true,
            origin: true,
            destination: true,
            weight: true,
            description: true,
            status: true,
            estimatedDate: true,
            createdAt: true,
        }
    });
    await invalidateShipmentCache();
    return shipment

}
const getAllShipments = async (query: IQueryShipment, user: IRequestUser) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const cacheKey = `shipment:all:${page}:${limit}:${query.status || "all"}:${query.search || "none"}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
        if (cached) {
            return JSON.parse(cached as string)
        }
    }
    const where: any = {};
    if (query.status) {
        where.status = query.status
    }
    if (query.search) {
        where.OR = [
            { trackingId: { contains: query.search, mode: "insensitive" } },
            { origin: { contains: query.search, mode: "insensitive" } },
            { destination: { contains: query.search, mode: "insensitive" } },
        ];
    }
    const [shipment, total] = await Promise.all([
        prisma.shipment.findMany({
            where,
            select: {
                id: true,
                trackingId: true,
                origin: true,
                destination: true,
                weight: true,
                status: true,
                estimatedDate: true,
                createdAt: true,
                statusLogs: {
                    select: {
                        status: true,
                        location: true,
                        note: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        emailVerified: true,
                        role: true,
                    }
                },
            },

            orderBy: { createdAt: "desc" },
            skip,
            take: limit
        }),
        prisma.shipment.count({ where })

    ]);
    const result = {
        shipment,
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
    };
    await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });

    return result;
}
const getMyShipments = async (query: IQueryShipment, user: IRequestUser) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit
    const cacheKey = `shipment:my:${user.userId}:${page}:${limit}:${query.status || "all"}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached as string);
        } catch (e) {
            await redis.del(cacheKey);  // corrupt cache delete করো
        }
    }
    const where: any = { userId: user.userId };
    if (query.status) {
        where.status = query.status;
    }
    const [shipments, total] = await Promise.all([
        prisma.shipment.findMany({
            where,
            select: {
                id: true,
                trackingId: true,
                origin: true,
                destination: true,
                weight: true,
                status: true,
                estimatedDate: true,
                createdAt: true,
                statusLogs: {
                    select: {
                        status: true,
                        location: true,
                        note: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.shipment.count({ where }),
    ]);
    const result = {
        shipments,
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
    };
    await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });
    return result;
}
const getShipmentById = async (id: string, user: IRequestUser) => {
    const cacheKey = `shipment:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached as string);
        } catch (e) {
            await redis.del(cacheKey);  // corrupt cache delete করো
        }
    };
    const shipment = await prisma.shipment.findUnique({
        where: { id },
        select: {
            id: true,
            trackingId: true,
            origin: true,
            destination: true,
            weight: true,
            description: true,
            status: true,
            estimatedDate: true,
            createdAt: true,
            updatedAt: true,
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    role: true,
                    emailVerified: true

                },
            },
            statusLogs: {
                select: {
                    id: true,
                    status: true,
                    location: true,
                    note: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
            }
        }
    });
    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }
    if (
        user.role === Role.CUSTOMER &&
        shipment.user.id !== user.userId
    ) {
        throw new AppError(status.FORBIDDEN, "Access denied");
    }
    await redis.set(cacheKey, JSON.stringify(shipment), { ex: CACHE_TTL });

    return shipment;
}
const updateShipmentStatus = async (id: string, payload: IUpdateShipmentStatus, user: IRequestUser) => {
    const shipment = await prisma.shipment.findUnique({
        where: { id }
    });
    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    };
    if (shipment.status === payload.status) {
        throw new AppError(
            status.BAD_REQUEST,
            `Shipment is already ${payload.status}`
        );
    }
    const [updated] = await prisma.$transaction([
        prisma.shipment.update({
            where: { id },
            data: { status: payload.status },
            select: {
                id: true,
                trackingId: true,
                status: true,
                updatedAt: true,
                user: {
                    select: {
                        id: true,
                        role: true,
                        email: true,
                        image: true,
                        emailVerified: true,
                        name: true
                    }
                }
            },


        }),
        prisma.statusLog.create({
            data: {
                shipmentId: id,
                status: payload.status,
                location: payload.location,
                note: payload.note,
                updateBy: user.email,

            },
        }),
    ]);
    await invalidateShipmentCache();

    return updated;
}
export const shipmentService = {
    createShipment,
    getAllShipments,
    getMyShipments,
    getShipmentById,
    updateShipmentStatus

}