import z from "zod";

const requiredString = (fieldName: string) =>
    z.string({
        error: (issue) =>
            issue.input === undefined
                ? `${fieldName} is required`
                : `${fieldName} must be a string`,
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

export const loginSchema = z.object({
    body: z.object({
        email: requiredString("Email")
            .email("Invalid email address"),
        password: requiredString("Password")
            .min(8, "Password must be at least 8 characters"),
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
    body: z.object({
        currentPassword: requiredString("Current password")
            .min(8, "Password must be at least 8 characters"),
        newPassword: requiredString("New password")
            .min(8, "Password must be at least 8 characters"),
        otp: requiredString("OTP")
            .length(6, "OTP must be 6 digits"),
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