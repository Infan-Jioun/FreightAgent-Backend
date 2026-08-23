import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth";
import status from "http-status";
import AppError from "../errorHelper/AppError";


export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            throw new AppError(status.UNAUTHORIZED, "Authentication required");
        }

        const session = await auth.api.getSession({
            headers: { authorization: `Bearer ${token}` },
        });

        if (!session) {
            throw new AppError(status.NOT_FOUND, "Session expired or invalid");
        }

        (req as any).user = session.user;
        (req as any).session = session.session;

        next();
    } catch (error) {
        next(error);
    }
};

export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = (req as any).user?.role;

        if (!roles.includes(userRole)) {
            return next(new AppError(status.UNAUTHORIZED, "You do not have permission"));
        }

        next();
    };
};