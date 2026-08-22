import { Request } from "express";
import { ILoginInput, IRegisterInput } from "./auth.interface";
import { prisma } from "../../lib/prisma";
import AppError from "../../app/errorHelper/AppError";
import status from "http-status";
import { auth } from "../../lib/auth";
import { tokenUtils } from "../../utils/token";
import { Role } from "../../generated/prisma";

const register = async (payload: IRegisterInput) => {
    // ✅ আগে validate করো
    if (!payload.email || !payload.password || !payload.name) {
        throw new AppError(status.BAD_REQUEST, "Name, Email and Password are required");
    }

    // ✅ আগে থেকে user আছে কিনা check করো
    const existingUser = await prisma.user.findUnique({
        where: { email: payload.email }
    });

    if (existingUser) {
        throw new AppError(status.CONFLICT, "User already exists with this email");
    }

// ✅ BetterAuth দিয়ে user create করো
    const data = await auth.api.signUpEmail({
        body: {
            name: payload.name,
            email: payload.email,
            password: payload.password,
        }
    });

    if (!data.user) {
        throw new AppError(status.BAD_REQUEST, "User not created");
    }

    // ✅ Register এর সাথে সাথে OTP পাঠাও
    await auth.api.sendVerificationOTP({
        body: {
            email: payload.email,
            type: "email-verification"
        }
    });

    // ✅ Token generate করো
    const accessToken = tokenUtils.getAccessToken({
        userId: data.user.id,
        email: data.user.email,
        role: payload.role || Role.CUSTOMER,
        image: data.user.image,
        createdAt: data.user.createdAt,
        emailVerified: data.user.emailVerified,
    });

    const refreshToken = tokenUtils.getRefreshToken({
        userId: data.user.id,
        email: data.user.email,
        role: payload.role || Role.CUSTOMER,
        image: data.user.image,
        createdAt: data.user.createdAt,
        emailVerified: data.user.emailVerified,
    });

    return {
        user: data.user,
        accessToken,
        refreshToken,
    };
};
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

    // ✅ email verified না হলে automatically OTP পাঠাও
    if (!result.user.emailVerified) {
        await auth.api.sendVerificationOTP({
            body: {
                email: payload.email as string,
                type: "email-verification"
            }
        });

        throw new AppError(
            status.FORBIDDEN,
            "Email not verified. OTP sent to your email. Please verify first."
        );
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
    });
    return result;
};
const sendOtp = async (email: string) => {
    // user আছে কিনা check করো
    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (user.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Email already verified");
    }

    // BetterAuth দিয়ে OTP পাঠাও
    await auth.api.sendVerificationOTP({
        body: {
            email,
            type: "email-verification"
        }
    });

    return null;
};
const verifyEmail = async (otp: string, email: string) => {
    const result = await auth.api.verifyEmailOTP({
        body: { email, otp }
    });

    // ✅ verify successful হলে update করো
    if (result.status) {
        await prisma.user.update({
            where: { id: result.user.id },
            data: { emailVerified: true }
        });
    }

    return result;
};

export const authService = {
    register,
    loginUser,
    logout,
    sendOtp,
    verifyEmail
};