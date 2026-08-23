import { Request, Response, NextFunction } from "express";

const globalErrorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const statusCode = err.statusCode || 500;
    let message = err.message || "Something went wrong";

    // BetterAuth / Zod validation error parse করো
    try {
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed) && parsed[0]?.message) {
            message = parsed[0].message;
        }
    } catch {
        // normal error — কিছু করার দরকার নেই
    }

    res.status(statusCode).json({
        success: false,
        message,
        data: null,
    });
};

export default globalErrorHandler;