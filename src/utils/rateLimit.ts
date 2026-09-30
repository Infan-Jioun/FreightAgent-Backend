import { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { redis } from "../lib/redis";
import status from "http-status";
import { sendResponse } from "../shared/sendResonse";

// Key generator: prefer authenticated user ID if present, otherwise client IP
export const userOrIpKeyGenerator = (req: Request): string => {
    const userId = (req as any).user?.userId;
    if (userId) return `user:${userId}`;
    return ipKeyGenerator((req.ip as string) || req.socket.remoteAddress || "127.0.0.1");
};

// Reusable keyGenerator
const keyGenerator = userOrIpKeyGenerator;

// Reusable Upstash store
const createUpstashStore = (prefix: string, ttlSeconds: number) => ({
    async increment(key: string) {
        const redisKey = `${prefix}:${key}`;
        const count = await redis.incr(redisKey);

        // ttl = seconds until THIS client's window actually resets.
        // On the first hit we set expiration. On later hits we read back
        // the remaining ttl to maintain an accurate rolling resetTime.
        let ttl = ttlSeconds;
        if (count === 1) {
            await redis.expire(redisKey, ttlSeconds);
        } else {
            const remaining = await redis.ttl(redisKey);
            if (remaining && remaining > 0) {
                ttl = remaining;
            } else if (remaining === -1) {
                await redis.expire(redisKey, ttlSeconds);
            }
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

// Reusable rate limit config
const createRateLimit = (
    prefix: string,
    windowMs: number,
    max: number,
    message: string,
    customKeyGenerator?: (req: Request) => string
) =>
    rateLimit({
        windowMs,
        max,
        store: createUpstashStore(prefix, Math.ceil(windowMs / 1000)) as any,
        keyGenerator: customKeyGenerator ?? keyGenerator,
        handler: (req: Request, res: Response) => {
            // express-rate-limit attaches this: { limit, used, remaining, resetTime }
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
                    used: info?.used ?? max,
                },
            });
        },
        standardHeaders: true,
        legacyHeaders: false,
    });

// ─── Time Constants ────────────────────────────────────────────────────────
const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Auth Rate Limits ──────────────────────────────────────────────────────
// Login rate limit — 5 attempts / 15 minutes
export const loginRateLimit = createRateLimit(
    "login",
    15 * 60 * 1000,
    5,
    "Too many login attempts. Try again after 15 minutes."
);

// OTP rate limit — 5 attempts / 10 minutes
export const otpRateLimit = createRateLimit(
    "otp",
    10 * 60 * 1000,
    5,
    "Too many OTP requests. Try again after 10 minutes."
);

// Register rate limit — 5 attempts / 1 hour
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

// Change Password rate limit — 3 attempts / 24 hours (Daily)
export const changePasswordRateLimit = createRateLimit(
    "change-password",
    ONE_DAY_MS,
    3,
    "Daily password change limit reached. You can only change your password 3 times per day. Please try again tomorrow."
);

// Change Password OTP rate limit — 3 attempts / 24 hours (Daily)
export const changePasswordOtpRateLimit = createRateLimit(
    "change-password-otp",
    ONE_DAY_MS,
    3,
    "Daily password OTP limit reached. You can only request password change OTP 3 times per day. Please try again tomorrow."
);

// ─── Profile & Phone Rate Limits ───────────────────────────────────────────
// Profile update rate limit (name, address, location) — 3 updates / 24 hours (Daily)
export const profileUpdateRateLimit = createRateLimit(
    "profile-update",
    ONE_DAY_MS,
    3,
    "Daily profile update limit reached. You can only update your profile (name, address, location) 3 times per day. Please try again tomorrow."
);

// Phone verification request rate limit — 3 requests / 24 hours (Daily)
export const phoneRequestRateLimit = createRateLimit(
    "phone-request",
    ONE_DAY_MS,
    3,
    "Daily phone verification limit reached. You can only request phone updates 3 times per day. Please try again tomorrow."
);

// Phone verify and save rate limit — 3 verifications / 24 hours (Daily)
export const phoneVerifyRateLimit = createRateLimit(
    "phone-verify",
    ONE_DAY_MS,
    3,
    "Daily phone verification limit reached. You can only verify and update your phone 3 times per day. Please try again tomorrow."
);

// ─── Shipment Rate Limits ──────────────────────────────────────────────────
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

// ─── RAG AI Rate Limits ────────────────────────────────────────────────────
// Public AI query limit — 30 queries / 1 minute per IP/user
export const ragRateLimit = createRateLimit(
    "rag-query",
    60 * 1000, // 1 minute
    30,
    "Too many AI queries. Please wait a minute before sending another request."
);