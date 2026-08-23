import { Request } from "express";
import { ILoginInput, IRegisterInput } from "./auth.interface";
import AppError from "../../../errorHelper/AppError";
import status from "http-status";
import { prisma } from "../../../lib/prisma";
import { auth } from "../../../lib/auth";
import { tokenUtils } from "../../../utils/token";
import { Role } from "../../../generated/prisma";
import { IRequestUser } from "../../interface/requestUserInterface";
import { isTempEmail } from "../../../utils/emailValidator";

// auth.service.ts
const register = async (payload: IRegisterInput) => {
    if (!payload.email || !payload.password || !payload.name) {
        throw new AppError(status.BAD_REQUEST, "Name, Email and Password are required");
    }
    if (await isTempEmail(payload.email)) {
        throw new AppError(status.BAD_REQUEST, "Temporary emails are not allowed");
    }
    const existingUser = await prisma.user.findUnique({
        where: { email: payload.email }
    });

    if (existingUser) {
        throw new AppError(status.CONFLICT, "User already exists with this email");
    }

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

    await auth.api.sendVerificationOTP({
        body: {
            email: payload.email,
            type: "email-verification"
        }
    });

    // const tokenPayload = {
    //     userId: data.user.id,
    //     email: data.user.email,
    //     role: payload.role || Role.CUSTOMER,
    //     image: data.user.image,
    //     createdAt: data.user.createdAt,
    //     emailVerified: data.user.emailVerified,
    // };

    // const accessToken = tokenUtils.getAccessToken(tokenPayload);
    // const refreshToken = tokenUtils.getRefreshToken(tokenPayload);
    // const sessionToken = data.token;

    return {
        user: data.user,
        // accessToken,
        // refreshToken,
        // sessionToken,
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

    const tokenPayload = {
        userId: customer.id,
        email: customer.email,
        role: customer.role,
    };

    const accessToken = tokenUtils.getAccessToken(tokenPayload);
    const refreshToken = tokenUtils.getRefreshToken(tokenPayload);
    const sessionToken = result.token; // ← BetterAuth session token

    return {
        user: customer,
        accessToken,
        refreshToken,
        sessionToken,
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
    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (user.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Email already verified");
    }
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

    if (!result.status) {
        throw new AppError(status.BAD_REQUEST, "Invalid or expired OTP");
    }


    const tokenPayload = {
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role || Role.CUSTOMER,
        emailVerified: true,
    };

    const accessToken = tokenUtils.getAccessToken(tokenPayload);
    const refreshToken = tokenUtils.getRefreshToken(tokenPayload);
    const sessionToken = result.token; // ← BetterAuth session token

    return {
        user: result.user,
        accessToken,
        refreshToken,
        sessionToken,
    };
};
const getMe = async (user: IRequestUser) => {
    const accessToken = tokenUtils.getAccessToken(user);
    const refreshToken = tokenUtils.getRefreshToken(user);
    if (!accessToken && !refreshToken) {
        throw new AppError(status.UNAUTHORIZED, "Unauthorized User");
    }
    if (!user) {
        throw new AppError(status.UNAUTHORIZED, "Unauthorized User");
    }
    const existingUser = await prisma.user.findUnique({

        where: { id: user.userId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
            emailVerified: true,
            createdAt: true,
            shipments: {
                select: {
                    id: true,
                    trackingId: true,
                    origin: true,
                    destination: true,
                    weight: true,
                    status: true,
                    estimatedDate: true,
                    createdAt: true,
                    statusLogs: {
                        select: {
                            id: true,
                            status: true,
                            location: true,
                            note: true,
                            createdAt: true,
                        },
                        orderBy: { createdAt: "desc" }, // latest log আগে
                    },
                },
                orderBy: { createdAt: "desc" }, // latest shipment আগে
            },
        },
    });

    if (!existingUser) {
        throw new AppError(status.NOT_FOUND, "User not found!");
    }

    return existingUser;
};
export const authService = {
    register,
    loginUser,
    logout,
    sendOtp,
    verifyEmail,
    getMe
};