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