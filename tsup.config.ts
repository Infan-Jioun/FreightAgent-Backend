// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/server.ts"],
    format: ["esm"],
    outDir: "dist",
    clean: true,
    sourcemap: false,
    minify: false,
    // ✅ EJS template files copy করো
    loader: {
        ".ejs": "copy",
    },
    // ✅ External packages — bundle করবে না
    external: [
        "prisma",
        "@prisma/client",
        "better-auth",
        "nodemailer",
        "node-cron",
        "ejs",
    ],
});