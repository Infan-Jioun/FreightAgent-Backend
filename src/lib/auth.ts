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


    advanced: {
        // cookiePrefix: "freightagent",
        useSecureCookies: false,
        crossSubDomainCookies: {
            enabled: false,
        },
        // defaultCookieAttributes: {
        //     httpOnly: true,
        //     secure: process.env.NODE_ENV === "production",
        //     sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        //     path: "/",
        // },
        defaultCookieAttributes: {
            httpOnly: true,
            secure: false, // ✅ localhost এ false রাখো
            sameSite: "none", // ✅ OAuth redirect এ "lax" দরকার
            path: "/",
        },
    },
    socialProviders: {
        google: {
            clientId: envConfig.GOOGLE_CLIENT_ID,
            clientSecret: envConfig.GOOGLE_CLIENT_SECRET,
            // ✅ Better Auth এর default callback path
            redirectURI: `http://localhost:5000/api/auth/callback/google`,
        },
    },
    trustedOrigins: [
        "http://localhost:3000",
        "http://localhost:5000",
        envConfig.FRONTEND_URL || "http://localhost:3000",
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
                if (type === "email-verification") {
                    const user = await prisma.user.findUnique({ where: { email } });
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
                    const user = await prisma.user.findUnique({ where: { email } });
                    await sendEmail({
                        to: email,
                        subject: "Change Password - OTP",
                        templateName: "otp",
                        templateData: { name: user?.name ?? "User", otp: String(otp) },
                    });
                }
                if (type === "forget-password") {
                    const user = await prisma.user.findUnique({ where: { email } });
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