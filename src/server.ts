import { envConfig } from "./_config/env";
import app from "./app";
import { startCronJobs } from "./app/jobs/cleanupJobs";
import { redis } from "./lib/redis";

app.listen(envConfig.PORT, async () => {
  // Redis connection check
  try {
    await redis.ping();
    console.log(`
┌─────────────────────────────────────────┐
│         🚢 FreightAgent Server          │
├─────────────────────────────────────────┤
│  Status  :  Running                   │
│  Port    : ${envConfig.PORT}            │
│  Mode    : ${envConfig.NODE_ENV}        │
│  Redis   :  Connected                 │
└─────────────────────────────────────────┘
    `);
  } catch (error) {
    console.log(`
┌─────────────────────────────────────────┐
│         🚢 FreightAgent Server          │
├─────────────────────────────────────────┤
│  Status  :  Running                   │
│  Port    : ${envConfig.PORT}            │
│  Mode    : ${envConfig.NODE_ENV}        │
│  Redis   : ❌ Connection Failed         │
└─────────────────────────────────────────┘
    `);
    console.error("Redis Error:", error);
  }

  startCronJobs();
});