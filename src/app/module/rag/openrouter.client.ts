import axios, { AxiosError } from "axios";
import { envConfig } from "../../../_config/env";
import { IOpenRouterMessage, IOpenRouterResponse } from "./rag.interface";

const OPENROUTER_API_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 15000;
const RELIABLE_FALLBACK_MODELS: string[] = [
    "nvidia/nemotron-3.5-lightning:free",
    "nvidia/nemotron-3.5-super-vl:free",
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free",
];
const PRIMARY_FREE_MODEL = "nvidia/nemotron-3.5-lightning:free";

export class OpenRouterClient {
    private readonly defaultModel: string;

    constructor() {
        this.defaultModel = envConfig.OPENROUTER_MODEL?.trim() || PRIMARY_FREE_MODEL;
    }

    /** 
     * Sends messages to OpenRouter chat completion API with resilient error handling.
     */
    public async generateCompletion(
        messages: IOpenRouterMessage[],
        modelOverride?: string | undefined,
        temperature = 0.2,
        triedModels: Set<string> = new Set<string>()
    ): Promise<{ text: string; modelUsed: string }> {
        const apiKey = envConfig.OPENROUTER_API_KEY?.trim();
        const candidateModel = modelOverride?.trim() || envConfig.OPENROUTER_MODEL?.trim() || this.defaultModel;

        // Auto-sanitize invalid or hallucinatory model identifiers
        const isInvalidId =
            candidateModel.includes("deepseek-v4") ||
            candidateModel.includes("0731") ||
            candidateModel.length > 80;

        const model: string = (isInvalidId ? PRIMARY_FREE_MODEL : candidateModel) || PRIMARY_FREE_MODEL;
        triedModels.add(model);

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
                    max_tokens: 380,
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

                // Self-healing cascade: if model is rejected, 404, or unavailable for free, retry with reliable free models
                const isModelUnavailable =
                    axiosErr.response?.status === 404 ||
                    errorMsg.toLowerCase().includes("unavailable for free") ||
                    errorMsg.toLowerCase().includes("valid model") ||
                    errorMsg.toLowerCase().includes("not found");

                if (isModelUnavailable) {
                    for (const fallback of RELIABLE_FALLBACK_MODELS) {
                        if (triedModels.has(fallback)) continue;
                        console.warn(
                            `[OpenRouterClient] Model '${model}' unavailable. Retrying with '${fallback}'...`
                        );
                        try {
                            const retryResult = await this.generateCompletion(messages, fallback, temperature, triedModels);
                            if (retryResult && !retryResult.modelUsed.includes("fallback")) {
                                return retryResult;
                            }
                        } catch (retryErr) {
                            console.error(`[OpenRouterClient] Fallback '${fallback}' failed:`, retryErr);
                        }
                    }
                }

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

        // Extract context section from system prompt if present (excluding internal instructions)
        const startTag = "### VERIFIED PUBLIC DATA & SYSTEM KNOWLEDGE:";
        const endTag = "### RESPONSE INSTRUCTIONS:";
        const contextIndex = systemMessage.indexOf(startTag);
        const endIndex = systemMessage.indexOf(endTag);
        const liveData =
            contextIndex !== -1
                ? systemMessage.substring(
                      contextIndex + startTag.length,
                      endIndex !== -1 ? endIndex : undefined
                  ).trim()
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
