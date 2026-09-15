import { redis } from "../lib/redis";

export const invalidateAgentCache = async (agentId?: string): Promise<void> => {
    let cursor = 0;
    const patterns = agentId
        ? [`agent:assigned:${agentId}:*`, `agent:shipment:*:${agentId}`, `agent:profile:${agentId}`]
        : ["agent:*"];

    for (const match of patterns) {
        cursor = 0;
        do {
            const [nextCursor, keys] = await redis.scan(cursor, {
                match,
                count: 100,
            });

            cursor = Number(nextCursor);

            if (keys.length > 0) {
                await Promise.allSettled(keys.map((key) => redis.del(key)));
            }
        } while (cursor !== 0);
    }
};

export const invalidateRoadAgentsCache = async (): Promise<void> => {
    let cursor = 0;

    do {
        const [nextCursor, keys] = await redis.scan(cursor, {
            match: "admin:agents:*",
            count: 100,
        });

        cursor = Number(nextCursor);

        if (keys.length > 0) {
            await Promise.allSettled(keys.map((key) => redis.del(key)));
        }
    } while (cursor !== 0);
};
