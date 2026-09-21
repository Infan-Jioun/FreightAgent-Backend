import status from "http-status";
import AppError from "../../../errorHelper/AppError";
import { Prisma, Role, ShipmentStatus } from "../../../generated/prisma";
import { prisma } from "../../../lib/prisma";
import { redis } from "../../../lib/redis";
import { IRequestUser } from "../../interface/requestUserInterface";
import { IAgentShipmentQuery, IAgentStatusUpdate } from "./agent.interface";
import { sendEmail } from "../../../utils/email";
import { envConfig } from "../../../_config/env";
import { STATUS_ORDER } from "../../../utils/statusOrder";
import { invalidateShipmentCache } from "../../../utils/invalidateShipmentCache";
import { invalidateRoadAgentsCache } from "../../../utils/invalidateAgentCache";
import { notifyCustomer, notifyAdmin } from "../../../lib/socket";

const CACHE_TTL = 60;

const getAssignedShipments = async (query: IAgentShipmentQuery, user: IRequestUser) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const cacheKey = `agent:assigned:${user.userId}:${page}:${limit}:${query.status || "all"}:${query.search || "none"}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            return typeof cached === "string" ? JSON.parse(cached) : cached;
        } catch (e) {
            await redis.del(cacheKey);
        }
    }

    const where: Prisma.ShipmentWhereInput = {
        agentId: user.userId,
    };

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

    const [shipments, total] = await Promise.all([
        prisma.shipment.findMany({
            where,
            select: {
                id: true,
                trackingId: true,
                origin: true,
                destination: true,
                weight: true,
                declaredCargoValue: true,
                description: true,
                status: true,
                paymentStatus: true,
                paidAt: true,
                invoiceUrl: true,
                cost: true,
                estimatedDate: true,
                acceptedAt: true,
                assignedAt: true,
                createdAt: true,
                updatedAt: true,
                assignedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        address: true,
                    },
                },
                statusLogs: {
                    select: {
                        id: true,
                        status: true,
                        location: true,
                        note: true,
                        createdAt: true,
                        updateBy: true,
                        updatedByUser: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
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

const getAssignedShipmentById = async (id: string, user: IRequestUser) => {
    const cacheKey = `agent:shipment:${id}:${user.userId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            return typeof cached === "string" ? JSON.parse(cached) : cached;
        } catch (e) {
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
            declaredCargoValue: true,
            description: true,
            status: true,
            paymentStatus: true,
            paidAt: true,
            invoiceUrl: true,
            cost: true,
            estimatedDate: true,
            acceptedAt: true,
            assignedAt: true,
            agentId: true,
            createdAt: true,
            updatedAt: true,
            assignedBy: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                },
            },
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    address: true,
                },
            },
            statusLogs: {
                select: {
                    id: true,
                    status: true,
                    location: true,
                    note: true,
                    createdAt: true,
                    updateBy: true,
                    updatedByUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }

    if (shipment.agentId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "This shipment is not assigned to you");
    }

    await redis.set(cacheKey, JSON.stringify(shipment), { ex: CACHE_TTL });

    return shipment;
};

const acceptShipment = async (
    id: string,
    payload: { location?: string; note?: string } | undefined,
    user: IRequestUser
) => {
    const shipment = await prisma.shipment.findUnique({
        where: { id },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }

    if (shipment.agentId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "This shipment is not assigned to you");
    }

    if (shipment.status === ShipmentStatus.ACCEPTED) {
        throw new AppError(status.BAD_REQUEST, "Shipment is already accepted");
    }

    if (shipment.status !== ShipmentStatus.ASSIGNED) {
        throw new AppError(
            status.BAD_REQUEST,
            `Cannot accept shipment with status: ${shipment.status}`
        );
    }

    const location = payload?.location || shipment.origin;
    const note = payload?.note || `Shipment accepted by road agent ${user.name}`;

    const [updated] = await prisma.$transaction([
        prisma.shipment.update({
            where: { id },
            data: {
                status: ShipmentStatus.ACCEPTED,
                acceptedAt: new Date(),
                updateBy: user.userId,
            },
            select: {
                id: true,
                trackingId: true,
                status: true,
                acceptedAt: true,
                updatedAt: true,
            },
        }),
        prisma.statusLog.create({
            data: {
                shipmentId: id,
                status: ShipmentStatus.ACCEPTED,
                location,
                note,
                updateBy: user.userId,
            },
        }),
    ]);

    await invalidateShipmentCache();
    await redis.del(`agent:profile:${user.userId}`);

    // Socket notification to Customer
    notifyCustomer(shipment.userId, {
        event: "shipment_accepted",
        message: `Agent ${user.name} has accepted your shipment #${shipment.trackingId}`,
        trackingId: shipment.trackingId,
        status: ShipmentStatus.ACCEPTED,
        agent: {
            id: user.userId,
            name: user.name,
            email: user.email,
        },
        updatedAt: new Date(),
    });

    // Notify Admin via Socket
    notifyAdmin({
        event: "shipment_accepted",
        message: `Agent ${user.name} accepted shipment #${shipment.trackingId}`,
        trackingId: shipment.trackingId,
        shipmentId: id,
        agentId: user.userId,
    });

    // Email to Customer
    try {
        await sendEmail({
            to: shipment.user.email,
            subject: `Shipment Accepted: #${shipment.trackingId} - FreightAgent`,
            templateName: "shipmentStatus",
            templateData: {
                name: shipment.user.name,
                trackingId: shipment.trackingId,
                previousStatus: shipment.status,
                newStatus: ShipmentStatus.ACCEPTED,
                location,
                note,
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
        console.error("Agent acceptance email notification failed:", err);
    }

    return updated;
};

const updateShipmentStatus = async (
    id: string,
    payload: IAgentStatusUpdate,
    user: IRequestUser
) => {
    const shipment = await prisma.shipment.findUnique({
        where: { id },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment not found");
    }

    if (shipment.agentId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "This shipment is not assigned to you");
    }

    const agentAllowedStatuses: ShipmentStatus[] = [
        ShipmentStatus.ACCEPTED,
        ShipmentStatus.PICKED_UP,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.DELIVERED,
    ];

    if (!agentAllowedStatuses.includes(payload.status)) {
        throw new AppError(
            status.FORBIDDEN,
            `Agent can only set status to: ${agentAllowedStatuses.join(", ")}`
        );
    }

    if (shipment.status === payload.status) {
        throw new AppError(status.BAD_REQUEST, `Shipment is already ${payload.status}`);
    }

    if (payload.status === ShipmentStatus.DELIVERED && (shipment as any).paymentStatus !== "PAID") {
        throw new AppError(
            status.BAD_REQUEST,
            "Shipment cannot be marked as DELIVERED until customer freight payment has been completed and verified (paymentStatus: PAID)"
        );
    }

    if (shipment.status === ShipmentStatus.DELIVERED) {
        throw new AppError(status.BAD_REQUEST, "Cannot update a delivered shipment");
    }

    if (shipment.status === ShipmentStatus.CANCELLED) {
        throw new AppError(status.BAD_REQUEST, "Cannot update a cancelled shipment");
    }

    const currentIndex = STATUS_ORDER.indexOf(shipment.status);
    const newIndex = STATUS_ORDER.indexOf(payload.status);

    if (newIndex < currentIndex) {
        throw new AppError(
            status.BAD_REQUEST,
            `Cannot change status from ${shipment.status} back to ${payload.status}`
        );
    }

    const [updated] = await prisma.$transaction([
        prisma.shipment.update({
            where: { id },
            data: {
                status: payload.status,
                updateBy: user.userId,
            },
            select: {
                id: true,
                trackingId: true,
                status: true,
                updatedAt: true,
            },
        }),
        prisma.statusLog.create({
            data: {
                shipmentId: id,
                status: payload.status,
                location: payload.location,
                note: payload.note ?? null,
                updateBy: user.userId,
            },
        }),
    ]);

    await invalidateShipmentCache();
    await redis.del(`agent:profile:${user.userId}`);

    // Socket.io notification to Customer
    notifyCustomer(shipment.userId, {
        event: "shipment_status_updated",
        message: `Your shipment #${shipment.trackingId} is now ${payload.status}`,
        trackingId: shipment.trackingId,
        status: payload.status,
        location: payload.location,
        note: payload.note,
        updatedBy: {
            name: user.name,
            email: user.email,
            role: user.role,
        },
        updatedAt: new Date(),
    });

    // Socket.io notification to Admin
    notifyAdmin({
        event: "agent_updated_shipment_status",
        message: `Agent ${user.name} updated shipment #${shipment.trackingId} to ${payload.status}`,
        trackingId: shipment.trackingId,
        shipmentId: id,
        status: payload.status,
        agent: {
            name: user.name,
            email: user.email,
        },
    });

    // Email to Customer
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

const getAgentProfile = async (user: IRequestUser) => {
    const cacheKey = `agent:profile:${user.userId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
        try {
            return typeof cached === "string" ? JSON.parse(cached) : cached;
        } catch (e) {
            await redis.del(cacheKey);
        }
    }

    const agent = await prisma.user.findUnique({
        where: { id: user.userId },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
            address: true,
            assignedArea: true,
            isAvailable: true,
            role: true,
            createdAt: true,
        },
    });

    if (!agent) {
        throw new AppError(status.NOT_FOUND, "Agent profile not found");
    }

    const [activeCount, deliveredCount, totalAssigned] = await Promise.all([
        prisma.shipment.count({
            where: {
                agentId: user.userId,
                status: {
                    in: [
                        ShipmentStatus.ASSIGNED,
                        ShipmentStatus.ACCEPTED,
                        ShipmentStatus.PICKED_UP,
                        ShipmentStatus.IN_TRANSIT,
                        ShipmentStatus.AT_CUSTOMS,
                        ShipmentStatus.OUT_FOR_DELIVERY,
                    ],
                },
            },
        }),
        prisma.shipment.count({
            where: {
                agentId: user.userId,
                status: ShipmentStatus.DELIVERED,
            },
        }),
        prisma.shipment.count({
            where: {
                agentId: user.userId,
            },
        }),
    ]);

    const result = {
        agent,
        metrics: {
            activeCount,
            deliveredCount,
            totalAssigned,
        },
    };

    await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });

    return result;
};

const toggleAvailability = async (user: IRequestUser, isAvailable: boolean) => {
    const updated = await prisma.user.update({
        where: { id: user.userId },
        data: { isAvailable },
        select: {
            id: true,
            name: true,
            email: true,
            assignedArea: true,
            isAvailable: true,
        },
    });

    await redis.del(`agent:profile:${user.userId}`);
    await invalidateRoadAgentsCache();

    return updated;
};

export const agentService = {
    getAssignedShipments,
    getAssignedShipmentById,
    acceptShipment,
    updateShipmentStatus,
    getAgentProfile,
    toggleAvailability,
};
