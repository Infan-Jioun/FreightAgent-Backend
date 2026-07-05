import { Request, Response } from "express";
import status from "http-status";

export  const notFound = (req: Request, res: Response) => {
    res.status(status.NOT_FOUND).json({
        status: "error",
        message: `Route not found ${req.originalUrl}`,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
    });
}