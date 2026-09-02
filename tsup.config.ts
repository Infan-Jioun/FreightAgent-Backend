import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/server.ts"],
    format: ["esm"],
    outDir: "dist",
    clean: true,
    sourcemap: false,
    minify: false,
    // ✅ এই banner যোগ করো
    banner: {
        js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
    },
    loader: {
        ".ejs": "copy",
    },
    external: [
        "prisma",
        "@prisma/client",
        "better-auth",
        "nodemailer",
        "node-cron",
        "ejs",
    ],
});