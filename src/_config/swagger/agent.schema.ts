export const agentSwaggerDocs = {
    "/agent/assigned": {
        get: {
            summary: "Get assigned shipments for the authenticated Road Agent",
            description: "Returns a paginated list of shipments currently assigned to the authenticated road agent, with optional status filtering and search query.",
            tags: ["Agent"],
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
                    description: "Number of shipments per page",
                    required: false,
                    schema: { type: "integer", default: 10, example: 10 },
                },
                {
                    name: "status",
                    in: "query",
                    description: "Filter shipments by status",
                    required: false,
                    schema: {
                        type: "string",
                        enum: [
                            "ASSIGNED",
                            "ACCEPTED",
                            "PICKED_UP",
                            "IN_TRANSIT",
                            "DELIVERED",
                        ],
                        example: "ASSIGNED",
                    },
                },
                {
                    name: "search",
                    in: "query",
                    description: "Search by tracking ID, origin, or destination",
                    required: false,
                    schema: { type: "string", example: "Chattogram" },
                },
            ],
            responses: {
                200: {
                    description: "Assigned shipments fetched successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "integer", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Assigned shipments fetched successfully" },
                                    data: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string", example: "shipment_uuid_123" },
                                                trackingId: { type: "string", example: "FA-987654" },
                                                origin: { type: "string", example: "Agrabad, Chattogram" },
                                                destination: { type: "string", example: "Banani, Dhaka" },
                                                weight: { type: "number", example: 5.5 },
                                                description: { type: "string", example: "Fragile Electronics" },
                                                status: { type: "string", example: "ASSIGNED" },
                                                estimatedDate: { type: "string", format: "date-time" },
                                                acceptedAt: { type: "string", format: "date-time", nullable: true },
                                                assignedAt: { type: "string", format: "date-time" },
                                                assignedBy: {
                                                    type: "object",
                                                    properties: {
                                                        id: { type: "string" },
                                                        name: { type: "string", example: "Admin User" },
                                                        email: { type: "string", example: "admin@freightagent.com" },
                                                        role: { type: "string", example: "ADMIN" },
                                                    },
                                                },
                                                user: {
                                                    type: "object",
                                                    properties: {
                                                        id: { type: "string" },
                                                        name: { type: "string", example: "John Customer" },
                                                        email: { type: "string", example: "customer@example.com" },
                                                        phone: { type: "string", example: "+8801700000000" },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    meta: {
                                        type: "object",
                                        properties: {
                                            page: { type: "integer", example: 1 },
                                            limit: { type: "integer", example: 10 },
                                            total: { type: "integer", example: 5 },
                                            totalPage: { type: "integer", example: 1 },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                401: { description: "Unauthorized - Token missing or invalid" },
                403: { description: "Forbidden - Requires AGENT role" },
            },
        },
    },
    "/agent/shipments/{id}": {
        get: {
            summary: "Get specific assigned shipment by ID",
            description: "Returns detailed information of a shipment assigned to the authenticated road agent, including full customer details, route, assigner info, and chronological audit status logs.",
            tags: ["Agent"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    description: "Shipment ID (UUID)",
                    required: true,
                    schema: { type: "string", example: "shipment_uuid_123" },
                },
            ],
            responses: {
                200: {
                    description: "Assigned shipment fetched successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "integer", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Assigned shipment fetched successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string", example: "shipment_uuid_123" },
                                            trackingId: { type: "string", example: "FA-987654" },
                                            origin: { type: "string", example: "Agrabad, Chattogram" },
                                            destination: { type: "string", example: "Banani, Dhaka" },
                                            weight: { type: "number", example: 5.5 },
                                            status: { type: "string", example: "ACCEPTED" },
                                            statusLogs: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        id: { type: "string" },
                                                        status: { type: "string", example: "ACCEPTED" },
                                                        location: { type: "string", example: "Chattogram Hub" },
                                                        note: { type: "string", example: "Accepted by agent" },
                                                        createdAt: { type: "string", format: "date-time" },
                                                        updatedByUser: {
                                                            type: "object",
                                                            properties: {
                                                                id: { type: "string" },
                                                                name: { type: "string", example: "Agent Rahim" },
                                                                email: { type: "string", example: "rahim@freightagent.com" },
                                                                role: { type: "string", example: "AGENT" },
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
                403: { description: "Forbidden - Shipment is not assigned to this agent" },
                404: { description: "Shipment not found" },
            },
        },
    },
    "/agent/shipments/{id}/accept": {
        patch: {
            summary: "Accept an assigned shipment",
            description: "Allows the assigned road agent to accept a pending assignment. Moves shipment status from ASSIGNED to ACCEPTED, records acceptedAt, and dispatches real-time Socket.IO and Email notifications to the customer.",
            tags: ["Agent"],
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
                required: false,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                location: { type: "string", example: "Chattogram Port" },
                                note: { type: "string", example: "Package accepted for road transit" },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "Shipment accepted successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "integer", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Shipment accepted successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string" },
                                            trackingId: { type: "string" },
                                            status: { type: "string", example: "ACCEPTED" },
                                            acceptedAt: { type: "string", format: "date-time" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: { description: "Bad Request - Already accepted or invalid status" },
                403: { description: "Forbidden - Shipment not assigned to this agent" },
            },
        },
    },
    "/agent/shipments/{id}/status": {
        patch: {
            summary: "Update shipment transit status",
            description: "Updates the shipment progress. Allowed statuses for agents: ACCEPTED, PICKED_UP, IN_TRANSIT, DELIVERED. Records audit log with updater name/email, and triggers real-time web and email notifications to customer and admin.",
            tags: ["Agent"],
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
                            required: ["status", "location"],
                            properties: {
                                status: {
                                    type: "string",
                                    enum: ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"],
                                    example: "IN_TRANSIT",
                                },
                                location: { type: "string", example: "Feni Highway, Route 1" },
                                note: { type: "string", example: "Moving towards destination hub" },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "Shipment status updated successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "integer", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Shipment status updated successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string" },
                                            trackingId: { type: "string" },
                                            status: { type: "string", example: "IN_TRANSIT" },
                                            updatedAt: { type: "string", format: "date-time" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: { description: "Bad Request - Invalid chronological status transition" },
                403: { description: "Forbidden - Status not allowed or shipment not assigned to agent" },
            },
        },
    },
    "/agent/profile": {
        get: {
            summary: "Get Agent Profile & Route Metrics",
            description: "Fetches road agent profile details, assigned road/area, availability, active shipment count, and delivered count.",
            tags: ["Agent"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            responses: {
                200: {
                    description: "Agent profile fetched successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "integer", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Agent profile fetched successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            agent: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    name: { type: "string", example: "Agent Rahim" },
                                                    email: { type: "string", example: "rahim@freightagent.com" },
                                                    phone: { type: "string", example: "+8801811111111" },
                                                    assignedArea: { type: "string", example: "Chattogram" },
                                                    isAvailable: { type: "boolean", example: true },
                                                    role: { type: "string", example: "AGENT" },
                                                },
                                            },
                                            metrics: {
                                                type: "object",
                                                properties: {
                                                    activeCount: { type: "integer", example: 3 },
                                                    deliveredCount: { type: "integer", example: 45 },
                                                    totalAssigned: { type: "integer", example: 48 },
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
    "/agent/availability": {
        patch: {
            summary: "Toggle Road Agent Availability Status",
            description: "Enables or disables road agent availability for new shipment assignments.",
            tags: ["Agent"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["isAvailable"],
                            properties: {
                                isAvailable: { type: "boolean", example: false },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "Availability updated successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "integer", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Agent availability set to Busy" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string" },
                                            name: { type: "string" },
                                            assignedArea: { type: "string" },
                                            isAvailable: { type: "boolean", example: false },
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
};
