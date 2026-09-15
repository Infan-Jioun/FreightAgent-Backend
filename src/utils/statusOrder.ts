import { ShipmentStatus } from "../generated/prisma";
export const STATUS_ORDER: ShipmentStatus[] = [
    ShipmentStatus.PENDING,
    ShipmentStatus.ASSIGNED,
    ShipmentStatus.ACCEPTED,
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.AT_CUSTOMS,
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.DELIVERED,
    ShipmentStatus.CANCELLED,
];