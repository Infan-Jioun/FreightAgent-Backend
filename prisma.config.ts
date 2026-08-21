// prisma.config.ts
import "dotenv/config";
import path from "path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma"), // ← folder name শুধু "prisma"
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});