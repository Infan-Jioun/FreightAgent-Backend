import { ShipmentStatus } from "../../../generated/prisma";

export interface IAgentShipmentQuery {
    page?: string | number;
    limit?: string | number;
    status?: ShipmentStatus;
    search?: string;
}

export interface IAgentStatusUpdate {
    status: ShipmentStatus;
    location: string;
    note?: string;
}

export interface IAgentAvailabilityUpdate {
    isAvailable: boolean;
}
