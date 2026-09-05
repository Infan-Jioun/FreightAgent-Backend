import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { envConfig } from "../_config/env";
import { bearer, emailOTP } from "better-auth/plugins";
import { sendEmail } from "../utils/email";

const isProd = envConfig.NODE_ENV === "production";

export const auth = betterAuth({
    baseURL: envConfig.BETTER_AUTH_URL,
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    secret: envConfig.BETTER_AUTH_SECRET,

    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
        cookieCache: {
            enabled: true,
            maxAge: 60 * 60 * 24,
        }
    },
    advanced: {
        cookies: {
            session_token: {
                name: "better-auth.session_token", // Force this exact name
                attributes: {
                    httpOnly: true,
                    secure: isProd,
                    sameSite: isProd ? "none" : "lax",
                    partitioned: isProd,
                },
            },
            state: {
                name: "session_token_better", // Force this exact name
                attributes: {
                    httpOnly: true,
                    secure: isProd,
                    sameSite: isProd ? "none" : "lax",
                    partitioned: isProd,
                },
            },
        },
    },
    socialProviders: {
        google: {
            clientId: envConfig.GOOGLE_CLIENT_ID,
            clientSecret: envConfig.GOOGLE_CLIENT_SECRET,
            redirectURI: `${envConfig.BETTER_AUTH_URL}/api/auth/callback/google`,
        },
    },

    trustedOrigins: [
        envConfig.FRONTEND_URL,                    // ✅ production URL
        "http://localhost:3000",                   // ✅ local dev
        "http://localhost:5000",
    ],

    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
    },

    plugins: [
        bearer(),
        emailOTP({
            otpLength: 6,
            expiresIn: 600,
            async sendVerificationOTP({ email, otp, type }) {

                // ✅ একবার user fetch করো, বারবার না
                const user = await prisma.user.findUnique({ where: { email } });

                if (type === "email-verification") {
                    // ✅ emailVerified check ঠিক আছে
                    if (user && !user.emailVerified) {
                        await sendEmail({
                            to: email,
                            subject: "Verify your email - OTP",
                            templateName: "otp",
                            templateData: { name: user.name ?? "User", otp: String(otp) },
                        });
                    }
                }

                if (type === "sign-in") {
                    await sendEmail({
                        to: email,
                        subject: "Sign In - OTP",
                        templateName: "otp",
                        templateData: { name: user?.name ?? "User", otp: String(otp) },
                    });
                }

                if (type === "forget-password") {
                    await sendEmail({
                        to: email,
                        subject: "Reset & Change Password - OTP",
                        templateName: "otp",
                        templateData: { name: user?.name ?? "User", otp: String(otp) },
                    });
                }
            },
        }),
    ],
});