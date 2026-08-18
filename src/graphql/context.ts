import { Request, Response } from "express";
import { GrapQLContext } from "../_shared/graphqlInterface";
import { prisma } from "../lib/prisma";
import { auth } from "../lib/auth";
import { Role } from "../generated/prisma";

export const buildContext = async (req: Request, res: Response): Promise<GrapQLContext> => {
    const session = await auth.api.getSession({
        headers: req.headers as Record<string, string>
    });

    return {
        req,
        res,
        prisma,
        user: session?.user
            ? {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name,
                role: (session.user as any).role as Role,
            }
            : null,
    };
};