import { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { redis } from "../lib/redis";
import status from "http-status";
import { sendResponse } from "../shared/sendResonse";


//  Reusable keyGenerator
const keyGenerator = (req: Request) => ipKeyGenerator(req.ip as string);

//  Reusable Upstash store
const createUpstashStore = (prefix: string, ttlSeconds: number) => ({
    async increment(key: string) {
        const redisKey = `${prefix}:${key}`;
        const count = await redis.incr(redisKey);

        // ttl = seconds until THIS client's window actually resets.
        // On the first hit we just set it. On later hits we have to read
        // back the *remaining* ttl — otherwise resetTime drifts to "now"
        // on every single request, which is the bug this replaces.
        let ttl = ttlSeconds;
        if (count === 1) {
            await redis.expire(redisKey, ttlSeconds);
        } else {
            const remaining = await redis.ttl(redisKey);
            if (remaining && remaining > 0) ttl = remaining;
        }

        return {
            totalHits: count,
            resetTime: new Date(Date.now() + ttl * 1000),
        };
    },
    async decrement(key: string) {
        await redis.decr(`${prefix}:${key}`);
    },
    async resetKey(key: string) {
        await redis.del(`${prefix}:${key}`);
    },
});

//  Reusable rate limit config
const createRateLimit = (
    prefix: string,
    windowMs: number,
    max: number,
    message: string
) =>
    rateLimit({
        windowMs,
        max,
        store: createUpstashStore(prefix, windowMs / 1000) as any,
        keyGenerator,
        handler: (req: Request, res: Response) => {
            // express-rate-limit attaches this itself: { limit, used, remaining, resetTime }
            const info = (req as any).rateLimit as
                | { limit: number; used: number; remaining: number; resetTime?: Date }
                | undefined;

            const retryAfter = info?.resetTime
                ? Math.max(1, Math.ceil((info.resetTime.getTime() - Date.now()) / 1000))
                : Math.ceil(windowMs / 1000);

            res.setHeader("Retry-After", retryAfter);

            sendResponse(res, {
                httpStatusCode: status.TOO_MANY_REQUESTS,
                success: false,
                message,
                data: {
                    retryAfter,                 // seconds left before they can retry
                    limit: info?.limit ?? max,  // how many attempts the window allows
                },
            });
        },
        standardHeaders: true,
        legacyHeaders: false,
    });

// Login rate limit — 5 attempts / 15 minutes
export const loginRateLimit = createRateLimit(
    "login",
    15 * 60 * 1000,
    5,
    "Too many login attempts. Try again after 15 minutes."
);

// OTP rate limit — 3 attempts / 10 minutes
export const otpRateLimit = createRateLimit(
    "otp",
    10 * 60 * 1000,
    5,
    "Too many OTP requests. Try again after 10 minutes."
);

// Register rate limit — 3 attempts / 1 hour
export const registerRateLimit = createRateLimit(
    "register",
    60 * 60 * 1000,
    5,
    "Too many register attempts. Try again after 1 hour."
);
export const adminRegisterRateLimit = createRateLimit(
    "register",
    60 * 60 * 1000,
    5,
    "Too many admin register attempts. Try again after 1 hour."
);

// Shipment rate limits
export const createShipmentRateLimit = createRateLimit(
    "create-shipment",
    60 * 60 * 1000, // 1 hour
    20,
    "Too many shipment requests. Try again after 1 hour."
);

export const getShipmentRateLimit = createRateLimit(
    "get-shipment",
    60 * 1000, // 1 minute
    30,
    "Too many requests. Try again after 1 minute."
);

export const updateShipmentRateLimit = createRateLimit(
    "update-shipment",
    60 * 1000, // 1 minute
    20,
    "Too many update requests. Try again after 1 minute."
);

export const deleteShipmentRateLimit = createRateLimit(
    "delete-shipment",
    60 * 60 * 1000, // 1 hour
    5,
    "Too many delete requests. Try again after 1 hour."
);