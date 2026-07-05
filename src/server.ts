import { envConfig } from "./_config/env";
import app from "./app";
app.listen(envConfig.PORT, () => {
    console.log(`
┌─────────────────────────────────────────┐
│         🚢 FreightAgent Server          │
├─────────────────────────────────────────┤
│  Status  : ✅ Running                   │
│  Port    : ${envConfig.PORT}                        │
│  Mode    : ${envConfig.NODE_ENV}                │
└─────────────────────────────────────────┘
  `);
});