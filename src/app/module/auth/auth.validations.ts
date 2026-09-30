import z from "zod";
import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";

const requiredString = (fieldName: string) =>
    z.string({
        error: (issue) =>
            issue.input === undefined
                ? `${fieldName} is required`
                : `${fieldName} must be a string`,
    });

const phoneSchema = requiredString("Phone number")
    .trim()
    .min(7, "Phone number is too short")
    .max(20, "Phone number is too long")
    .refine(
        (val) => {
            try {
                if (isValidPhoneNumber(val)) return true;
                if (isValidPhoneNumber(val, "BD")) return true;
                return /^\+?[0-9\s\-()]{7,20}$/.test(val);
            } catch {
                return false;
            }
        },
        "Invalid phone number. Please include valid country code (e.g. +8801XXXXXXXXX)"
    )
    .transform((val) => {
        try {
            if (isValidPhoneNumber(val)) {
                return parsePhoneNumber(val).format("E.164");
            }
            if (isValidPhoneNumber(val, "BD")) {
                return parsePhoneNumber(val, "BD").format("E.164");
            }
        } catch {
            // fallback
        }
        return val.replace(/\s+/g, "");
    });

export const registerSchema = z.object({
    body: z.object({
        name: requiredString("Name")
            .min(2, "Name must be at least 2 characters")
            .max(50, "Name too long"),
        email: requiredString("Email")
            .email("Invalid email address"),
        password: requiredString("Password")
            .min(8, "Password must be at least 8 characters"),
         
        role: z.enum(["CUSTOMER", "AGENT", "ADMIN"]).optional(),
    }),
});

export const createAgentSchema = z.object({
    body: z.object({
        name: requiredString("Name")
            .min(2, "Name must be at least 2 characters")
            .max(50, "Name too long"),
        email: requiredString("Email")
            .email("Invalid email address"),
        phone: phoneSchema,
        password: requiredString("Password")
            .min(8, "Password must be at least 8 characters"),
        role: z.enum(["CUSTOMER", "AGENT", "ADMIN"]).optional(),
    }),
});
export const adminRegisterSchema = z.object({
    body: z.object({
        name: requiredString("Name")
            .min(2, "Name must be at least 2 characters")
            .max(50, "Name too long"),
        email: requiredString("Email")
            .email("Invalid email address"),
        password: requiredString("Password")
            .min(8, "Password must be at least 8 characters"),
         
        role: z.enum(["CUSTOMER", "AGENT", "ADMIN"]).optional(),
    }),
});

export const loginSchema = z.object({
    body: z.object({
        email: requiredString("Email")
            .email("Invalid email address"),
        password: requiredString("Password")
            .min(8, "Password must be at least 8 characters"),
        revokeOthers: z.boolean().optional(),
    }),
});

export const refreshTokenSchema = z.object({
    body: z.object({
        refreshToken: requiredString("Refresh token"),
    }),
});

export const forgotPasswordSchema = z.object({
    body: z.object({
        email: requiredString("Email")
            .email("Invalid email address"),
    }),
});

export const resetPasswordSchema = z.object({
    body: z.object({
        email: requiredString("Email")
            .email("Invalid email address"),
        otp: requiredString("OTP")
            .length(6, "OTP must be 6 digits"),
        newPassword: requiredString("New password")
            .min(8, "Password must be at least 8 characters")
           
    }),
});

export const changePasswordSchema = z.object({
    body: z
        .object({
            currentPassword: requiredString("Current password")
                .min(8, "Current password must be at least 8 characters"),
            newPassword: requiredString("New password")
                .min(8, "New password must be at least 8 characters"),
            otp: requiredString("OTP")
                .length(6, "OTP must be 6 digits")
                .regex(/^\d+$/, "OTP must contain only numbers"),
        })
        .refine((data) => data.newPassword !== data.currentPassword, {
            message: "New password cannot be the same as current password",
            path: ["newPassword"],
        }),
});

export const verifyOtpSchema = z.object({
    body: z.object({
        email: requiredString("Email")
            .email("Invalid email address"),
        otp: requiredString("OTP")
            .length(6, "OTP must be 6 digits"),
    }),
});

export const sendOtpSchema = z.object({
    body: z.object({
        email: requiredString("Email")
            .email("Invalid email address"),
    }),
});


export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>["body"];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>["body"];
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>["body"];
export type SendOtpInput = z.infer<typeof sendOtpSchema>["body"];