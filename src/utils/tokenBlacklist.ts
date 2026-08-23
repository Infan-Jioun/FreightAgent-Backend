import { redis } from "../lib/redis"

export const blacklistToken = async (token: string, expiresIn: number) => {
    await redis.set(`blacklist:${token}`, "true", { ex: expiresIn })
}
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
    const result = await redis.get(`blacklist:${token}`)
    return result === "true"
}