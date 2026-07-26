import { Request } from "express";
import { ILoginInput, IRegisterInput } from "./auth.interface";
import { prisma } from "../../lib/prisma";
import AppError from "../../app/errorHelper/AppError";
import status from "http-status";
import { auth } from "../../lib/auth";
import { Role } from "../../generated/prisma";
import { email } from "zod";

const register = async (payload: IRegisterInput) => {
    const existingUser = await prisma.user.findUnique({
        where: {
            email: payload.email
        }
    })
    if (existingUser) {
        throw new AppError(status.CONFLICT, "Email Already Exits!")
    }
    const { name, email, password } = payload;
    const data = await auth.api.signUpEmail({
        body: {
            name, email, password

        },
    })
    if (!data.user) {
        throw new AppError(status.CREATED, "Successfully Registerd")
    }

    try {
        const customer = await prisma.$transaction(async (tx) => {
            // No customer model available on Prisma transaction. Remove or replace this operation.
            const customerTx = await tx.customer.create({
                data: {
                    userId: data.user.id,
                    name: payload.name,
                    email: payload.email

                }
            })
            return customerTx
        })
    } catch (error) {

    }
}



const loginUser = async (payload: ILoginInput) => {
    const result = await auth.api.signInEmail({
        body: {
            email: payload.email as string,
            password: payload.password,
        },
        asResponse: false,
    });

    if (!result) {
        throw new AppError(status.BAD_REQUEST, "Invalid Email or Password");
    }

    const user = await prisma.user.findUnique({
        where: { id: result.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
        },
    });

    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    return {
        user,
        token: result.token,
    };
};
const logout = async (payload: string) => {
    const result = await auth.api.signOut({
        body: {
            email: payload.email as string,
            password: payload.password,
        },
        asResponse: false,
    })
}
export const authService = {
    register,
    loginUser
}