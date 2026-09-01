import { redis } from "../lib/redis";

export const invalidateShipmentCache = async (): Promise<void> => {
    let cursor = 0;

    do {
        const [nextCursor, keys] = await redis.scan(cursor, {
            match: "shipment:*",
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
};