import { ShipmentStatus } from "../../../generated/prisma";

export interface ICreateShipment {
    origin: string;
    destination: string;
    weight: number;
    declaredCargoValue?: number;
    currency?: string;
    description?: string;
    estimatedDate?: string;
}
export interface IQueryShipment {
    page?: number;
    limit?: number;
    status?: ShipmentStatus;
    search?: string;
}
export interface IUpdateShipmentStatus {
    status: ShipmentStatus,
    location: string,
    note?: string
}