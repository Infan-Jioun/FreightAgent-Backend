import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import status from "http-status";
import AppError from "../errorHelper/AppError";


const globalErrorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Default values
    let statusCode = err.statusCode || status.INTERNAL_SERVER_ERROR;
    let message = err.message || "Something went wrong";

    //  1. AppError — আমাদের custom error
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    }

    //  2. ZodError — validation error
    else if (err instanceof ZodError) {
        statusCode = status.BAD_REQUEST;
        message = err.issues[0]?.message || "Validation error"; // errors → issues
    }

    //  3. BetterAuth validation error — JSON string এ আসে
    else if (typeof message === "string") {
        try {
            const parsed = JSON.parse(message);
            if (Array.isArray(parsed) && parsed[0]?.message) {
                statusCode = status.BAD_REQUEST;
                message = parsed[0].message;
            }
        } catch {
            // normal error — কিছু করার দরকার নেই
        }
    }

    //  4. Prisma errors
    if (err.code) {
        switch (err.code) {
            case "P2002": // Unique constraint
                statusCode = status.CONFLICT;
                message = `${err.meta?.target} already exists`;
                break;
            case "P2025": // Record not found
                statusCode = status.NOT_FOUND;
                message = "Record not found";
                break;
            case "P2003": // Foreign key constraint
                statusCode = status.BAD_REQUEST;
                message = "Invalid reference";
                break;
            case "P2014": // Relation violation
                statusCode = status.BAD_REQUEST;
                message = "Relation violation";
                break;
        }
    }

    //  5. JWT errors
    if (err.name === "JsonWebTokenError") {
        statusCode = status.UNAUTHORIZED;
        message = "Invalid token";
    }
    if (err.name === "TokenExpiredError") {
        statusCode = status.UNAUTHORIZED;
        message = "Token expired";
    }

    //  6. Mongoose CastError (যদি future তে use করো)
    if (err.name === "CastError") {
        statusCode = status.BAD_REQUEST;
        message = "Invalid ID format";
    }

    //  Production এ stack trace hide করো
    const isDevelopment = process.env.NODE_ENV === "development";

    return res.status(statusCode).json({
        success: false,
        message,
        data: null,
        ...(isDevelopment && { stack: err.stack }), // ← Dev এ stack দেখাবে
    });
};

export default globalErrorHandler;