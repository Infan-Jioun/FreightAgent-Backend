import { Request } from "express";
import { ILoginInput, ILogoutInput, IRegisterInput } from "./auth.interface";
import { prisma } from "../../lib/prisma";
import AppError from "../../app/errorHelper/AppError";
import status from "http-status";
import { auth } from "../../lib/auth";
import { email } from "zod";
import { tokenUtils } from "../../utils/token";
import { Role } from "../../generated/prisma";



const register = async (payload: IRegisterInput) => {
    const { name, email, password } = payload;
    const data = await auth.api.signUpEmail({
        body: {
            name, email, password
        }
    })
    if (!data.user) {
        throw new AppError(status.BAD_REQUEST, "User not created");
    }
    if (!payload.email || !payload.password || !payload.name) {
        throw new AppError(status.BAD_REQUEST, "Name, Email and Password are required");
    }
    const accessToken = tokenUtils.getAccessToken({
        userId: data.user.id,
        email: data.user.email,
        role: payload.role || Role.CUSTOMER,
        image: data.user.image,
        createdAt: data.user.createdAt,
        emailVerified: data.user.emailVerified,
    })
    const refreshToken = tokenUtils.getRefreshToken({
        userId: data.user.id,
        email: data.user.email,
        role: Role,
        image: data.user.image,
        createdAt: data.user.createdAt,
        emailVerified: data.user.emailVerified,
    });
    return {
        ...data,
        accessToken,
        refreshToken
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

    const customer = await prisma.user.findUnique({
        where: { id: result.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
        },
    });

    if (!customer) {
        throw new AppError(status.NOT_FOUND, "Customer not found");
    }

    return {
        customer,
        token: result.token,
    };
};
const logout = async (sessionToken: string) => {
    const result = await auth.api.signOut({
        headers: {
            Authorization: `Bearer ${sessionToken}`
        }
    })
    return result;

}
const verifyEmail = (otp: string, email: string) => {

}
export const authService = {
    register,
    loginUser,
    logout,
    verifyEmail
}