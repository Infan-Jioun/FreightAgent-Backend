import { createHash, randomUUID } from "crypto";
import { redis } from "../../../lib/redis";
import { openRouterClient } from "./openrouter.client";
import { ragRetriever } from "./rag.retriever";
import {
    IRagChatMessage,
    IRagQueryPayload,
    IRagQueryResponse,
    IOpenRouterMessage,
    IRagPublicDirectoryResponse,
    IRagContextSource,
} from "./rag.interface";

// Redis Configuration
const SESSION_PREFIX = "rag:session:";
const SESSION_TTL_SECONDS = 86400; // 24 hours
const QUERY_CACHE_PREFIX = "rag:query:cache:";
const QUERY_CACHE_TTL_SECONDS = 600; // 10 minutes cache for identical questions
const MAX_HISTORY_MESSAGES = 10;

export class RagService {
    /**
     * Answers a user question dynamically using RAG (OpenRouter + Redis Cache + Dynamic DB Retrieval).
     */
    public async askQuestion(payload: IRagQueryPayload): Promise<IRagQueryResponse> {
        const userMessage = payload.message.trim();
        const sessionId = payload.sessionId?.trim() || randomUUID();

        // 1. Query Cache Check (Redis)
        const queryHash = this.computeQueryHash(userMessage);
        const cacheKey = `${QUERY_CACHE_PREFIX}${queryHash}`;
        const cachedAnswer = await redis.get<string>(cacheKey);

        if (cachedAnswer) {
            try {
                const parsedCached = JSON.parse(cachedAnswer) as {
                    answer: string;
                    sources: IRagContextSource[];
                    modelUsed: string;
                };

                // Record user question in session history even on cache hit
                await this.recordMessageInSession(sessionId, {
                    role: "user",
                    content: userMessage,
                    timestamp: new Date().toISOString(),
                });
                await this.recordMessageInSession(sessionId, {
                    role: "assistant",
                    content: parsedCached.answer,
                    timestamp: new Date().toISOString(),
                });

                return {
                    answer: parsedCached.answer,
                    sessionId,
                    contextSources: parsedCached.sources || [],
                    isCached: true,
                    modelUsed: parsedCached.modelUsed,
                };
            } catch {
                await redis.del(cacheKey);
            }
        }

        // 2. Fetch existing session conversation history from Redis
        const sessionHistory = await this.getSessionHistory(sessionId);

        // 3. Dynamic context retrieval from live database (No static seeding)
        const { contextText, sources } = await ragRetriever.retrieveContext(userMessage);

        // 4. Construct production system prompt with safety guardrails
        const systemPrompt = this.buildSystemPrompt(contextText);

        // 5. Build OpenRouter messages array (System + Recent turns + Current question)
        const openRouterMessages: IOpenRouterMessage[] = [
            { role: "system", content: systemPrompt },
        ];

        // Append recent multi-turn context (limited to MAX_HISTORY_MESSAGES)
        for (const historyItem of sessionHistory.slice(-MAX_HISTORY_MESSAGES)) {
            if (historyItem.role === "user" || historyItem.role === "assistant") {
                openRouterMessages.push({
                    role: historyItem.role,
                    content: historyItem.content,
                });
            }
        }

        // Append current turn
        openRouterMessages.push({ role: "user", content: userMessage });

        // 6. Invoke OpenRouter LLM (or deterministic fallback if key unconfigured)
        const completionResult = await openRouterClient.generateCompletion(
            openRouterMessages,
            payload.model
        );

        const finalAnswer = completionResult.text;

        // 7. Persist conversation history in Redis
        await this.recordMessageInSession(sessionId, {
            role: "user",
            content: userMessage,
            timestamp: new Date().toISOString(),
        });
        await this.recordMessageInSession(sessionId, {
            role: "assistant",
            content: finalAnswer,
            timestamp: new Date().toISOString(),
        });

        // 8. Cache response in Redis for identical queries
        await redis.set(
            cacheKey,
            JSON.stringify({
                answer: finalAnswer,
                sources,
                modelUsed: completionResult.modelUsed,
            }),
            { ex: QUERY_CACHE_TTL_SECONDS }
        );

        return {
            answer: finalAnswer,
            sessionId,
            contextSources: sources,
            isCached: false,
            modelUsed: completionResult.modelUsed,
        };
    }

    /**
     * Retrieves session message history from Redis.
     */
    public async getSessionHistory(sessionId: string): Promise<IRagChatMessage[]> {
        const sessionKey = `${SESSION_PREFIX}${sessionId}`;
        const rawHistory = await redis.get<string>(sessionKey);

        if (!rawHistory) {
            return [];
        }

        try {
            return JSON.parse(rawHistory) as IRagChatMessage[];
        } catch {
            await redis.del(sessionKey);
            return [];
        }
    }

    /**
     * Clears session conversation history in Redis.
     */
    public async clearSession(sessionId: string): Promise<{ success: boolean; message: string }> {
        const sessionKey = `${SESSION_PREFIX}${sessionId}`;
        await redis.del(sessionKey);
        return { success: true, message: `Session ${sessionId} history cleared successfully.` };
    }

    /**
     * Returns a public overview of all active ports, corridors, and platform logistics metrics.
     */
    public async getPublicDirectory(): Promise<IRagPublicDirectoryResponse> {
        const locations = await ragRetriever.getPublicLocations();
        const corridors = await ragRetriever.getPublicCorridors();

        const regions = Array.from(new Set(locations.map((l) => l.region).filter(Boolean)));
        const currencies = ["USD", "EUR", "GBP", "BDT", "SGD", "CNY", "JPY", "AED"];

        return {
            totalActiveLocations: locations.length,
            totalActiveCorridors: corridors.length,
            locations,
            corridors,
            supportedRegions: regions,
            supportedCurrencies: currencies,
        };
    }

    /**
     * Appends a message to the Redis session history with rolling window and TTL.
     */
    private async recordMessageInSession(
        sessionId: string,
        message: IRagChatMessage
    ): Promise<void> {
        const sessionKey = `${SESSION_PREFIX}${sessionId}`;
        const history = await this.getSessionHistory(sessionId);

        history.push(message);

        // Keep at most 20 messages in session to avoid memory bloat
        const trimmed = history.slice(-20);

        await redis.set(sessionKey, JSON.stringify(trimmed), { ex: SESSION_TTL_SECONDS });
    }

    /**
     * Computes a normalized SHA-256 hash of the query for semantic cache keying.
     */
    private computeQueryHash(query: string): string {
        const normalized = query.toLowerCase().replace(/[^a-z0-9]/g, "");
        return createHash("sha256").update(normalized).digest("hex");
    }

    /**
     * Constructs the official system prompt with strict security boundaries.
     */
    private buildSystemPrompt(contextText: string): string {
        return (
            `You are the official FreightAgent Public AI Assistant. FreightAgent is a modern global digital freight forwarding and logistics platform.\n\n` +
            `CORE RESPONSIBILITIES:\n` +
            `1. Provide accurate, helpful, and concise information to public visitors, shippers, and customers.\n` +
            `2. Answer inquiries about international shipping ports, active trade corridors, freight pricing formulas, and shipment tracking.\n` +
            `3. Ground your answers strictly in the verified live system context provided below.\n\n` +
            `STRICT SECURITY & PRIVACY GUARDRAILS (ZERO TOLERANCE):\n` +
            `- NEVER disclose private customer information (emails, user IDs, private addresses, passwords, credit card/Stripe tokens).\n` +
            `- NEVER disclose internal administrative secrets, database connection details, or confidential audit logs.\n` +
            `- If a tracking ID is provided, ONLY report the public milestone status, route, and timeline from the context. If no shipment is found, politely ask the user to double-check their tracking ID.\n` +
            `- If a query is outside public freight operations or unavailable in context, state politely and honestly that the information is not publicly available and suggest contacting FreightAgent support.\n` +
            `- Always match the user's communication language (e.g. if the user asks in Bengali or Banglish, reply in Bengali/Banglish; if English, reply in English).\n\n` +
            `### VERIFIED PUBLIC DATA & SYSTEM KNOWLEDGE:\n` +
            `${contextText}\n\n` +
            `### RESPONSE INSTRUCTIONS:\n` +
            `- Format your responses using clean Markdown with clear headings or bullet points where suitable.\n` +
            `- Be professional, courteous, and accurate.`
        );
    }
}

export const ragService = new RagService();
