import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth";
import status from "http-status";
import AppError from "../errorHelper/AppError";
import { Role } from "../generated/prisma";
import { IRequestUser } from "../app/interface/requestUserInterface";
import { envConfig } from "../_config/env";
import { JwtTokenUtils } from "../utils/jwt";
import { isTokenBlacklisted } from "../utils/tokenBlacklist";
import { prisma } from "../lib/prisma";

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
        const sessionToken =
            (decoded.sessionToken as string | undefined) ||
            req.cookies?.["better-auth.session_token"];

        if (sessionToken) {
            const isSessionRevoked = await isTokenBlacklisted(`session:${sessionToken}`);
            if (isSessionRevoked) {
                throw new AppError(
                    status.UNAUTHORIZED,
                    "Session has been revoked. Please log in again."
                );
            }

            const activeSession = await prisma.session.findUnique({
                where: { token: sessionToken },
                select: { id: true, expiresAt: true, userId: true },
            });

            if (
                !activeSession ||
                activeSession.expiresAt < new Date() ||
                activeSession.userId !== decoded.userId
            ) {
                throw new AppError(
                    status.UNAUTHORIZED,
                    "Session has ended or been revoked. Please log in again."
                );
            }
        } else {
            const hasAnyActiveSession = await prisma.session.findFirst({
                where: {
                    userId: decoded.userId as string,
                    expiresAt: { gt: new Date() },
                },
                select: { id: true },
            });
            if (!hasAnyActiveSession) {
                throw new AppError(
                    status.UNAUTHORIZED,
                    "No active session found. Please log in again."
                );
            }
        }

        req.user = {
            userId: decoded.userId as string,
            email: decoded.email as string,
            role: decoded.role as Role,
            name: decoded.name as string,
            image: decoded.image as string | null,
            emailVerified: decoded.emailVerified as boolean,
            createdAt: decoded.createdAt as Date,
            sessionToken,
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