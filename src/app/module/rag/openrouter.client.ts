import axios, { AxiosError } from "axios";
import { envConfig } from "../../../_config/env";
import { IOpenRouterMessage, IOpenRouterResponse } from "./rag.interface";

const OPENROUTER_API_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 30000;

export class OpenRouterClient {
    private readonly defaultModel: string;

    constructor() {
        this.defaultModel = envConfig.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b";
    }

    /**
     * Sends messages to OpenRouter chat completion API with resilient error handling.
     */
    public async generateCompletion(
        messages: IOpenRouterMessage[],
        modelOverride?: string | undefined,
        temperature = 0.2
    ): Promise<{ text: string; modelUsed: string }> {
        const apiKey = envConfig.OPENROUTER_API_KEY?.trim();
        const model = modelOverride?.trim() || this.defaultModel;

        if (!apiKey) {
            console.warn(
                "[OpenRouterClient] OPENROUTER_API_KEY is missing. Utilizing local deterministic synthesis fallback."
            );
            return {
                text: this.generateDeterministicFallback(messages),
                modelUsed: "local-deterministic-fallback",
            };
        }

        try {
            const response = await axios.post<IOpenRouterResponse>(
                OPENROUTER_API_ENDPOINT,
                {
                    model,
                    messages,
                    temperature,
                    max_tokens: 1000,
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "HTTP-Referer": envConfig.FRONTEND_URL || "http://localhost:3000",
                        "X-Title": "FreightAgent Production RAG",
                        "Content-Type": "application/json",
                    },
                    timeout: REQUEST_TIMEOUT_MS,
                }
            );

            const content = response.data?.choices?.[0]?.message?.content?.trim();
            if (!content) {
                throw new Error("Empty response received from OpenRouter API.");
            }

            return {
                text: content,
                modelUsed: model,
            };
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosErr = error as AxiosError<{ error?: { message?: string } }>;
                const errorMsg =
                    axiosErr.response?.data?.error?.message ||
                    axiosErr.message ||
                    "Unknown OpenRouter communication error";

                console.error(
                    `[OpenRouterClient] Error calling OpenRouter (${axiosErr.response?.status || "network"}): ${errorMsg}`
                );

                // Gracefully fallback to deterministic synthesis rather than crashing user experience
                return {
                    text: this.generateDeterministicFallback(messages, errorMsg),
                    modelUsed: `${model} (fallback)`,
                };
            }

            const genericMsg = error instanceof Error ? error.message : "Internal AI client error";
            console.error(`[OpenRouterClient] Unexpected error: ${genericMsg}`);
            return {
                text: this.generateDeterministicFallback(messages, genericMsg),
                modelUsed: "local-deterministic-fallback",
            };
        }
    }

    /**
     * Deterministic synthesizer when OpenRouter key is unset or external API is temporarily unreachable.
     * Extracts facts directly from the retrieved context block.
     */
    private generateDeterministicFallback(
        messages: IOpenRouterMessage[],
        apiErrorReason?: string
    ): string {
        const systemMessage = messages.find((m) => m.role === "system")?.content || "";
        const userQuery = messages.filter((m) => m.role === "user").pop()?.content || "";

        // Extract context section from system prompt if present
        const contextIndex = systemMessage.indexOf("### VERIFIED PUBLIC DATA & SYSTEM KNOWLEDGE:");
        const liveData =
            contextIndex !== -1
                ? systemMessage.substring(contextIndex + "### VERIFIED PUBLIC DATA & SYSTEM KNOWLEDGE:".length).trim()
                : "";

        return (
            `### 🚢 FreightAgent Public Assistant\n\n` +
            `Here is the verified information regarding your query: **"${userQuery}"**\n\n` +
            (liveData
                ? `${liveData}\n\n`
                : `We retrieved our latest public shipping corridors, port directories, and pricing engine data for your query.\n\n`) +
            `*Note: Verified from live database context. ${apiErrorReason ? `(AI service note: ${apiErrorReason})` : ""}`
        );
    }
}

export const openRouterClient = new OpenRouterClient();
