import { Request } from "express";
import { ILoginInput, IRegisterInput } from "./auth.interface";
import { prisma } from "../../lib/prisma";
import AppError from "../../app/errorHelper/AppError";
import status from "http-status";
import { auth } from "../../lib/auth";
import { Role } from "../../generated/prisma";

const register = async (payload: IRegisterInput, req: Request) => {
    const existingUser = await prisma.user.findUnique({
        where: {
            email: payload.email
        }
    })
    if (existingUser) {
        throw new AppError(status.CONFLICT, "Email Already Exits!")
    }
    const result = await auth.api.signUpEmail({
        body: {
            name: payload.name,
            email: payload.email,
            password: payload.password
        },
        asResponse: false
    })
    // ensure session is present before accessing it (result may be union without session)
    const session = (result as any).session ? { id: (result as any).session.id, expiresAt: (result as any).session.expiresAt } : undefined

    if (payload.role && payload.role !== Role.CUSTOMER) {
        await prisma.user.update({
            where: {
                email: payload.email,
            },
            data: { role: payload.role }
        })
        return {
            user: {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email,
                role: payload.role || Role.CUSTOMER,
            },
            token: result.token,
            ...(session ? { session } : {}),
        }
    }


    return {
        user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            role: Role.CUSTOMER,
        },
        token: result.token,
        ...(session ? { session } : {}),
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
export const authService = {
    register,
    loginUser
}