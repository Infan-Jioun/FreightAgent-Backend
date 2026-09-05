import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/server.ts"],
    format: ["esm"],
    outDir: "dist",
    clean: true,
    sourcemap: false,
    minify: false,
    bundle: true, // ✅ সব src ফাইল একসাথে bundle করবে
    splitting: false, // ✅ একটাই ফাইল বানাবে
    banner: {
        js: `import { createRequire as _createRequire } from 'module'; const require = _createRequire(import.meta.url);`,
    },
    loader: {
        ".ejs": "copy",
    },
    external: [
        // ✅ শুধু node_modules গুলো external রাখো
        // নিজের src ফাইল external করবে না
        "@prisma/client",
        "better-auth",
        "nodemailer",
        "node-cron",
        "ejs",
        "prisma",
    ],
    noExternal: [
        // ✅ এগুলো force bundle করো
    ],
});