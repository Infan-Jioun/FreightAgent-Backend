import { redis } from "../lib/redis"

export const blacklistToken = async (token: string, expiresIn: number) => {
    try {
        await redis.set(`blacklist:${token}`, "true", { ex: expiresIn });
    } catch (err) {
        console.error("Redis blacklist error:", err);
    }
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
    try {
        const result = await redis.get(`blacklist:${token}`);
        return result === "true";
    } catch (err) {
        console.error("Redis isTokenBlacklisted error:", err);
        return false;
    }
};