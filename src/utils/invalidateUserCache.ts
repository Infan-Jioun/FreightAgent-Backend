import { redis } from "../lib/redis";

export const invalidateAdminUsersCache = async (): Promise<void> => {
    const startTime = Date.now();
    let deletedCount = 0;
    let cursor = 0;

    try {
        do {
            const [nextCursor, keys] = await redis.scan(cursor, {
                match: "admin:users:*",
                count: 100,
            });

            cursor = Number(nextCursor);

            if (keys.length > 0) {
                const CHUNK_SIZE = 500;
                for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
                    const chunk = keys.slice(i, i + CHUNK_SIZE);
                    await redis.del(...chunk);
                }
                deletedCount += keys.length;
            }

        } while (cursor !== 0);

        // ✅ Observability
        console.info(`Cache invalidated: ${deletedCount} keys in ${Date.now() - startTime}ms`);

    } catch (error) {
        // ✅ Sentry / monitoring tool-এ পাঠানো উচিত
        console.error("Failed to invalidate admin users cache:", error);
        throw error; // ✅ Caller-কে জানানো উচিত failure হয়েছে
    }
};