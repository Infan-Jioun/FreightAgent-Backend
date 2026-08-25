import status from "http-status";
import AppError from "../../../errorHelper/AppError";
import { prisma } from "../../../lib/prisma";
import { IGetUserQuery } from "./admin.interface"


const getAlluser = async (query: IGetUserQuery) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const where: any = {}

    if (query.role) {
        where.role = query.role
    }
    if (query.search) {
        where.OR = [
            {
                name: {
                    contains: query.search, mode: "insensitive"
                }
            },
            {
                email: {
                    constains: query.search, mode: "insensitive"
                }
            }
        ]
    }
    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                image: true,
                emailVerified: true,
                createdAt: true
            },
            orderBy: {
                createdAt: "desc"
            },
            skip,
            take: limit
        }),
        prisma.user.count({
            where
        })
    ])

    return {
        users,
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
    };

}
const getUserById = async (id: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
            emailVerified: true,
            createdAt: true,
            shipments: {
                select: {
                    id: true,
                    user: true,
                    userId: true,
                    trackingId: true,
                    status: true,
                    description: true,
                    destination: true,
                    _count: true,
                    estimatedDate: true,
                    origin: true,
                    statusLogs: true,
                    weight: true,
                    createdAt: true,
                    updatedAt: true

                }
            }
        }
    })
    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }
    return {
        user
    }
}
export const adminService = {
    getAlluser,
    getUserById
}