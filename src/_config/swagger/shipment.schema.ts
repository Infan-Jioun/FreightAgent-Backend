export const shipmentSwaggerDocs = {
    "/shipment": {
        post: {
            summary: "Create a new shipment",
            tags: ["Shipment"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["origin", "destination", "weight"],
                            properties: {
                                origin: { type: "string", example: "Dhaka, Bangladesh" },
                                destination: { type: "string", example: "Chittagong, Bangladesh" },
                                weight: { type: "number", example: 12.5, description: "Weight in kilograms" },
                                description: { type: "string", example: "Textiles and consumer goods" },
                                estimatedDate: { type: "string", format: "date-time", example: "2026-03-20T00:00:00.000Z" },
                            },
                        },
                    },
                },
            },
            responses: {
                201: {
                    description: "Shipment created successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "number", example: 201 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Shipment created successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string", example: "shp_123" },
                                            trackingId: { type: "string", example: "TRK-49821038" },
                                            origin: { type: "string", example: "Dhaka, Bangladesh" },
                                            destination: { type: "string", example: "Chittagong, Bangladesh" },
                                            weight: { type: "number", example: 12.5 },
                                            description: { type: "string", example: "Textiles and consumer goods" },
                                            status: { type: "string", example: "PENDING" },
                                            estimatedDate: { type: "string", format: "date-time", example: "2026-03-20T00:00:00.000Z" },
                                            createdAt: { type: "string", format: "date-time" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: { description: "Bad request - Validation error" },
                401: { description: "Unauthorized" },
            },
        },
        get: {
            summary: "Get all shipments (Admin & Agent only)",
            tags: ["Shipment"],
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
                            "PENDING",
                            "PICKED_UP",
                            "IN_TRANSIT",
                            "AT_CUSTOMS",
                            "OUT_FOR_DELIVERY",
                            "DELIVERED",
                            "CANCELLED",
                        ],
                        example: "IN_TRANSIT",
                    },
                },
                {
                    name: "search",
                    in: "query",
                    description: "Search by tracking ID, origin, or destination",
                    required: false,
                    schema: { type: "string", example: "TRK-" },
                },
            ],
            responses: {
                200: {
                    description: "Shipments fetched successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "number", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Shipments fetched successfully" },
                                    data: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string", example: "shp_123" },
                                                trackingId: { type: "string", example: "TRK-49821038" },
                                                origin: { type: "string", example: "Dhaka, Bangladesh" },
                                                destination: { type: "string", example: "Chittagong, Bangladesh" },
                                                weight: { type: "number", example: 12.5 },
                                                status: { type: "string", example: "IN_TRANSIT" },
                                                estimatedDate: { type: "string", format: "date-time" },
                                                createdAt: { type: "string", format: "date-time" },
                                                statusLogs: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            status: { type: "string" },
                                                            location: { type: "string" },
                                                            note: { type: "string" },
                                                            createdAt: { type: "string", format: "date-time" },
                                                        },
                                                    },
                                                },
                                                user: {
                                                    type: "object",
                                                    properties: {
                                                        id: { type: "string" },
                                                        name: { type: "string" },
                                                        email: { type: "string" },
                                                        role: { type: "string" },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    meta: {
                                        type: "object",
                                        properties: {
                                            page: { type: "number", example: 1 },
                                            limit: { type: "number", example: 10 },
                                            total: { type: "number", example: 50 },
                                            totalPage: { type: "number", example: 5 },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                401: { description: "Unauthorized" },
                403: { description: "Forbidden - Admin or Agent access required" },
            },
        },
    },
    "/shipment/my": {
        get: {
            summary: "Get current user's shipments",
            tags: ["Shipment"],
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
                            "PENDING",
                            "PICKED_UP",
                            "IN_TRANSIT",
                            "AT_CUSTOMS",
                            "OUT_FOR_DELIVERY",
                            "DELIVERED",
                            "CANCELLED",
                        ],
                        example: "PENDING",
                    },
                },
            ],
            responses: {
                200: {
                    description: "My shipments fetched successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "number", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "My shipments fetched successfully" },
                                    data: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string", example: "shp_123" },
                                                trackingId: { type: "string", example: "TRK-49821038" },
                                                origin: { type: "string", example: "Dhaka, Bangladesh" },
                                                destination: { type: "string", example: "Chittagong, Bangladesh" },
                                                weight: { type: "number", example: 12.5 },
                                                status: { type: "string", example: "PENDING" },
                                                estimatedDate: { type: "string", format: "date-time" },
                                                createdAt: { type: "string", format: "date-time" },
                                            },
                                        },
                                    },
                                    meta: {
                                        type: "object",
                                        properties: {
                                            page: { type: "number", example: 1 },
                                            limit: { type: "number", example: 10 },
                                            total: { type: "number", example: 3 },
                                            totalPage: { type: "number", example: 1 },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                401: { description: "Unauthorized" },
            },
        },
    },
    "/shipment/track/{trackingId}": {
        get: {
            summary: "Track shipment by tracking ID",
            tags: ["Shipment"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            parameters: [
                {
                    name: "trackingId",
                    in: "path",
                    required: true,
                    description: "Shipment Tracking ID (e.g. TRK-49821038)",
                    schema: { type: "string", example: "TRK-49821038" },
                },
            ],
            responses: {
                200: {
                    description: "Shipment tracked successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "number", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Shipment tracked successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string", example: "shp_123" },
                                            trackingId: { type: "string", example: "TRK-49821038" },
                                            origin: { type: "string", example: "Dhaka, Bangladesh" },
                                            destination: { type: "string", example: "Chittagong, Bangladesh" },
                                            weight: { type: "number", example: 12.5 },
                                            status: { type: "string", example: "IN_TRANSIT" },
                                            estimatedDate: { type: "string", format: "date-time" },
                                            createdAt: { type: "string", format: "date-time" },
                                            statusLogs: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        id: { type: "string" },
                                                        status: { type: "string", example: "IN_TRANSIT" },
                                                        location: { type: "string", example: "Dhaka Hub" },
                                                        note: { type: "string", example: "Dispatched from warehouse" },
                                                        updateBy: { type: "string", example: "Agent Smith" },
                                                        createdAt: { type: "string", format: "date-time" },
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
                404: { description: "Shipment not found" },
            },
        },
    },
    "/shipment/{id}": {
        get: {
            summary: "Get shipment details by ID",
            tags: ["Shipment"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    description: "Shipment ID",
                    schema: { type: "string", example: "shp_123" },
                },
            ],
            responses: {
                200: {
                    description: "Shipment fetched successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "number", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Shipment fetched successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string", example: "shp_123" },
                                            trackingId: { type: "string", example: "TRK-49821038" },
                                            origin: { type: "string", example: "Dhaka, Bangladesh" },
                                            destination: { type: "string", example: "Chittagong, Bangladesh" },
                                            weight: { type: "number", example: 12.5 },
                                            description: { type: "string", example: "Electronics" },
                                            status: { type: "string", example: "IN_TRANSIT" },
                                            estimatedDate: { type: "string", format: "date-time" },
                                            createdAt: { type: "string", format: "date-time" },
                                            updatedAt: { type: "string", format: "date-time" },
                                            user: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    name: { type: "string" },
                                                    email: { type: "string" },
                                                    role: { type: "string" },
                                                },
                                            },
                                            statusLogs: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        id: { type: "string" },
                                                        status: { type: "string" },
                                                        location: { type: "string" },
                                                        note: { type: "string" },
                                                        createdAt: { type: "string", format: "date-time" },
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
                403: { description: "Forbidden - Access denied" },
                404: { description: "Shipment not found" },
            },
        },
        delete: {
            summary: "Delete shipment (Admin only)",
            tags: ["Shipment"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    description: "Shipment ID",
                    schema: { type: "string", example: "shp_123" },
                },
            ],
            responses: {
                200: {
                    description: "Shipment deleted successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    httpStatusCode: { type: "number", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Shipment deleted successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            message: { type: "string", example: "Shipment deleted successfully" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: { description: "Bad request - Cannot delete a delivered shipment" },
                401: { description: "Unauthorized" },
                403: { description: "Forbidden - Admin only" },
                404: { description: "Shipment not found" },
            },
        },
    },
    "/shipment/{id}/status": {
        patch: {
            summary: "Update shipment status (Admin & Agent only)",
            tags: ["Shipment"],
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    description: "Shipment ID",
                    schema: { type: "string", example: "shp_123" },
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
                                    enum: [
                                        "PENDING",
                                        "PICKED_UP",
                                        "IN_TRANSIT",
                                        "AT_CUSTOMS",
                                        "OUT_FOR_DELIVERY",
                                        "DELIVERED",
                                        "CANCELLED",
                                    ],
                                    example: "IN_TRANSIT",
                                },
                                location: { type: "string", example: "Hub Chittagong Port" },
                                note: { type: "string", example: "Customs clearance completed" },
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
                                    httpStatusCode: { type: "number", example: 200 },
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Shipment status updated successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string", example: "shp_123" },
                                            trackingId: { type: "string", example: "TRK-49821038" },
                                            status: { type: "string", example: "IN_TRANSIT" },
                                            updatedAt: { type: "string", format: "date-time" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: { description: "Bad request - Cannot revert status or modify completed shipment" },
                401: { description: "Unauthorized" },
                403: { description: "Forbidden - Admin or Agent access required" },
                404: { description: "Shipment not found" },
            },
        },
    },
};
