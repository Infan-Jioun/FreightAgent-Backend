import { Role } from "@prisma/client";

export interface IRegisterInput {
    name: string,
    email: string,
    password: string,
    role: Role
}
