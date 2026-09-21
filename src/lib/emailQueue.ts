import { Queue, Worker, Job } from "bullmq";
import { prisma } from "./prisma";
import { sendEmail } from "../utils/email";
import { envConfig } from "../_config/env";

// ─── Redis Connection for BullMQ ──────────────────────────
// BullMQ requires a stateful TCP connection (ioredis) with `maxRetriesPerRequest: null`.
// Upstash provides standard Redis over TLS on port 6379.
const redisConnection = {
    host: new URL(envConfig.UPSTASH_REDIS_REST_URL).hostname,
    port: 6379,
    password: envConfig.UPSTASH_REDIS_REST_TOKEN,
    tls: {},
    maxRetriesPerRequest: null,
};

// ─── Queue ────────────────────────────────────────────────
export const locationEmailQueue = new Queue("location-email", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,           // Retry up to 3 times on failure
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100, // Retain last 100 completed jobs
        removeOnFail: 50,      // Retain last 50 failed jobs
    },
});

// ─── Helper ───────────────────────────────────────────────
const formatLocationType = (type?: string): string => {
    if (!type) return "Sea Port";
    return type
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
};

// ─── Worker ───────────────────────────────────────────────
export const locationEmailWorker = new Worker(
    "location-email",
    async (job: Job) => {
        const { location } = job.data;

        // Fetch active, non-blocked users
        const users = await prisma.user.findMany({
            where: {
                isDeleted: false,
                isBlocked: false,
            },
            select: { id: true, name: true, email: true },
        });

        if (!users.length) return;

        const formattedType = formatLocationType(location?.type);
        const exploreUrl = `${envConfig.FRONTEND_URL}/dashboard/locations`;
        const createdAtFormatted = new Date(location?.createdAt || Date.now()).toLocaleString("en-US", {
            timeZone: "Asia/Dhaka",
            dateStyle: "medium",
            timeStyle: "short",
        });

        // 500 users per batch
        const BATCH_SIZE = 500;
        const SUB_CONCURRENCY = 5;

        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            const batch = users.slice(i, i + BATCH_SIZE);
            const validUsers = batch.filter((u) => Boolean(u.email));

            // Process sub-chunks of 5 to respect SMTP connection limits
            for (let j = 0; j < validUsers.length; j += SUB_CONCURRENCY) {
                const subBatch = validUsers.slice(j, j + SUB_CONCURRENCY);
                await Promise.allSettled(
                    subBatch.map((user) =>
                        sendEmail({
                            to: user.email,
                            subject: `New Location Added: ${location.name} (${location.code}) - FreightAgent 📍`,
                            templateName: "newLocation",
                            templateData: {
                                userName: user.name || "FreightAgent Partner",
                                name: location.name,
                                code: location.code,
                                type: formattedType,
                                country: location.country,
                                countryCode: location.countryCode,
                                city: location.city,
                                region: location.region,
                                latitude: location.latitude,
                                longitude: location.longitude,
                                createdAt: createdAtFormatted,
                                exploreUrl,
                            },
                        })
                    )
                );
            }

            // 2-second breathing room between batches
            if (i + BATCH_SIZE < users.length) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }

            // Job progress update (0 - 100%)
            const progress = Math.min(100, Math.round(((i + batch.length) / users.length) * 100));
            await job.updateProgress(progress);
        }
    },
    {
        connection: redisConnection,
        concurrency: 1, // Single job concurrency to prevent SMTP overload
    }
);

// ─── Worker Event Listeners (logging) ─────────────────────
locationEmailWorker.on("completed", (job) => {
    console.log(`✅ Location email broadcast completed — Job ${job.id}`);
});

locationEmailWorker.on("failed", (job, err) => {
    console.error(`❌ Location email job ${job?.id} failed:`, err.message);
});

locationEmailWorker.on("progress", (job, progress) => {
    console.log(`📧 Email broadcast progress: ${progress}% — Job ${job.id}`);
});
