import { Redis as UpstashRedis } from "@upstash/redis";
import IoRedis from "ioredis";
import { envConfig } from "../_config/env";

export interface IRedisClient {
    get<T = any>(key: string): Promise<T | null>;
    set(key: string, value: any, options?: { ex?: number; nx?: boolean }): Promise<any>;
    del(...keys: string[]): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    scan(cursor: string | number, options?: { match?: string; count?: number }): Promise<[string, string[]]>;
    incr(key: string): Promise<number>;
    decr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
    ping(): Promise<string>;
}

const createIoRedisAdapter = (): IRedisClient => {
    const client = envConfig.REDIS_URL
        ? new IoRedis(envConfig.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true })
        : new IoRedis({
            host: envConfig.REDIS_HOST || "127.0.0.1",
            port: Number(envConfig.REDIS_PORT) || 6379,
            password: envConfig.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null,
            lazyConnect: true,
        });

    client.on("connect", () => {
        console.log(`[Redis] Connected to Redis (${envConfig.REDIS_HOST || "localhost"}:${envConfig.REDIS_PORT || 6379})`);
    });

    client.on("error", (err: Error) => {
        console.error("[Redis] IoRedis connection error:", err.message);
    });

    client.connect().catch((err: Error) => {
        console.error("[Redis] Initial connection error:", err.message);
    });

    return {
        get: async <T = any>(key: string): Promise<T | null> => {
            const val = await client.get(key);
            return val as unknown as T | null;
        },
        set: async (key: string, value: any, options?: { ex?: number; nx?: boolean }): Promise<any> => {
            const strVal = typeof value === "object" ? JSON.stringify(value) : String(value);
            if (options?.ex && options?.nx) {
                return await client.set(key, strVal, "EX", options.ex, "NX");
            }
            if (options?.ex) {
                return await client.set(key, strVal, "EX", options.ex);
            }
            if (options?.nx) {
                return await client.set(key, strVal, "NX");
            }
            return await client.set(key, strVal);
        },
        del: async (...keys: string[]): Promise<number> => {
            if (!keys || keys.length === 0) return 0;
            const flat = keys.flat().filter(Boolean);
            if (flat.length === 0) return 0;
            return await client.del(...flat);
        },
        keys: async (pattern: string): Promise<string[]> => {
            return await client.keys(pattern);
        },
        scan: async (cursor: string | number, options?: { match?: string; count?: number }): Promise<[string, string[]]> => {
            const cur = String(cursor);
            const match = options?.match || "*";
            const count = options?.count || 10;
            return await client.scan(cur, "MATCH", match, "COUNT", count);
        },
        incr: async (key: string): Promise<number> => {
            return await client.incr(key);
        },
        decr: async (key: string): Promise<number> => {
            return await client.decr(key);
        },
        expire: async (key: string, seconds: number): Promise<number> => {
            return await client.expire(key, seconds);
        },
        ttl: async (key: string): Promise<number> => {
            return await client.ttl(key);
        },
        ping: async (): Promise<string> => {
            return await client.ping();
        },
    };
};

const createUpstashAdapter = (): IRedisClient => {
    const upstash = new UpstashRedis({
        url: envConfig.UPSTASH_REDIS_REST_URL,
        token: envConfig.UPSTASH_REDIS_REST_TOKEN,
    });

    return {
        get: async <T = any>(key: string): Promise<T | null> => {
            return await upstash.get<T>(key);
        },
        set: async (key: string, value: any, options?: { ex?: number; nx?: boolean }): Promise<any> => {
            return await (upstash.set as any)(key, value, options);
        },
        del: async (...keys: string[]): Promise<number> => {
            if (!keys || keys.length === 0) return 0;
            const flat = keys.flat().filter(Boolean);
            if (flat.length === 0) return 0;
            return await upstash.del(...flat);
        },
        keys: async (pattern: string): Promise<string[]> => {
            return await upstash.keys(pattern);
        },
        scan: async (cursor: string | number, options?: { match?: string; count?: number }): Promise<[string, string[]]> => {
            const res = await (upstash.scan as any)(cursor, options);
            const rawKeys = res[1] as Array<string | { key: string }>;
            const keys = rawKeys.map((k) => (typeof k === "string" ? k : k.key));
            return [String(res[0]), keys];
        },
        incr: async (key: string): Promise<number> => {
            return await upstash.incr(key);
        },
        decr: async (key: string): Promise<number> => {
            return await upstash.decr(key);
        },
        expire: async (key: string, seconds: number): Promise<number> => {
            return await upstash.expire(key, seconds);
        },
        ttl: async (key: string): Promise<number> => {
            return await upstash.ttl(key);
        },
        ping: async (): Promise<string> => {
            return await upstash.ping();
        },
    };
};

const useLocalRedis = Boolean(envConfig.REDIS_HOST || envConfig.REDIS_URL);

export const redis: IRedisClient = useLocalRedis
    ? createIoRedisAdapter()
    : createUpstashAdapter();
