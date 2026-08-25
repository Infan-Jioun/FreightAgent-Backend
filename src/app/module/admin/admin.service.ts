import status from "http-status";
import AppError from "../../../errorHelper/AppError";
import { prisma } from "../../../lib/prisma";
import { IGetUserQuery, IRoleUpdate } from "./admin.interface"
import { IRequestUser } from "../../interface/requestUserInterface";
import { Role } from "../../../generated/prisma";


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
const getUserById = async (id: string, currentUser: IRequestUser) => {
    if (currentUser.role !== Role.ADMIN) {
        throw new AppError(status.FORBIDDEN, "Only admin can access this");
    }

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
const updateRole = async (payload: IRoleUpdate, currentUser: IRequestUser) => {
    if (currentUser.role !== Role.ADMIN) {
        throw new AppError(status.FORBIDDEN, "Only admin can update role");
    }
    const user = await prisma.user.findUnique({
        where: { id: payload.id },
    });
    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }
    if (user.role === payload.role) {
        throw new AppError(status.BAD_REQUEST, `User is already ${payload.role}`);
    }
    if (payload.id === currentUser.userId) {
        throw new AppError(status.BAD_REQUEST, "You cannot change your own role");
    }
    const updated = await prisma.user.update({
        where: { id: payload.id },
        data: { role: payload.role },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
        },
    });
    return updated;
}
export const adminService = {
    getAlluser,
    getUserById,
    updateRole
}