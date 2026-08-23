import { prisma } from "../../lib/prisma";
import cron from "node-cron";

const deleteUnverifiedUsers = async () => {
    // const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deleted = await prisma.user.deleteMany({
        where: {
            emailVerified: false,
            // createdAt: { lt: twoMinutesAgo }
            createdAt: { lt: yesterday }
        }
    });
    console.log(`🧹 Deleted ${deleted.count} unverified users`);
};
export const startCronJobs = () => {
    //  cron.schedule("*/1 * * * *", async () => {
    cron.schedule("0 0 * * *", async () => {
        console.log("⏰ Running cleanup job...");
        await deleteUnverifiedUsers();
    });

    console.log(" Cron jobs started");
};