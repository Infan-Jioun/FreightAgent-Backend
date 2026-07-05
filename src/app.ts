import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
const app: Application = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        status: "ok",
        message: "FreightAgent API is running",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
    });
});
export default app;