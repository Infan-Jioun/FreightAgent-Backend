// ─── Cache Helper ─────────────────────────────────────────
// Upstash redis.get() returns already-parsed object.
// This handles both Upstash (object) and plain ioredis (string) safely.
export function fromCache<T>(cached: unknown): T {
    if (typeof cached === "string") return JSON.parse(cached) as T;
    return cached as T;
}