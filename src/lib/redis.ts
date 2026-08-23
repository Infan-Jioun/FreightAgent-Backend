import { Redis } from "@upstash/redis";
import { envConfig } from "../_config/env";
export const redis = new Redis({
    url: envConfig.UPSTASH_REDIS_REST_URL,
    token: envConfig.UPSTASH_REDIS_REST_TOKEN
})