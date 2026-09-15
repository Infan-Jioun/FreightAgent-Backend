import { Role, ShipmentStatus } from "../generated/prisma";
import { prisma } from "../lib/prisma";
import { notifyAgent } from "../lib/socket";
import { invalidateShipmentCache } from "./invalidateShipmentCache";


export const autoAssignAgent = async (shipmentId: string, origin: string) => {

    // city বের করো origin থেকে
    // "Agrabad, Chattogram" → "Chattogram"
    const city = origin.split(',').pop()?.trim() ?? origin;

    // ওই city তে সবচেয়ে কম কাজে থাকা available agent খোঁজো
    const agent = await prisma.user.findFirst({
        where: {
            role: Role.AGENT,
            assignedArea: city,
            isAvailable: true,
            isBlocked: false,
            isDeleted: false,
        },
        orderBy: {
            agentShipments: { _count: 'asc' }
        },
        select: {
            id: true,
            name: true,
            email: true,
        }
    });

    if (!agent) {
        console.warn(`[AutoAssign] No agent found for city: ${city}`);
        // TODO: admin notification
        return null;
    }

    // Transaction — assign + statusLog একসাথে
    const [updated] = await prisma.$transaction([
        prisma.shipment.update({
            where: { id: shipmentId },
            data: {
                agentId: agent.id,
                status: ShipmentStatus.ASSIGNED,
            },
            select: {
                id: true,
                trackingId: true,
                origin: true,
                destination: true,
                status: true,
                agentId: true,
            }
        }),
        prisma.statusLog.create({
            data: {
                shipmentId,
                status: ShipmentStatus.ASSIGNED,
                location: city,
                note: `Auto-assigned to agent: ${agent.name}`,
                updateBy: agent.id,
            }
        }),
    ]);

    await invalidateShipmentCache();

    // Socket.IO — agent কে notify করো
    notifyAgent(agent.id, {
        message: `New shipment assigned`,
        shipment: updated,
    });

    return updated;
};