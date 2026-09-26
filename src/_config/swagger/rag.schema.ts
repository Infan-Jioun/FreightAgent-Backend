export const ragSwaggerDocs = {
    "/api/v1/rag/chat": {
        post: {
            tags: ["RAG AI Assistant"],
            summary: "Ask FreightAgent Public RAG AI Assistant",
            description:
                "Production RAG endpoint powered by OpenRouter LLM, Upstash Redis caching/session memory, and dynamic live database retrieval (ports, corridors, rates, and public shipment tracking). Does not require authentication.",
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["message"],
                            properties: {
                                message: {
                                    type: "string",
                                    example: "Which ports do you support in Asia and what is the base freight rate?",
                                    description: "The user query or question (max 2000 chars)",
                                },
                                sessionId: {
                                    type: "string",
                                    example: "a8098c1a-f86e-11da-bd1a-00112444be1e",
                                    description: "Optional session ID for multi-turn conversation memory",
                                },
                                model: {
                                    type: "string",
                                    example: "meta-llama/llama-3.3-70b-instruct:free",
                                    description: "Optional OpenRouter model override",
                                },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "AI response generated successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "AI response generated successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            answer: { type: "string" },
                                            sessionId: { type: "string" },
                                            contextSources: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        type: { type: "string" },
                                                        title: { type: "string" },
                                                        detail: { type: "string" },
                                                    },
                                                },
                                            },
                                            isCached: { type: "boolean" },
                                            modelUsed: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: { description: "Invalid input parameters" },
                429: { description: "Too many AI queries. Rate limit exceeded." },
            },
        },
    },
    "/api/v1/rag/session/{sessionId}": {
        get: {
            tags: ["RAG AI Assistant"],
            summary: "Get chat session history",
            description: "Fetches conversation turn history for a given session stored in Redis memory.",
            parameters: [
                {
                    name: "sessionId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "The session identifier",
                },
            ],
            responses: {
                200: { description: "Session history retrieved successfully" },
                400: { description: "Invalid session ID" },
            },
        },
        delete: {
            tags: ["RAG AI Assistant"],
            summary: "Clear chat session history",
            description: "Deletes conversation memory for a given session from Redis.",
            parameters: [
                {
                    name: "sessionId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "The session identifier",
                },
            ],
            responses: {
                200: { description: "Session history cleared successfully" },
            },
        },
    },
    "/api/v1/rag/public-directory": {
        get: {
            tags: ["RAG AI Assistant"],
            summary: "Get public logistics directory",
            description: "Returns a live summary of all active sea ports, corridors, supported regions, and currencies.",
            responses: {
                200: { description: "Public logistics directory retrieved successfully" },
            },
        },
    },
};
