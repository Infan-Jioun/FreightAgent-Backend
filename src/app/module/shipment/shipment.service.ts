import status from "http-status";
import AppError from "../../../errorHelper/AppError";
import { Prisma, Role, ShipmentStatus } from "../../../generated/prisma";
import { prisma } from "../../../lib/prisma";
import { redis } from "../../../lib/redis";
import { IRequestUser } from "../../interface/requestUserInterface";
import { ICreateShipment, IQueryShipment, IUpdateShipmentStatus } from "./shipment.interface";
import { sendEmail } from "../../../utils/email";
import { envConfig } from "../../../_config/env";
import { STATUS_ORDER } from "../../../utils/statusOrder";
import { invalidateShipmentCache } from "../../../utils/invalidateShipmentCache";

const CACHE_TTL = 60;

const createShipment = async (payload: ICreateShipment, user: IRequestUser) => {
    const shipment = await prisma.shipment.create({
        data: {
            origin: payload.origin,
            destination: payload.destination,
            weight: payload.weight,
            description: payload.description ?? null,
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
        },
    });

    await invalidateShipmentCache();
    if (!user.email) {
        console.warn("User email not found, skipping email.");
        return shipment;
    }

    try {
        await sendEmail({
            to: user.email,
            subject: "Shipment Created Successfully - FreightAgent 📦",
            templateName: "shipment",
            templateData: {
                name: user.name ?? "User",
                trackingId: shipment.trackingId,
                origin: shipment.origin,
                destination: shipment.destination,
                weight: shipment.weight,
                description: shipment.description,
                trackUrl: `${envConfig.FRONTEND_URL}/dashboard/tracking`,
                estimatedDate: shipment.estimatedDate
                    ? new Date(shipment.estimatedDate).toLocaleDateString("en-US", {
                        timeZone: "Asia/Dhaka",
                        dateStyle: "medium",
                    })
                    : null,
                createdAt: new Date(shipment.createdAt).toLocaleString("en-US", {
                    timeZone: "Asia/Dhaka",
                    dateStyle: "medium",
                    timeStyle: "short",
                }),
            },
        });
    } catch (err) {
        console.error("Shipment creation email failed:", err);
    }

    return shipment;
};

const getAllShipments = async (query: IQueryShipment) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const cacheKey = `shipment:all:${page}:${limit}:${query.status || "all"}:${query.search || "none"}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached as string);
        } catch (e) {
            await redis.del(cacheKey);
        }
    }
    const where: Prisma.ShipmentWhereInput = {};
    if (query.status) {
        where.status = query.status;
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
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.shipment.count({ where }),
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
};

const getMyShipments = async (query: IQueryShipment, user: IRequestUser) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const cacheKey = `shipment:my:${user.userId}:${page}:${limit}:${query.status || "all"}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached as string);
        } catch (e) {
            await redis.del(cacheKey);
        }
    }

    const where: Prisma.ShipmentWhereInput = { userId: user.userId };
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
};

const getShipmentById = async (id: string, user: IRequestUser) => {
    const cacheKey = `shipment:${id}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            const cachedShipment = JSON.parse(cached as string);
            if (
                user.role === Role.CUSTOMER &&
                cachedShipment.user.id !== user.userId
            ) {
                throw new AppError(status.FORBIDDEN, "Access denied");
            }

            return cachedShipment;
        } catch (e) {
            if (e instanceof AppError) throw e; // AppError re-throw করো
            await redis.del(cacheKey);
        }
    }
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
                    emailVerified: true,
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
            },
        },
    });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }

    if (user.role === Role.CUSTOMER && shipment.user.id !== user.userId) {
        throw new AppError(status.FORBIDDEN, "Access denied");
    }

    await redis.set(cacheKey, JSON.stringify(shipment), { ex: CACHE_TTL });

    return shipment;
};

const updateShipmentStatus = async (
    id: string,
    payload: IUpdateShipmentStatus,
    user: IRequestUser
) => {
    const shipment = await prisma.shipment.findUnique({
        where: { id },
        include: {
            user: {
                select: {
                    name: true,
                    email: true,
                },
            },
        },
    });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }

    if (shipment.status === payload.status) {
        throw new AppError(status.BAD_REQUEST, `Shipment is already ${payload.status}`);
    }

    if (shipment.status === ShipmentStatus.DELIVERED) {
        throw new AppError(status.BAD_REQUEST, "Cannot update a delivered shipment");
    }

    if (shipment.status === ShipmentStatus.CANCELLED) {
        throw new AppError(status.BAD_REQUEST, "Cannot update a cancelled shipment");
    }

    const currentIndex = STATUS_ORDER.indexOf(shipment.status);
    const newIndex = STATUS_ORDER.indexOf(payload.status);

    if (newIndex < currentIndex && payload.status !== ShipmentStatus.CANCELLED) {
        throw new AppError(
            status.BAD_REQUEST,
            `Cannot change status from ${shipment.status} back to ${payload.status}`
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
                        name: true,
                    },
                },
            },
        }),
        prisma.statusLog.create({
            data: {
                shipmentId: id,
                status: payload.status,
                location: payload.location,
                note: payload.note ?? null,
                updateBy: user.name,
            },
        }),
    ]);

    await invalidateShipmentCache();
    try {
        await sendEmail({
            to: shipment.user.email,
            subject: `Shipment Status Updated: ${payload.status} - FreightAgent`,
            templateName: "shipmentStatus",
            templateData: {
                name: shipment.user.name,
                trackingId: shipment.trackingId,
                previousStatus: shipment.status,
                newStatus: payload.status,
                location: payload.location,
                note: payload.note || "N/A",
                updatedByName: user.name,
                updatedByEmail: user.email,
                trackUrl: `${envConfig.FRONTEND_URL}/dashboard/tracking`,
                updatedAt: new Date().toLocaleString("en-US", {
                    timeZone: "Asia/Dhaka",
                    dateStyle: "medium",
                    timeStyle: "short",
                }),
            },
        });
    } catch (err) {
        console.error("Status update email failed:", err);
    }

    return updated;
};

const deleteShipment = async (id: string) => {
    const shipment = await prisma.shipment.findUnique({ where: { id } });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }

    if (shipment.status === ShipmentStatus.DELIVERED) {
        throw new AppError(status.BAD_REQUEST, "Cannot delete a delivered shipment");
    }


    await prisma.$transaction([
        prisma.statusLog.deleteMany({ where: { shipmentId: id } }),
        prisma.shipment.delete({ where: { id } }),
    ]);

    await invalidateShipmentCache();

    return { message: "Shipment deleted successfully" };
};

const trackShipment = async (trackingId: string) => {
    const cacheKey = `shipment:track:${trackingId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached as string);
        } catch (e) {
            await redis.del(cacheKey);
        }
    }

    const shipment = await prisma.shipment.findUnique({
        where: { trackingId },
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
                    id: true,
                    status: true,
                    location: true,
                    note: true,
                    updateBy: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }

    await redis.set(cacheKey, JSON.stringify(shipment), { ex: 30 });

    return shipment;
};

export const shipmentService = {
    createShipment,
    getAllShipments,
    getMyShipments,
    getShipmentById,
    updateShipmentStatus,
    deleteShipment,
    trackShipment,
};