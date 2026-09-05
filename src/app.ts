import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { notFound } from './middleware/notFound';
import cookieParser from 'cookie-parser';
import path from 'path';
import qs from "qs";
import { authRouter } from './app/module/auth/auth.router';
import globalErrorHandler from './middleware/globalErrorHandler';
import { swaggerSpec } from './_config/swagger/swagger';
import swaggerUi from "swagger-ui-express";
import basicAuth from "express-basic-auth";
import { envConfig } from './_config/env';
import { userRouter } from './app/module/user/user.router';
import { adminRouter } from './app/module/admin/admin.router';
import { shipmentRouter } from './app/module/shipment/shipment.router';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth';
import { startCronJobs } from './app/jobs/cleanupJobs';

dotenv.config();

const app: Application = express();

// ✅ Trust proxy - Vercel এর জন্য জরুরি
app.set("trust proxy", 1);

const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5000",
    envConfig.FRONTEND_URL?.replace(/\/$/, ""),
].filter(Boolean);

// ✅ CORS - better-auth handler এর আগে থাকতে হবে
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            const normalizedOrigin = origin.replace(/\/$/, "");
            if (
                allowedOrigins.includes(normalizedOrigin) ||
                normalizedOrigin.startsWith("http://localhost:") ||
                normalizedOrigin.startsWith("http://127.0.0.1:") ||
                normalizedOrigin.endsWith(".vercel.app")
            ) {
                return callback(null, true);
            }
            return callback(null, true);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With", "Accept"],
        exposedHeaders: ["Set-Cookie"],
    })
);

// ✅ better-auth handler - CORS এর পরে, body parser এর আগে (এটা জরুরি)
app.all("/api/auth/{*path}", toNodeHandler(auth)); // ✅ {*path} → /* করা হয়েছে, Express 5 এ /* কাজ করে

// ✅ Body parsers - auth handler এর পরে
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ View engine
app.set("view engine", "ejs");
app.set("views", path.resolve(process.cwd(), "src/app/templates"));
app.set("query parser", (str: string) => qs.parse(str));

// ✅ Swagger
app.use(
    "/api/v1/api-docs",
    basicAuth({
        users: {
            [envConfig.SWAGGER_USER!]: envConfig.SWAGGER_PASS!,
        },
        challenge: true,
    }),
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);

// ✅ Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/shipment", shipmentRouter);
// app.use("/api/v1/user", userRouter); // ✅ import আছে কিন্তু use নেই - দরকার হলে যোগ করো

// ✅ Cron cleanup route
app.post("/api/cron/cleanup", (req: Request, res: Response) => {
    if (req.headers["x-cron-secret"] !== envConfig.CRON_SECRET) {
        res.status(401).json({ message: "Unauthorized" }); // ✅ return সরিয়ে দিলাম - Express 5 এ return res... কাজ করে না
        return;
    }
    startCronJobs();
    res.json({ message: "Cleanup started" });
});

// ✅ Health check
app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        status: "ok",
        message: "FreightAgent API is running",
        timestamp: new Date().toISOString(),
        environment: envConfig.NODE_ENV || "development",
    });
});

// ✅ Error handlers - সবার শেষে
app.use(globalErrorHandler);
app.use(notFound);

export default app;