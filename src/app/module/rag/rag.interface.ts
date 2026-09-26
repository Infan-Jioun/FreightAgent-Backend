export type RagMessageRole = "system" | "user" | "assistant";

export interface IRagChatMessage {
    role: RagMessageRole;
    content: string;
    timestamp?: string | undefined;
}

export interface IRagQueryPayload {
    message: string;
    sessionId?: string | undefined;
    model?: string | undefined;
}

export type RagContextType =
    | "TRACKING"
    | "LOCATION"
    | "CORRIDOR"
    | "PRICING"
    | "AGENT"
    | "KNOWLEDGE_BASE";

export interface IRagContextSource {
    type: RagContextType;
    title: string;
    detail?: string | undefined;
}

export interface IRagQueryResponse {
    answer: string;
    sessionId: string;
    contextSources: IRagContextSource[];
    isCached: boolean;
    modelUsed: string;
}

export interface IPublicLocationSummary {
    id: string;
    name: string;
    code: string;
    country: string;
    countryCode: string;
    city: string;
    region: string;
    type: string;
}

export interface IPublicCorridorSummary {
    id: string;
    originCode: string;
    originName: string;
    destinationCode: string;
    destinationName: string;
    originCity: string;
    destinationCity: string;
    originCountry: string;
    destinationCountry: string;
}

export interface IPublicStatusLog {
    status: string;
    location: string;
    note: string | null;
    createdAt: string;
}

export interface IPublicTrackingSummary {
    trackingId: string;
    status: string;
    origin: string;
    destination: string;
    weight: number;
    estimatedDate: string | null;
    createdAt: string;
    latestUpdate?: string | undefined;
    statusLogs: IPublicStatusLog[];
}

export interface IRagPublicDirectoryResponse {
    totalActiveLocations: number;
    totalActiveCorridors: number;
    locations: IPublicLocationSummary[];
    corridors: IPublicCorridorSummary[];
    supportedRegions: string[];
    supportedCurrencies: string[];
}

export interface IOpenRouterMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface IOpenRouterChoice {
    message: {
        role: string;
        content: string;
    };
    finish_reason: string;
}

export interface IOpenRouterResponse {
    id: string;
    choices: IOpenRouterChoice[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    } | undefined;
}
