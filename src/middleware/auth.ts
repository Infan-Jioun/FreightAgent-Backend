import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth";
import status from "http-status";
import AppError from "../errorHelper/AppError";
import { Role } from "../generated/prisma";
import { IRequestUser } from "../app/interface/requestUserInterface";
import { envConfig } from "../_config/env";
import { JwtTokenUtils } from "../utils/jwt";
import { isTokenBlacklisted } from "../utils/tokenBlacklist";

export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const accessToken =
            req.cookies?.accessToken ||
            req.headers.authorization?.split(" ")[1];

        if (!accessToken) {
            throw new AppError(status.UNAUTHORIZED, "Authentication required");
        }

        //  Blacklist check করো
        const isBlacklisted = await isTokenBlacklisted(accessToken);
        if (isBlacklisted) {
            throw new AppError(status.UNAUTHORIZED, "Token has been revoked");
        }

        const result = JwtTokenUtils.verifyToken(
            accessToken,
            envConfig.ACCESS_TOKEN_SECRET
        );

        if (!result.success || !result.data) {
            throw new AppError(status.UNAUTHORIZED, "Invalid or expired token");
        }

        const decoded = result.data;

        req.user = {
            userId: decoded.userId as string,
            email: decoded.email as string,
            role: decoded.role as Role,
            name: decoded.name as string,
            image: decoded.image as string | null,
            emailVerified: decoded.emailVerified as boolean,
            createdAt: decoded.createdAt as Date,
        };

        next();
    } catch (error) {
        next(error);
    }
};

export const authorize = (...roles: Role[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = req.user?.role;

        if (!userRole || !roles.includes(userRole)) {
            return next(
                new AppError(status.FORBIDDEN, "You do not have permission")
            );
        }

        next();
    };
};