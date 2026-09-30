// src/server.ts

import { envConfig } from "./_config/env";
import app from "./app";
import { startCronJobs } from "./app/jobs/cleanupJobs";
import { redis } from "./lib/redis";
import { createServer } from "http";
import { initSocket } from "./lib/socket";
import "./lib/emailQueue";

// ✅ app থেকে httpServer বানাও
const httpServer = createServer(app);

// ✅ Socket init করো
initSocket(httpServer);

const startServer = async () => {
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
│  Socket  :  Ready                     │
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
│  Socket  :  Ready                     │
└─────────────────────────────────────────┘
    `);
    console.error("Redis Error:", error);
  }

  startCronJobs();
};


if (envConfig.NODE_ENV !== "production") {
  httpServer.listen(envConfig.PORT, () => {
    startServer();
  });
}

export default app;