import { Role } from "../../../generated/prisma";

export interface IGetUserQuery {
    page?: number,
    limit?: number,
    role?: Role,
    search?: string
}
export interface IRoleUpdate {
    id : string,
    role : Role
}

export interface IUserStatusUpdate {
    id: string;
    isBlocked?: boolean | undefined;
    status?: "ACTIVE" | "BLOCKED" | "SUSPENDED" | undefined;
    reason?: string | undefined;
    blockedReason?: string | undefined;
}

export interface IRoadAgentQuery {
    page?: number | string;
    limit?: number | string;
    area?: string;
    isAvailable?: string | boolean;
    search?: string;
}

export interface IAssignRoadAgent {
    shipmentId: string;
    agentId: string;
    note?: string;
}

export interface IDeviceBreakdown {
    total: number;
    mobile: number;
    tablet: number;
    desktop: number;
}

export interface IAdminUserSession {
    id: string;
    deviceName: string;
    deviceType: "desktop" | "mobile" | "tablet";
    browser: string;
    os: string;
    ipAddress: string;
    userAgent: string | null;
    createdAt: Date;
    expiresAt: Date;
}

export interface IAdminSessionsQuery {
    page?: number | string;
    limit?: number | string;
    search?: string;
    deviceType?: "desktop" | "mobile" | "tablet";
    role?: Role;
}
