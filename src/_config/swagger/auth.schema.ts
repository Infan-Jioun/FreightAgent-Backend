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
                                name: { type: "string", example: "John Doe" },
                                email: { type: "string", example: "john@example.com" },
                                password: { type: "string", example: "Test@123" },
                            },
                        },
                    },
                },
            },
            responses: {
                201: { description: "User registered successfully. Please verify your email." },
                400: { description: "Bad request - Validation error" },
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
                                email: { type: "string", example: "john@example.com" },
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
    "/auth/logout": {
        post: {
            summary: "Logout user",
            tags: ["Auth"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            responses: {
                200: { description: "Logged out successfully" },
            },
        },
    },
    "/auth/refresh-token": {
        post: {
            summary: "Refresh access token",
            tags: ["Auth"],
            security: [{ cookieAuth: [] }],
            responses: {
                200: { description: "Token refreshed successfully" },
                401: { description: "Refresh token missing or invalid" },
            },
        },
    },
    "/auth/send-otp": {
        post: {
            summary: "Send verification OTP to email",
            tags: ["Auth"],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["email"],
                            properties: {
                                email: { type: "string", example: "john@example.com" },
                            },
                        },
                    },
                },
            },
            responses: {
                200: { description: "OTP sent to your email" },
                400: { description: "Invalid email" },
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
                                email: { type: "string", example: "john@example.com" },
                                otp: { type: "string", example: "123456" },
                            },
                        },
                    },
                },
            },
            responses: {
                200: { description: "Email verified successfully" },
                400: { description: "Invalid or expired OTP" },
            },
        },
    },
    "/auth/me": {
        get: {
            summary: "Get current authenticated user profile",
            tags: ["Auth"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            responses: {
                200: { description: "User fetched successfully" },
                401: { description: "Unauthorized" },
            },
        },
    },
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
                                email: { type: "string", example: "john@example.com" },
                            },
                        },
                    },
                },
            },
            responses: {
                200: { description: "Password reset OTP sent to email successfully" },
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
                                email: { type: "string", example: "john@example.com" },
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
    "/auth/change-password/send-otp": {
        post: {
            summary: "Send change password OTP to current user's email",
            tags: ["Auth"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            responses: {
                200: { description: "OTP sent to your email" },
                401: { description: "Unauthorized" },
            },
        },
    },
    "/auth/change-password": {
        post: {
            summary: "Change password using OTP",
            tags: ["Auth"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["currentPassword", "newPassword", "otp"],
                            properties: {
                                currentPassword: { type: "string", example: "OldPass@123" },
                                newPassword: { type: "string", example: "NewPass@123" },
                                otp: { type: "string", example: "123456" },
                            },
                        },
                    },
                },
            },
            responses: {
                200: { description: "Password changed successfully" },
                400: { description: "Bad request - Incorrect current password or invalid OTP" },
                401: { description: "Unauthorized" },
            },
        },
    },
    "/auth/create-admin": {
        post: {
            summary: "Create new Admin",
            tags: ["Auth"],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["name", "email", "password"],
                            properties: {
                                name: { type: "string", example: "Admin User" },
                                email: { type: "string", example: "admin@example.com" },
                                password: { type: "string", example: "AdminPass@123" },
                                role: { type: "string", example: "ADMIN" },
                            },
                        },
                    },
                },
            },
            responses: {
                201: { description: "Admin registered successfully. Please verify email." },
                400: { description: "Bad request" },
            },
        },
    },
    "/auth/create-agent": {
        post: {
            summary: "Create new Agent",
            tags: ["Auth"],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["name", "email", "password"],
                            properties: {
                                name: { type: "string", example: "Agent User" },
                                email: { type: "string", example: "agent@example.com" },
                                password: { type: "string", example: "AgentPass@123" },
                                role: { type: "string", example: "AGENT" },
                            },
                        },
                    },
                },
            },
            responses: {
                201: { description: "Agent registered successfully. Please verify email." },
                400: { description: "Bad request" },
            },
        },
    },
};