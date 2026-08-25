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
        if (count === 1) {
            await redis.expire(redisKey, ttlSeconds);
        }
        return { totalHits: count, resetTime: new Date() };
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
            sendResponse(res, {
                httpStatusCode: status.TOO_MANY_REQUESTS,
                success: false,
                message,
                data: null,
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