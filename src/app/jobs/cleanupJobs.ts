import { prisma } from "../../lib/prisma";
import cron from "node-cron";
import { redis } from "../../lib/redis";
import { notifyAgent, notifyAdmin } from "../../lib/socket";

/**
 * Executes a cron task wrapped in a Redis distributed lock to prevent overlapping runs.
 * If a job takes longer than its interval or multiple instances run, subsequent triggers
 * will safely skip execution until the lock is released or expires.
 */
export const withCronLock = async (
    lockKey: string,
    ttlSeconds: number,
    taskFn: () => Promise<void>
): Promise<void> => {
    try {
        const acquired = await redis.set(lockKey, Date.now().toString(), {
            nx: true,
            ex: ttlSeconds,
        });

        if (!acquired) {
            console.warn(
                `⏰ [Cron Lock] Task '${lockKey}' is already running. Skipping overlapping execution.`
            );
            return;
        }

        try {
            await taskFn();
        } catch (err) {
            console.error(`❌ [Cron Error] Task '${lockKey}' failed during execution:`, err);
        } finally {
            try {
                await redis.del(lockKey);
            } catch (delErr) {
                console.error(`⚠️ [Cron Lock] Error releasing lock '${lockKey}':`, delErr);
            }
        }
    } catch (redisErr) {
        console.error(`⚠️ [Cron Lock] Redis connection error for '${lockKey}', skipping:`, redisErr);
    }
};

const deleteUnverifiedUsers = async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deleted = await prisma.user.deleteMany({
        where: {
            emailVerified: false,
            createdAt: { lt: yesterday },
        },
    });
    console.log(`🧹 [Cron] Deleted ${deleted.count} unverified users.`);
};

/**
 * Checks for agent professional credentials expiring within 30 days
 * or already expired, automatically updating status and alerting agents/admins.
 */
const checkAgentCredentialExpirations = async () => {
    const now = new Date();
    const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    try {
        // 1. Check expired licenses
        const expiredCredentials = await prisma.agentCredential.findMany({
            where: {
                status: "VERIFIED",
                expiryDate: { lt: now },
            },
            include: { agent: { select: { id: true, name: true, email: true } } },
        });

        if (expiredCredentials && expiredCredentials.length > 0) {
            for (const cred of expiredCredentials) {
                await prisma.agentCredential.update({
                    where: { id: cred.id },
                    data: { status: "EXPIRED" },
                });

                // Auto-suspend agent operational access until license renewed
                await prisma.user.update({
                    where: { id: cred.agentId },
                    data: { agentVerificationStatus: "SUSPENDED" },
                });

                notifyAgent(cred.agentId, {
                    type: "CREDENTIAL_EXPIRED",
                    credentialType: cred.type,
                    message: `Your professional license (${cred.type}) has expired. Your operating status is suspended until renewal.`,
                });

                notifyAdmin({
                    type: "AGENT_SUSPENDED_CREDENTIAL_EXPIRED",
                    agentId: cred.agentId,
                    agentName: cred.agent.name,
                    credentialType: cred.type,
                    message: `Agent ${cred.agent.name} license ${cred.type} expired. Operating status suspended.`,
                });
            }
            console.log(`⚠️ [Cron] Expired ${expiredCredentials.length} agent credentials and suspended agents.`);
        }

        // 2. Check licenses expiring in <= 30 days (Warning)
        const expiringSoon = await prisma.agentCredential.findMany({
            where: {
                status: "VERIFIED",
                expiryDate: {
                    gte: now,
                    lte: thirtyDaysAhead,
                },
            },
            include: { agent: { select: { id: true, name: true, email: true } } },
        });

        if (expiringSoon && expiringSoon.length > 0) {
            for (const cred of expiringSoon) {
                if (cred.expiryDate) {
                    const daysRemaining = Math.ceil(
                        (new Date(cred.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                    );

                    notifyAgent(cred.agentId, {
                        type: "CREDENTIAL_EXPIRING_SOON",
                        credentialType: cred.type,
                        daysRemaining,
                        message: `Notice: Your ${cred.type} credential expires in ${daysRemaining} days. Please upload renewal documentation.`,
                    });
                }
            }
            console.log(`📢 [Cron] Sent 30-day renewal warnings for ${expiringSoon.length} agent credentials.`);
        }
    } catch (err) {
        console.warn("[Cron] Credential check skipped:", err);
    }
};

export const startCronJobs = () => {
    // Daily at 00:00 UTC with Redis overlap protection (Lock TTL: 30 minutes = 1800s)
    cron.schedule("0 0 * * *", async () => {
        console.log("⏰ [Cron] Triggering daily maintenance routines...");

        await withCronLock("cron:lock:delete_unverified_users", 1800, async () => {
            await deleteUnverifiedUsers();
        });

        await withCronLock("cron:lock:credential_expirations", 1800, async () => {
            await checkAgentCredentialExpirations();
        });
    });

    console.log("✅ Cron jobs initialized with Redis overlap protection.");
};