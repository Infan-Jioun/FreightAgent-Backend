import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { notFound } from './middleware/notFound';
import { authRouter } from './module/auth/auth.router';
dotenv.config();
const app: Application = express();
app.use(cors());
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRouter);
app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        status: "ok",
        message: "FreightAgent API is running",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
    });
});
app.use(notFound)
export default app;