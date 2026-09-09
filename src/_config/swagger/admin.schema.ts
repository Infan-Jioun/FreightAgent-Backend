export const adminSwaggerDocs = {
    "/admin/users": {
        get: {
            summary: "Get all users (Admin only)",
            tags: ["Admin"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            parameters: [
                {
                    name: "page",
                    in: "query",
                    description: "Page number",
                    required: false,
                    schema: { type: "integer", default: 1, example: 1 },
                },
                {
                    name: "limit",
                    in: "query",
                    description: "Number of items per page",
                    required: false,
                    schema: { type: "integer", default: 10, example: 10 },
                },
                {
                    name: "role",
                    in: "query",
                    description: "Filter users by role",
                    required: false,
                    schema: {
                        type: "string",
                        enum: ["CUSTOMER", "AGENT", "ADMIN"],
                        example: "CUSTOMER",
                    },
                },
                {
                    name: "search",
                    in: "query",
                    description: "Search users by name or email",
                    required: false,
                    schema: { type: "string", example: "john" },
                },
            ],
            responses: {
                200: {
                    description: "Users fetched successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "number", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Users fetched successfully" },
                                    data: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string", example: "usr_abc123" },
                                                name: { type: "string", example: "John Doe" },
                                                email: { type: "string", example: "john@example.com" },
                                                role: { type: "string", example: "CUSTOMER" },
                                                image: { type: "string", nullable: true, example: null },
                                                emailVerified: { type: "boolean", example: true },
                                                createdAt: { type: "string", format: "date-time", example: "2026-03-01T10:00:00.000Z" },
                                            },
                                        },
                                    },
                                    meta: {
                                        type: "object",
                                        properties: {
                                            page: { type: "number", example: 1 },
                                            limit: { type: "number", example: 10 },
                                            total: { type: "number", example: 25 },
                                            totalPage: { type: "number", example: 3 },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                401: { description: "Unauthorized - Authentication required" },
                403: { description: "Forbidden - Admin access only" },
            },
        },
    },
    "/admin/users/{id}": {
        get: {
            summary: "Get user by ID (Admin only)",
            tags: ["Admin"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    description: "User ID",
                    schema: { type: "string", example: "usr_abc123" },
                },
            ],
            responses: {
                200: {
                    description: "User fetched successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "number", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "User fetched successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            user: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string", example: "usr_abc123" },
                                                    name: { type: "string", example: "John Doe" },
                                                    email: { type: "string", example: "john@example.com" },
                                                    role: { type: "string", example: "CUSTOMER" },
                                                    image: { type: "string", nullable: true, example: null },
                                                    emailVerified: { type: "boolean", example: true },
                                                    createdAt: { type: "string", format: "date-time" },
                                                    shipments: {
                                                        type: "array",
                                                        items: {
                                                            type: "object",
                                                            properties: {
                                                                id: { type: "string", example: "shp_123" },
                                                                userId: { type: "string", example: "usr_abc123" },
                                                                trackingId: { type: "string", example: "TRK-49821038" },
                                                                status: { type: "string", example: "IN_TRANSIT" },
                                                                origin: { type: "string", example: "Dhaka" },
                                                                destination: { type: "string", example: "Chittagong" },
                                                                weight: { type: "number", example: 10.5 },
                                                                description: { type: "string", example: "Apparel" },
                                                                estimatedDate: { type: "string", nullable: true },
                                                                createdAt: { type: "string", format: "date-time" },
                                                                updatedAt: { type: "string", format: "date-time" },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                401: { description: "Unauthorized" },
                403: { description: "Forbidden - Admin access only" },
                404: { description: "User not found" },
            },
        },
        delete: {
            summary: "Delete user (Admin only)",
            tags: ["Admin"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    description: "User ID",
                    schema: { type: "string", example: "usr_abc123" },
                },
            ],
            responses: {
                200: {
                    description: "User deleted successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "number", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "User deleted successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            message: { type: "string", example: "User deleted successfully" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: { description: "Bad request - Cannot delete yourself" },
                401: { description: "Unauthorized" },
                403: { description: "Forbidden - Cannot delete an admin user" },
                404: { description: "User not found" },
            },
        },
    },
    "/admin/users/{id}/role": {
        patch: {
            summary: "Update user role (Admin only)",
            tags: ["Admin"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    description: "User ID",
                    schema: { type: "string", example: "usr_abc123" },
                },
            ],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["role"],
                            properties: {
                                role: {
                                    type: "string",
                                    enum: ["CUSTOMER", "AGENT", "ADMIN"],
                                    example: "AGENT",
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "Role updated successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "number", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Role updated successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string", example: "usr_abc123" },
                                            name: { type: "string", example: "John Doe" },
                                            email: { type: "string", example: "john@example.com" },
                                            role: { type: "string", example: "AGENT" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: { description: "Bad request - Cannot change own role or already has this role" },
                401: { description: "Unauthorized" },
                403: { description: "Forbidden - Admin access only" },
                404: { description: "User not found" },
            },
        },
    },
};
