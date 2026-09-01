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
dotenv.config();
const app: Application = express();
app.set("trust proxy", 1);
app.use((req, res, next) => {
    if (req.path.includes('/api/auth')) {
        console.log('=== AUTH REQUEST ===');
        console.log('Path:', req.path);
        console.log('Cookies:', req.headers.cookie);
        console.log('Set-Cookie response:', res.getHeaders()['set-cookie']);
    }
    next();
});
app.use(
    cors({
        origin: [
            "http://localhost:3000",
            envConfig.FRONTEND_URL || "http://localhost:3000",
        ],
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    })
);

app.all("/api/auth/{*path}", toNodeHandler(auth));
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "ejs")
app.set("views", path.resolve(process.cwd(), `src/app/templates`))
app.set("query parser", (str: string) => qs.parse(str));
app.use("/api/v1/api-docs", basicAuth({
    users: {
        [envConfig.SWAGGER_USER!]: envConfig.SWAGGER_PASS!,
    },
    challenge: true,
}),
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/shipment", shipmentRouter);
app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        status: "ok",
        message: "FreightAgent API is running",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
    });
});
app.use(globalErrorHandler)
app.use(notFound)
export default app;