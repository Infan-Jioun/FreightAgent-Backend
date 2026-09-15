export const paymentSwaggerDocs = {
    "/api/v1/payment/calculate-pricing": {
        post: {
            tags: ["Payment"],
            summary: "Calculate multi-currency freight pricing using Haversine distance and regional rates",
            description: "Calculates the full 13-item logistics cost breakdown in USD and converts to the requested currency via Frankfurter.app.",
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["origin", "destination", "weightKg"],
                            properties: {
                                origin: {
                                    type: "string",
                                    example: "BDCGP",
                                    description: "Origin UN/LOCODE or port name (e.g., BDCGP)",
                                },
                                destination: {
                                    type: "string",
                                    example: "CNSHA",
                                    description: "Destination UN/LOCODE or port name (e.g., CNSHA)",
                                },
                                weightKg: {
                                    type: "number",
                                    example: 250,
                                    description: "Gross cargo weight in kilograms",
                                },
                                declaredCargoValueUSD: {
                                    type: "number",
                                    example: 5000,
                                    description: "Declared cargo value in USD for customs duty and cargo insurance",
                                },
                                targetCurrency: {
                                    type: "string",
                                    example: "EUR",
                                    description: "Target currency code for real-time conversion (e.g. USD, EUR, GBP, BDT)",
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "Freight pricing calculated successfully",
                },
                400: {
                    description: "Invalid input parameters",
                },
            },
        },
    },
    "/api/v1/payment/create-intent": {
        post: {
            tags: ["Payment"],
            summary: "Initialize Stripe PaymentIntent for a shipment",
            description: "Creates or returns an active Stripe PaymentIntent for the shipment's calculated freight cost.",
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["shipmentId"],
                            properties: {
                                shipmentId: {
                                    type: "string",
                                    format: "uuid",
                                    example: "a81d4b68-f965-4f32-8418-8f85f1c9c542",
                                },
                                currency: {
                                    type: "string",
                                    example: "USD",
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "PaymentIntent created successfully with clientSecret",
                },
                400: {
                    description: "Shipment already paid or missing total cost",
                },
                403: {
                    description: "Forbidden - cannot pay for another customer's shipment",
                },
            },
        },
    },
    "/api/v1/payment/webhook": {
        post: {
            tags: ["Payment"],
            summary: "Stripe Webhook listener with Redis idempotency and replay protection",
            description: "Receives signed Stripe webhook events. Validates signature, verifies 24-hour Redis event idempotency key, and updates shipment payment status.",
            parameters: [
                {
                    name: "stripe-signature",
                    in: "header",
                    required: true,
                    schema: {
                        type: "string",
                    },
                    description: "Cryptographic HMAC signature from Stripe",
                },
            ],
            responses: {
                200: {
                    description: "Webhook event received and processed idempotently",
                },
                400: {
                    description: "Invalid signature or malformed payload",
                },
            },
        },
    },
    "/api/v1/payment/refund": {
        post: {
            tags: ["Payment"],
            summary: "Refund freight payment via Stripe (Admin Only)",
            description: "Initiates a refund on Stripe for a paid shipment and records an immutable entry in the Admin Audit Log.",
            security: [{ cookieAuth: [] }, { bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["shipmentId", "reason"],
                            properties: {
                                shipmentId: {
                                    type: "string",
                                    format: "uuid",
                                },
                                reason: {
                                    type: "string",
                                    example: "Cargo cancelled prior to dispatch",
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "Refund processed successfully and recorded in audit log",
                },
                400: {
                    description: "Shipment is not in PAID status",
                },
                403: {
                    description: "Admin role required",
                },
            },
        },
    },
};
