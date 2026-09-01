import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export interface GrapQLContext {
    req: Request;
    res: Response;
    prisma: typeof prisma;
    user: {
        id: string;
        email: string;
        name: string;
        role: string
    } | null
    
}