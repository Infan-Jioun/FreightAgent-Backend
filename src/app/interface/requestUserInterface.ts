import { Role } from "../../generated/prisma";

export interface IRequestUser {
    id: string;
    userId: string;
    email: string;
    role: Role;
    name: string;
    image?: string | null;
    emailVerified?: boolean;
    createdAt?: Date;
    sessionToken?: string;
}