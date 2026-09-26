import { prisma } from "../../../lib/prisma";
import { redis } from "../../../lib/redis";
import {
    IPublicLocationSummary,
    IPublicCorridorSummary,
    IPublicTrackingSummary,
    IRagContextSource,
} from "./rag.interface";
import { REGIONAL_BASE_RATES, FIXED_ROUTE_RATES } from "../payment/pricing.engine";

// Redis Cache Keys & TTLs
const REDIS_LOCATIONS_KEY = "rag:context:locations:public";
const REDIS_CORRIDORS_KEY = "rag:context:corridors:public";
const REDIS_SUMMARY_KEY = "rag:context:summary:public";
const CACHE_TTL_SECONDS = 300; // 5 minutes live cache

export interface IRetrievedContextResult {
    contextText: string;
    sources: IRagContextSource[];
}

export class RagRetriever {
    /**
     * Dynamically retrieves public-safe context based on the user's incoming query.
     * No static seed files are used — all data is fetched live from DB and cached in Redis.
     */
    public async retrieveContext(userQuery: string): Promise<IRetrievedContextResult> {
        const normalizedQuery = userQuery.toLowerCase().trim();
        const sources: IRagContextSource[] = [];
        const contextSections: string[] = [];

        // 1. Check for Shipment Tracking ID in user query
        const trackingId = this.extractTrackingId(userQuery);
        if (trackingId) {
            const trackingData = await this.fetchPublicTrackingInfo(trackingId);
            if (trackingData) {
                sources.push({
                    type: "TRACKING",
                    title: `Shipment #${trackingData.trackingId}`,
                    detail: `Status: ${trackingData.status}, Origin: ${trackingData.origin}, Dest: ${trackingData.destination}`,
                });

                contextSections.push(
                    `[LIVE SHIPMENT TRACKING DATA]\n` +
                    `- Tracking ID: ${trackingData.trackingId}\n` +
                    `- Current Status: ${trackingData.status}\n` +
                    `- Origin: ${trackingData.origin}\n` +
                    `- Destination: ${trackingData.destination}\n` +
                    `- Cargo Weight: ${trackingData.weight} kg\n` +
                    `- Estimated Delivery: ${trackingData.estimatedDate ? new Date(trackingData.estimatedDate).toDateString() : "Pending calculation"}\n` +
                    `- Booking Date: ${new Date(trackingData.createdAt).toDateString()}\n` +
                    `- Latest Activity: ${trackingData.latestUpdate || "Shipment recorded"}\n` +
                    `- Status History Timeline:\n` +
                    trackingData.statusLogs
                        .map(
                            (log) =>
                                `  * [${new Date(log.createdAt).toISOString()}] ${log.status} at ${log.location || "N/A"}${log.note ? ` (${log.note})` : ""}`
                        )
                        .join("\n")
                );
            } else {
                contextSections.push(
                    `[TRACKING LOOKUP RESULT]\n` +
                    `User inquired about tracking ID "${trackingId}", but NO active shipment was found under this tracking number. Instruct the user to double-check their tracking ID.`
                );
            }
        }

        // 2. Fetch Active Locations & Ports (Dynamic + Redis cached)
        const locations = await this.getPublicLocations();
        const matchedLocations = this.filterRelevantLocations(locations, normalizedQuery);
        if (matchedLocations.length > 0) {
            sources.push({
                type: "LOCATION",
                title: "Ports & Cargo Hubs",
                detail: `${matchedLocations.length} port(s) matched user query`,
            });

            contextSections.push(
                `[SUPPORTED PORTS & HUBS (MATCHED)]\n` +
                matchedLocations
                    .slice(0, 15)
                    .map(
                        (loc) =>
                            `- ${loc.name} (${loc.code}) in ${loc.city}, ${loc.country} [Region: ${loc.region}, Type: ${loc.type}]`
                    )
                    .join("\n")
            );
        }

        // 3. Fetch Active Corridors / Shipping Routes (Dynamic + Redis cached)
        const corridors = await this.getPublicCorridors();
        const matchedCorridors = this.filterRelevantCorridors(corridors, normalizedQuery);
        if (matchedCorridors.length > 0) {
            sources.push({
                type: "CORRIDOR",
                title: "Active Shipping Corridors",
                detail: `${matchedCorridors.length} active corridor(s) matched`,
            });

            contextSections.push(
                `[ACTIVE SHIPPING CORRIDORS & TRADE LANES]\n` +
                matchedCorridors
                    .slice(0, 12)
                    .map(
                        (corr) =>
                            `- Route: ${corr.originName} (${corr.originCode}, ${corr.originCountry}) ➔ ${corr.destinationName} (${corr.destinationCode}, ${corr.destinationCountry})`
                    )
                    .join("\n")
            );
        }

        // 4. Dynamic Pricing Engine Context (if user asks about cost/rate/quote/pricing)
        if (this.isPricingQuery(normalizedQuery)) {
            sources.push({
                type: "PRICING",
                title: "Freight Pricing Engine",
                detail: "Official rate calculation formulas and regional tiers",
            });

            const regionalRatesText = Object.entries(REGIONAL_BASE_RATES)
                .map(([region, rate]) => `  * ${region}: $${rate.toFixed(2)}/kg base`)
                .join("\n");

            const fixedRoutesText = FIXED_ROUTE_RATES.slice(0, 5)
                .map(
                    (route) =>
                        `  * ${route.originCode} ➔ ${route.destinationCode}: Base Ocean Freight $${route.baseOceanFreightUSD} (Est. ${route.transitDaysEst} days)`
                )
                .join("\n");

            contextSections.push(
                `[FREIGHT RATE & COST CALCULATION SPECIFICATION]\n` +
                `FreightAgent calculates transparent dynamic freight pricing based on:\n` +
                `1. Regional Base Rates:\n${regionalRatesText}\n` +
                `2. Distance Multipliers: Short (<3000km: 1.0x), Medium (3000-8000km: 1.25x), Long (>8000km: 1.5x)\n` +
                `3. Fixed Commercial Corridors (High volume pre-negotiated):\n${fixedRoutesText}\n` +
                `4. Standard Fee Components Included in Breakdown:\n` +
                `   - Origin Handling & Terminal Handling (THC Origin)\n` +
                `   - Ocean Freight & BAF (Bunker Adjustment Factor)\n` +
                `   - THC Destination & Destination Handling\n` +
                `   - Customs Clearance & Import Duties (if applicable)\n` +
                `   - Cargo Insurance (0.3% of declared value, min $15)\n` +
                `   - Last-Mile Delivery & Platform/Agency Service Fees\n` +
                `5. Supported Currencies: USD (base), EUR, GBP, BDT, SGD, CNY, JPY, AED, etc.\n` +
                `6. Payment Methods: 100% secure automated checkout via Stripe.`
            );
        }

        // 5. Active Verified Agents & Network Overview
        if (
            normalizedQuery.includes("agent") ||
            normalizedQuery.includes("coverage") ||
            normalizedQuery.includes("service") ||
            normalizedQuery.includes("who") ||
            normalizedQuery.includes("broker")
        ) {
            const agentSummary = await this.getVerifiedAgentSummary();
            sources.push({
                type: "AGENT",
                title: "Freight Agents Network",
                detail: `${agentSummary.verifiedCount} verified agents active`,
            });

            contextSections.push(
                `[VERIFIED FREIGHT AGENT NETWORK]\n` +
                `- Total Verified Active Agents: ${agentSummary.verifiedCount}\n` +
                `- Operational Areas Covered: ${agentSummary.coverageAreas.join(", ") || "Global Ports & Corridors"}\n` +
                `- Public Note: All FreightAgent agents are rigorously credential-verified before assignment. Agent contact details are made available securely on booking confirmation.`
            );
        }

        // 6. Dynamic KnowledgeChunks from Database (if any exist)
        const customChunks = await this.queryDynamicKnowledgeChunks(normalizedQuery);
        if (customChunks.length > 0) {
            sources.push({
                type: "KNOWLEDGE_BASE",
                title: "Logistics Knowledge Base",
                detail: `${customChunks.length} article(s) retrieved`,
            });

            contextSections.push(
                `[OFFICIAL COMPANY & POLICY GUIDELINES]\n` +
                customChunks
                    .map((chunk) => `Category: ${chunk.category || "General"}\n${chunk.content}`)
                    .join("\n\n")
            );
        }

        // Default General Overview if context is sparse
        if (contextSections.length === 0) {
            sources.push({
                type: "LOCATION",
                title: "FreightAgent Public Port Directory",
                detail: `${locations.length} total active ports`,
            });

            const topPorts = locations
                .slice(0, 8)
                .map((loc) => `${loc.name} (${loc.code}) in ${loc.country}`)
                .join(", ");

            contextSections.push(
                `[FREIGHTAGENT PUBLIC PLATFORM SUMMARY]\n` +
                `- FreightAgent is a global digital freight forwarding and shipment management platform.\n` +
                `- We connect shippers with certified freight agents across major international sea ports and trade corridors.\n` +
                `- Featured Ports: ${topPorts}.\n` +
                `- Capabilities: Instant pricing calculation, end-to-end milestone tracking, agent corridor assignment, and Stripe payments.`
            );
        }

        return {
            contextText: contextSections.join("\n\n---\n\n"),
            sources,
        };
    }

    /**
     * Extracts a UUID tracking ID or alphanumeric tracking number from input.
     */
    private extractTrackingId(query: string): string | null {
        // Match standard UUID pattern (common in FreightAgent tracking IDs)
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const uuidMatch = query.match(uuidRegex);
        if (uuidMatch && uuidMatch[0]) {
            return uuidMatch[0];
        }

        // Match "track <ID>", "tracking #<ID>", or "shipment <ID>"
        const trackingPattern = /(?:track(?:ing)?|shipment|id)\s*[:#]?\s*([a-zA-Z0-9-]{8,36})/i;
        const match = query.match(trackingPattern);
        if (match && match[1]) {
            return match[1];
        }

        return null;
    }

    /**
     * Fetches public-only shipment tracking details directly from Prisma.
     * Strictly excludes any customer PII, internal audit data, or payment secrets.
     */
    public async fetchPublicTrackingInfo(trackingId: string): Promise<IPublicTrackingSummary | null> {
        const cacheKey = `rag:shipment:public:${trackingId}`;
        const cached = await redis.get<string>(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached) as IPublicTrackingSummary;
            } catch {
                await redis.del(cacheKey);
            }
        }

        const shipment = await prisma.shipment.findUnique({
            where: { trackingId },
            select: {
                trackingId: true,
                status: true,
                origin: true,
                destination: true,
                weight: true,
                estimatedDate: true,
                createdAt: true,
                statusLogs: {
                    select: {
                        status: true,
                        location: true,
                        note: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        if (!shipment) {
            return null;
        }

        const latestLog = shipment.statusLogs[0];
        const result: IPublicTrackingSummary = {
            trackingId: shipment.trackingId,
            status: shipment.status,
            origin: shipment.origin,
            destination: shipment.destination,
            weight: shipment.weight,
            estimatedDate: shipment.estimatedDate ? shipment.estimatedDate.toISOString() : null,
            createdAt: shipment.createdAt.toISOString(),
            latestUpdate: latestLog
                ? `${latestLog.status} at ${latestLog.location || "in-transit"} on ${new Date(latestLog.createdAt).toDateString()}`
                : undefined,
            statusLogs: shipment.statusLogs.map((log) => ({
                status: log.status,
                location: log.location,
                note: log.note,
                createdAt: log.createdAt.toISOString(),
            })),
        };

        // Cache public tracking info in Redis for 60 seconds
        await redis.set(cacheKey, JSON.stringify(result), { ex: 60 });
        return result;
    }

    /**
     * Retrieves all active locations from Redis cache or dynamically from PostgreSQL.
     */
    public async getPublicLocations(): Promise<IPublicLocationSummary[]> {
        const cached = await redis.get<string>(REDIS_LOCATIONS_KEY);
        if (cached) {
            try {
                return JSON.parse(cached) as IPublicLocationSummary[];
            } catch {
                await redis.del(REDIS_LOCATIONS_KEY);
            }
        }

        const locations = await prisma.location.findMany({
            where: {
                isBlocked: false,
                isDeleted: false,
            },
            select: {
                id: true,
                name: true,
                code: true,
                country: true,
                countryCode: true,
                city: true,
                region: true,
                type: true,
            },
            orderBy: { name: "asc" },
        });

        const formatted: IPublicLocationSummary[] = locations.map((loc) => ({
            id: loc.id,
            name: loc.name,
            code: loc.code,
            country: loc.country,
            countryCode: loc.countryCode,
            city: loc.city,
            region: loc.region,
            type: loc.type,
        }));

        await redis.set(REDIS_LOCATIONS_KEY, JSON.stringify(formatted), { ex: CACHE_TTL_SECONDS });
        return formatted;
    }

    /**
     * Retrieves active corridors from Redis cache or dynamically from PostgreSQL.
     */
    public async getPublicCorridors(): Promise<IPublicCorridorSummary[]> {
        const cached = await redis.get<string>(REDIS_CORRIDORS_KEY);
        if (cached) {
            try {
                return JSON.parse(cached) as IPublicCorridorSummary[];
            } catch {
                await redis.del(REDIS_CORRIDORS_KEY);
            }
        }

        const corridors = await prisma.agentCorridor.findMany({
            where: { isActive: true },
            select: {
                id: true,
                originPort: {
                    select: {
                        name: true,
                        code: true,
                        city: true,
                        country: true,
                    },
                },
                destinationPort: {
                    select: {
                        name: true,
                        code: true,
                        city: true,
                        country: true,
                    },
                },
            },
        });

        const formatted: IPublicCorridorSummary[] = corridors.map((corr) => ({
            id: corr.id,
            originCode: corr.originPort.code,
            originName: corr.originPort.name,
            destinationCode: corr.destinationPort.code,
            destinationName: corr.destinationPort.name,
            originCity: corr.originPort.city,
            destinationCity: corr.destinationPort.city,
            originCountry: corr.originPort.country,
            destinationCountry: corr.destinationPort.country,
        }));

        await redis.set(REDIS_CORRIDORS_KEY, JSON.stringify(formatted), { ex: CACHE_TTL_SECONDS });
        return formatted;
    }

    /**
     * Retrieves verified agent coverage statistics without disclosing PII.
     */
    private async getVerifiedAgentSummary(): Promise<{ verifiedCount: number; coverageAreas: string[] }> {
        const cached = await redis.get<string>(REDIS_SUMMARY_KEY);
        if (cached) {
            try {
                return JSON.parse(cached) as { verifiedCount: number; coverageAreas: string[] };
            } catch {
                await redis.del(REDIS_SUMMARY_KEY);
            }
        }

        const agents = await prisma.user.findMany({
            where: {
                role: "AGENT",
                agentVerificationStatus: "VERIFIED",
                isBlocked: false,
                isDeleted: false,
            },
            select: {
                assignedArea: true,
            },
        });

        const distinctAreas = Array.from(
            new Set(
                agents
                    .map((a) => a.assignedArea?.trim())
                    .filter((area): area is string => typeof area === "string" && area.length > 0)
            )
        );

        const summary = {
            verifiedCount: agents.length,
            coverageAreas: distinctAreas,
        };

        await redis.set(REDIS_SUMMARY_KEY, JSON.stringify(summary), { ex: CACHE_TTL_SECONDS });
        return summary;
    }

    /**
     * Searches database dynamic KnowledgeChunk entries matching user query keywords.
     */
    private async queryDynamicKnowledgeChunks(
        query: string
    ): Promise<Array<{ category: string | null; content: string }>> {
        try {
            const keywords = query
                .split(/\s+/)
                .filter((w) => w.length > 3)
                .slice(0, 4);

            if (keywords.length === 0) {
                return [];
            }

            const chunks = await prisma.knowledgeChunk.findMany({
                where: {
                    OR: keywords.flatMap((kw) => [
                        { content: { contains: kw, mode: "insensitive" } },
                        { category: { contains: kw, mode: "insensitive" } },
                    ]),
                },
                take: 3,
                select: {
                    category: true,
                    content: true,
                },
            });

            return chunks;
        } catch {
            return [];
        }
    }

    /**
     * Filters ports relevant to user search keywords (city, country, code, region).
     */
    private filterRelevantLocations(
        locations: IPublicLocationSummary[],
        query: string
    ): IPublicLocationSummary[] {
        return locations.filter((loc) => {
            const locName = loc.name.toLowerCase();
            const locCity = loc.city.toLowerCase();
            const locCountry = loc.country.toLowerCase();
            const locCode = loc.code.toLowerCase();
            const locRegion = loc.region.toLowerCase();

            return (
                query.includes(locCode) ||
                query.includes(locCity) ||
                query.includes(locCountry) ||
                query.includes(locName) ||
                (query.includes(locRegion) && locRegion.length > 3)
            );
        });
    }

    /**
     * Filters corridors where origin or destination matches user query keywords.
     */
    private filterRelevantCorridors(
        corridors: IPublicCorridorSummary[],
        query: string
    ): IPublicCorridorSummary[] {
        return corridors.filter((corr) => {
            const orgCode = corr.originCode.toLowerCase();
            const dstCode = corr.destinationCode.toLowerCase();
            const orgCity = corr.originCity.toLowerCase();
            const dstCity = corr.destinationCity.toLowerCase();
            const orgCountry = corr.originCountry.toLowerCase();
            const dstCountry = corr.destinationCountry.toLowerCase();

            return (
                query.includes(orgCode) ||
                query.includes(dstCode) ||
                query.includes(orgCity) ||
                query.includes(dstCity) ||
                query.includes(orgCountry) ||
                query.includes(dstCountry)
            );
        });
    }

    /**
     * Checks if user message is asking about freight cost, rates, or pricing.
     */
    private isPricingQuery(query: string): boolean {
        const pricingKeywords = [
            "cost",
            "price",
            "pricing",
            "rate",
            "quote",
            "calculate",
            "fee",
            "charge",
            "how much",
            "per kg",
            "weight",
            "baf",
            "thc",
            "insurance",
            "customs",
        ];
        return pricingKeywords.some((kw) => query.includes(kw));
    }
}

export const ragRetriever = new RagRetriever();
