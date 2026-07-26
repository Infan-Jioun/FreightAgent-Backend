import { Role } from "@prisma/client";
import e from "express";

export interface IRegisterInput {
    name: string;
    email: string;
    password: string;
    role?: Role
}

export interface ILoginInput {
    email: string;
    password: string;
}
export interface ILogoutInput {
    email: string;
    password: string;
}
