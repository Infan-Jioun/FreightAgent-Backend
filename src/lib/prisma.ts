import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma";
import { envConfig } from "../_config/env";

const connectionString = `${envConfig.DATABASE_URL}`;

declare global {
    var __prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString });

export const prisma =
    globalThis.__prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma = prisma;
}