import { Role } from "../../generated/prisma";

export interface IRequestUser {
    userId: string;
    email: string;
    role: Role;
    image?: string | null;
    emailVerified?: boolean;
    createdAt?: Date;
}