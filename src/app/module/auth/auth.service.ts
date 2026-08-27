import { Request } from "express";
import { IChangePassword, ICreateAdmin, ILoginInput, IRegisterInput } from "./auth.interface";
import AppError from "../../../errorHelper/AppError";
import status from "http-status";
import { prisma } from "../../../lib/prisma";
import { auth } from "../../../lib/auth";
import { tokenUtils } from "../../../utils/token";
import { Role } from "../../../generated/prisma";
import { IRequestUser } from "../../interface/requestUserInterface";
import { isTempEmail } from "../../../utils/emailValidator";
import { sendEmail } from "../../../utils/email";
import { JwtTokenUtils } from "../../../utils/jwt";
import { blacklistToken } from "../../../utils/tokenBlacklist";
import { envConfig } from "../../../_config/env";
import { sendWelcomeEmail } from "../../../utils/sendWelcomeEmail";


const refreshToken = async (token: string) => {
    if (!token) {
        throw new AppError(status.UNAUTHORIZED, "Refresh token missing");
    }

    //  Refresh token verify করো
    const result = JwtTokenUtils.verifyToken(
        token,
        envConfig.REFRESH_TOKEN_SECRET
    );

    if (!result.success || !result.data) {
        throw new AppError(status.UNAUTHORIZED, "Invalid or expired refresh token");
    }

    const decoded = result.data;
    const userExists = await prisma.user.findUnique({
        where: { id: decoded.userId as string },
        select: {
            id: true,
            email: true,
            role: true,
            image: true,
            emailVerified: true,
            createdAt: true,
        },
    });

    if (!userExists) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    //  নতুন Access Token generate করো
    const tokenPayload = {
        userId: userExists.id,
        email: userExists.email,
        role: userExists.role,
        image: userExists.image,
        emailVerified: userExists.emailVerified,
        createdAt: userExists.createdAt,
    };

    const accessToken = tokenUtils.getAccessToken(tokenPayload);

    return { accessToken };
};
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
        name: customer.name,
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

const logout = async (accessToken: string, sessionToken: string) => {
    //  Access token decode করো — expire time বের করো
    const decoded = JwtTokenUtils.decodedToken(accessToken);

    if (decoded && decoded.exp) {
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = decoded.exp - now; // বাকি seconds

        if (expiresIn > 0) {
            await blacklistToken(accessToken, expiresIn); // ← Redis এ রাখো
        }
    }

    //  BetterAuth session revoke করো
    await auth.api.revokeSession({
        body: {
            token: sessionToken
        },
        headers: {
            authorization: `Bearer ${sessionToken} `
        }
    });
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

    const user = await prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            emailVerified: true,
        }
    });
    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }
    await sendWelcomeEmail(user.name, user.email, user.role);
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
                orderBy: { createdAt: "desc" },
                take: 10
            },
        },
    });

    if (!existingUser) {
        throw new AppError(status.NOT_FOUND, "User not found!");
    }

    return existingUser;
};
const forgotPassword = async (email: string) => {
    const userExits = await prisma.user.findUnique({
        where: {
            email
        }
    })
    if (!userExits) {
        throw new AppError(status.NOT_FOUND, "User not found")
    }
    if (!userExits.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Eamil Not Verfied")
    }
    await auth.api.requestPasswordResetEmailOTP({
        body: {
            email
        }
    })
    return { message: "OTP sent to your email" };
}
const resetPassword = async (email: string, otp: string, newPassword: string) => {
    const userExits = await prisma.user.findUnique({
        where: { email }
    });

    if (!userExits) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (!userExits.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Email Not Verified");
    }

    await auth.api.resetPasswordEmailOTP({
        body: {
            email,
            otp,
            password: newPassword
        }
    });

    await prisma.session.deleteMany({
        where: { userId: userExits.id }
    });
    try {
        await sendEmail({
            to: email,
            subject: "Password Changed Successfully - FreightAgent",
            templateName: "passwordChanged", // ← নতুন template
            templateData: {
                name: userExits.name ?? "User",
                email: userExits.email,
                time: new Date().toLocaleString("en-US", {
                    timeZone: "Asia/Dhaka",
                    dateStyle: "medium",
                    timeStyle: "short",
                }),
            },
        });
    } catch (error) {
        console.error("Email failed:", error);
    }
};
// Send OTP
const sendChangePasswordOTP = async (user: IRequestUser) => {
    const userExists = await prisma.user.findUnique({
        where: { id: user.userId }
    });

    if (!userExists) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    await auth.api.sendVerificationOTP({
        body: {
            email: userExists.email,
            type: "forget-password" // ← এটাই use করো
        }
    });
};

// Verify OTP + Change Password
const changePassword = async (payload: IChangePassword, user: IRequestUser) => {
    const userExists = await prisma.user.findUnique({
        where: { id: user.userId }
    });

    if (!userExists) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    try {
        await auth.api.resetPasswordEmailOTP({
            body: {
                email: userExists.email,
                otp: payload.otp,
                password: payload.newPassword
            }
        });
    } catch (error: any) {
        throw new AppError(status.BAD_REQUEST, "Invalid or expired OTP");
    }
    await prisma.session.deleteMany({
        where: { userId: user.userId }
    });

    const tokenPayload = {
        userId: user.userId,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,

    };

    const accessToken = tokenUtils.getAccessToken(tokenPayload);
    const refreshToken = tokenUtils.getRefreshToken(tokenPayload);

    await sendEmail({
        to: userExists.email,
        subject: "Password Changed Successfully - FreightAgent",
        templateName: "passwordChanged",
        templateData: {
            name: userExists.name ?? "User",
            email: userExists.email,
            time: new Date().toLocaleString("en-US", {
                timeZone: "Asia/Dhaka",
                dateStyle: "medium",
                timeStyle: "short",
            }),
        },
    });

    return { accessToken, refreshToken };
};
const createAdmin = async (payload: IRegisterInput) => {
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
    const adminData = await auth.api.signUpEmail({
        body: {
            email: payload.email,
            name: payload.name,
            password: payload.password,
        }
    });

    await prisma.user.update({
        where: { email: payload.email },
        data: { role: Role.ADMIN }
    });
    if (!adminData.user) {
        throw new AppError(status.BAD_REQUEST, "User not created");
    }
    await auth.api.sendVerificationOTP({
        body: {
            email: payload.email,
            type: "email-verification"
        }
    });
    console.log(adminData)
    return {
        adminData
    };

}
const createAgent = async (payload: IRegisterInput) => {
    if (await isTempEmail(payload.email)) {
        throw new AppError(status.BAD_REQUEST, "Temporary emails are not allowed");
    };
    const existingUser = await prisma.user.findUnique({
        where: { email: payload.email }
    });
    if (existingUser) {
        throw new AppError(status.CONFLICT, "User already exists with this email");
    };
    const data = await auth.api.signUpEmail({
        body: {
            name: payload.name,
            email: payload.email,
            password: payload.password,
        }
    });
    if (!data.user) {
        throw new AppError(status.BAD_REQUEST, "Agent not created");
    }
    await prisma.user.update({
        where: { id: data.user.id },
        data: { role: Role.AGENT }
    });
    await auth.api.sendVerificationOTP({
        body: {
            email: payload.email,
            type: "email-verification"
        }
    });
    return {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: Role.AGENT,
        emailVerified: false,
    };

}

export const authService = {
    refreshToken,
    register,
    loginUser,
    logout,
    sendOtp,
    verifyEmail,
    getMe,
    forgotPassword,
    resetPassword,
    changePassword,
    sendChangePasswordOTP,
    createAdmin,
    createAgent
};