import { Role } from "../../generated/prisma";

export interface IRequestUser {
    name: string;
    email: string;
    role: Role
}