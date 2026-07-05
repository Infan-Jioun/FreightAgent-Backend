import z from "zod";

export const registerSchema = z.object({
    body: z.object({
        name: z
            .string({ error: (issue) => issue.input === undefined ? "Name is required" : "Name must be a string" })
            .min(2, "Name must be at least 2 characters")
            .max(50, "Name too long"),
        email: z
            .string({ error: (issue) => issue.input === undefined ? "Email is required" : "Email must be a string" })
            .email("Invalid email address"),
        password: z
            .string({ error: (issue) => issue.input === undefined ? "Password is required" : "Password must be a string" })
            .min(8, "Password must be at least 8 characters")
            .regex(
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                "Password must contain uppercase, lowercase and number"
            ),
        role: z.enum(["CUSTOMER", "AGENT", "ADMIN"]).optional(),
    }),
});
export const loginSchema = z.object({
    body: z.object({
        email: z
            .string({ error: (issue) => issue.input === undefined ? "Email is required" : "Email must be a string" })
            .email("Invalid email Address"),
        password: z
            .string({ error: (issue) => issue.input === undefined ? "Password is required" : "Password must be a string" })
            .min(8, "Password must be at least 8 characters")
            .regex(
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                "Password must contain uppercase, lowercase and number"
            ),
    }),
});

export const refreshTokenSchema = z.object({
    body: z.object({
        refreshToken: z.string({ error: (issue) => issue.input === undefined ? "Refresh token is required" : "Refresh token must be a string" }),
    }),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];