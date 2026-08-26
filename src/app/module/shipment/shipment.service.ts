import { ShipmentStatus } from "../../../generated/prisma";
import { prisma } from "../../../lib/prisma";
import { redis } from "../../../lib/redis";
import { IRequestUser } from "../../interface/requestUserInterface";
import { ICreateShipment } from "./shipment.interface";

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

export const shipmentService = {
    createShipment
}