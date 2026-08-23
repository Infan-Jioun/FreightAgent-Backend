export const authSwaggerDocs = {
    "/auth/register": {
        post: {
            summary: "Register a new user",
            tags: ["Auth"],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["name", "email", "password"],
                            properties: {
                                name: { type: "string", example: "Jioun" },
                                email: { type: "string", example: "jioun@gmail.com" },
                                password: { type: "string", example: "Test@123" },
                            },
                        },
                    },
                },
            },
            responses: {
                201: { description: "User registered successfully" },
                400: { description: "Bad request" },
            },
        },
    },
    "/auth/login": {
        post: {
            summary: "Login user",
            tags: ["Auth"],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["email", "password"],
                            properties: {
                                email: { type: "string", example: "jioun@gmail.com" },
                                password: { type: "string", example: "Test@123" },
                            },
                        },
                    },
                },
            },
            responses: {
                200: { description: "Login successful" },
                401: { description: "Invalid credentials" },
            },
        },
    },
    "/auth/verify-otp": {
        post: {
            summary: "Verify email OTP",
            tags: ["Auth"],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["email", "otp"],
                            properties: {
                                email: { type: "string", example: "jioun@gmail.com" },
                                otp: { type: "string", example: "123456" },
                            },
                        },
                    },
                },
            },
            responses: {
                200: { description: "Email verified successfully" },
            },
        },
    },
    "/auth/me": {
        get: {
            summary: "Get current user",
            tags: ["Auth"],
            security: [{ cookieAuth: [] }],
            responses: {
                200: { description: "User fetched successfully" },
                401: { description: "Unauthorized" },
            },
        },
    },
    // src/_config/swagger/schemas/auth.schema.ts

    "/auth/forgot-password": {
        post: {
            summary: "Forgot password - Send OTP",
            tags: ["Auth"],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["email"],
                            properties: {
                                email: { type: "string", example: "jioun@gmail.com" },
                            },
                        },
                    },
                },
            },
            responses: {
                200: { description: "OTP sent to email successfully" },
                404: { description: "User not found" },
            },
        },
    },
    "/auth/reset-password": {
        post: {
            summary: "Reset password with OTP",
            tags: ["Auth"],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["email", "otp", "newPassword"],
                            properties: {
                                email: { type: "string", example: "jioun@gmail.com" },
                                otp: { type: "string", example: "123456" },
                                newPassword: { type: "string", example: "NewPass@123" },
                            },
                        },
                    },
                },
            },
            responses: {
                200: { description: "Password reset successfully" },
                400: { description: "Invalid OTP" },
                404: { description: "User not found" },
            },
        },
    },
};