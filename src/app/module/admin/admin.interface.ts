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