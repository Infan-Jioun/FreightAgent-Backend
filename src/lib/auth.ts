import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { envConfig } from "../_config/env";
import { bearer, emailOTP } from 'better-auth/plugins';
import { sendEmail } from "../utils/email";

export const auth = betterAuth({
    baseURL: envConfig.BETTER_AUTH_URL,
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    secret: envConfig.BETTER_AUTH_SECRET,
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
    },
    plugins: [
        bearer(),
        emailOTP({
            otpLength: 6,        // ✅ 6 digit OTP
            expiresIn: 600,      // ✅ 10 minutes
            async sendVerificationOTP({ email, otp, type }) {
                if (type === "email-verification") {
                    const user = await prisma.user.findUnique({ where: { email } });
                    if (user && !user.emailVerified) {
                        await sendEmail({
                            to: email,
                            subject: "Verify your email - OTP",
                            templateName: "otp",
                            templateData: {
                                name: user.name ?? "User",
                                otp: String(otp),
                            },
                        });
                    }
                }

                if (type === "sign-in") {
                    const user = await prisma.user.findUnique({ where: { email } });
                    await sendEmail({
                        to: email,
                        subject: "Change Password - OTP", // ← আলাদা subject!
                        templateName: "otp",
                        templateData: {
                            name: user?.name ?? "User",
                            otp: String(otp),
                        },
                    });
                }

                if (type === "forget-password") {
                    const user = await prisma.user.findUnique({ where: { email } });
                    await sendEmail({
                        to: email,
                        subject: "Reset & Change Password - OTP",
                        templateName: "otp",
                        templateData: {
                            name: user?.name ?? "User",
                            otp: String(otp),
                        },
                    });
                }
            },
        }),
    ],
});