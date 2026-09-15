import { redis } from "../lib/redis";

export const invalidateShipmentCache = async (id?: string, userId?: string, p0?: string | undefined): Promise<void> => {
    const patterns = ["shipment:*", "agent:assigned:*", "agent:shipment:*"];

    for (const match of patterns) {
        let cursor = 0;
        do {
            const [nextCursor, keys] = await redis.scan(cursor, {
                match,
                count: 100,
            });

            cursor = Number(nextCursor);

            if (keys.length > 0) {
                const results = await Promise.allSettled(
                    keys.map((key) => redis.del(key))
                );
                results.forEach((result, index) => {
                    if (result.status === "rejected") {
                        console.error(
                            `Failed to delete cache key "${keys[index]}":`,
                            result.reason
                        );
                    }
                });
            }
        } while (cursor !== 0);
    }
};