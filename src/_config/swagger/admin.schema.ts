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
    "/admin/agents": {
        get: {
            summary: "List Road Agents (Admin only)",
            description: "Fetches a paginated list of road agents with filtering by area/road, availability status, search term, and active workload count to facilitate optimal dispatching.",
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
                    description: "Number of agents per page",
                    required: false,
                    schema: { type: "integer", default: 10, example: 10 },
                },
                {
                    name: "area",
                    in: "query",
                    description: "Filter by assigned road or area name",
                    required: false,
                    schema: { type: "string", example: "Chattogram" },
                },
                {
                    name: "isAvailable",
                    in: "query",
                    description: "Filter by agent availability",
                    required: false,
                    schema: { type: "boolean", example: true },
                },
                {
                    name: "search",
                    in: "query",
                    description: "Search by agent name, email, phone, or road area",
                    required: false,
                    schema: { type: "string", example: "Rahim" },
                },
            ],
            responses: {
                200: {
                    description: "Road agents fetched successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "integer", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Road agents fetched successfully" },
                                    data: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string", example: "agent_uuid_123" },
                                                name: { type: "string", example: "Agent Rahim" },
                                                email: { type: "string", example: "rahim@freightagent.com" },
                                                phone: { type: "string", example: "+8801811111111" },
                                                assignedArea: { type: "string", example: "Chattogram Port Road" },
                                                isAvailable: { type: "boolean", example: true },
                                                isBlocked: { type: "boolean", example: false },
                                                activeShipmentsCount: { type: "integer", example: 2 },
                                            },
                                        },
                                    },
                                    meta: {
                                        type: "object",
                                        properties: {
                                            page: { type: "integer", example: 1 },
                                            limit: { type: "integer", example: 10 },
                                            total: { type: "integer", example: 4 },
                                            totalPage: { type: "integer", example: 1 },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                401: { description: "Unauthorized" },
                403: { description: "Forbidden - Admin access only" },
            },
        },
    },
    "/admin/shipments/{id}/assign": {
        patch: {
            summary: "Assign a Road Agent to a Shipment (Admin only)",
            description: "Assigns a specific road agent to a pending or in-progress shipment. Sets status to ASSIGNED, records assignedById and assignedAt, creates an audit status log, and dispatches real-time web (Socket.IO) and email notifications to both the agent and customer.",
            tags: ["Admin"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    description: "Shipment ID",
                    required: true,
                    schema: { type: "string", example: "shipment_uuid_123" },
                },
            ],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["agentId"],
                            properties: {
                                agentId: { type: "string", example: "agent_uuid_456" },
                                note: { type: "string", example: "Assigned for Agrabad to Banani corridor" },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "Road agent assigned to shipment successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "integer", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Road agent assigned to shipment successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string" },
                                            trackingId: { type: "string" },
                                            status: { type: "string", example: "ASSIGNED" },
                                            agentId: { type: "string" },
                                            assignedById: { type: "string" },
                                            assignedAt: { type: "string", format: "date-time" },
                                            agent: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    name: { type: "string", example: "Agent Rahim" },
                                                    email: { type: "string", example: "rahim@freightagent.com" },
                                                    phone: { type: "string", example: "+8801811111111" },
                                                    assignedArea: { type: "string", example: "Chattogram" },
                                                },
                                            },
                                            assignedBy: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    name: { type: "string", example: "Admin Super" },
                                                    email: { type: "string", example: "admin@freightagent.com" },
                                                    role: { type: "string", example: "ADMIN" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: { description: "Bad Request - Shipment delivered/cancelled or agent is blocked" },
                401: { description: "Unauthorized" },
                403: { description: "Forbidden - Admin access only" },
                404: { description: "Shipment or Agent not found" },
            },
        },
    },
    "/admin/users/{id}/sessions": {
        get: {
            tags: ["Admin"],
            summary: "Get user active login devices & sessions",
            description: "Allows admin to inspect which devices, browsers, and IPs a specific user is currently logged into.",
            security: [{ bearerAuth: [] }, { cookieAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    description: "Target user ID",
                    schema: { type: "string" },
                },
            ],
            responses: {
                200: {
                    description: "User active sessions and device breakdown fetched successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "integer", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "User active sessions fetched successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            user: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    name: { type: "string" },
                                                    email: { type: "string" },
                                                    role: { type: "string" },
                                                    isBlocked: { type: "boolean" },
                                                },
                                            },
                                            sessions: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        id: { type: "string" },
                                                        deviceName: { type: "string", example: "Windows 10/11 (Google Chrome)" },
                                                        deviceType: { type: "string", example: "desktop" },
                                                        browser: { type: "string", example: "Google Chrome" },
                                                        os: { type: "string", example: "Windows 10/11" },
                                                        ipAddress: { type: "string", example: "103.145.23.1" },
                                                        createdAt: { type: "string", format: "date-time" },
                                                        expiresAt: { type: "string", format: "date-time" },
                                                    },
                                                },
                                            },
                                            breakdown: {
                                                type: "object",
                                                properties: {
                                                    total: { type: "integer", example: 2 },
                                                    desktop: { type: "integer", example: 1 },
                                                    mobile: { type: "integer", example: 1 },
                                                    tablet: { type: "integer", example: 0 },
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
            tags: ["Admin"],
            summary: "Force logout user from all devices",
            description: "Terminates and blacklists all active sessions for this user.",
            security: [{ bearerAuth: [] }, { cookieAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses: {
                200: {
                    description: "All active sessions revoked successfully",
                },
                401: { description: "Unauthorized" },
                403: { description: "Forbidden - Admin access only" },
                404: { description: "User not found" },
            },
        },
    },
    "/admin/users/{id}/sessions/{sessionId}": {
        delete: {
            tags: ["Admin"],
            summary: "Terminate/Revoke a specific device session for a user",
            description: "Allows admin to forcibly log out a user from a specific device.",
            security: [{ bearerAuth: [] }, { cookieAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
                {
                    name: "sessionId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses: {
                200: {
                    description: "User session revoked successfully",
                },
                401: { description: "Unauthorized" },
                403: { description: "Forbidden - Admin access only" },
                404: { description: "Session not found for this user" },
            },
        },
    },
    "/admin/sessions": {
        get: {
            tags: ["Admin"],
            summary: "System-wide active sessions & devices list",
            description: "Allows admin to monitor active sessions across all platform users.",
            security: [{ bearerAuth: [] }, { cookieAuth: [] }],
            parameters: [
                { name: "page", in: "query", schema: { type: "integer", default: 1 } },
                { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
                { name: "search", in: "query", schema: { type: "string" } },
                { name: "deviceType", in: "query", schema: { type: "string", enum: ["desktop", "mobile", "tablet"] } },
                { name: "role", in: "query", schema: { type: "string", enum: ["CUSTOMER", "AGENT", "ADMIN"] } },
            ],
            responses: {
                200: {
                    description: "Active sessions retrieved successfully",
                },
                401: { description: "Unauthorized" },
                403: { description: "Forbidden - Admin access only" },
            },
        },
    },
};

