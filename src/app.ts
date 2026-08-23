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
dotenv.config();
const app: Application = express();
app.use(cors());
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