import { Request, Response } from "express";
import { catchAsync } from "../../../shared/catchAsync";
import { adminService } from "./admin.service";
import { Role } from "../../../generated/prisma";
import { sendResponse } from "../../../shared/sendResonse";
import status from "http-status";
import { IGetUserQuery, IRoleUpdate, IUserStatusUpdate } from "./admin.interface";
import { IRequestUser } from "../../interface/requestUserInterface";

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
    const query = req.query
    const result = await adminService.getAlluser(query as IGetUserQuery);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Users fetched successfully",
        data: result.users,
        meta: result.meta,
    });
});
const getUserById = catchAsync(async (req: Request, res: Response) => {
    const currentUser = req.user;
    const result = await adminService.getUserById(req.params.id as string, currentUser as IRequestUser);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User fetched successfully",
        data: result,
    });
});
const updateRole = catchAsync(async (req: Request, res: Response) => {
    const currentUser = req.user as IRequestUser;

    const payload: IRoleUpdate = {
        id: req.params.id as string,
        role: req.body.role as Role,
    };

    const result = await adminService.updateRole(payload, currentUser);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Role updated successfully",
        data: result,
    });
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
    const currentUser = req.user as IRequestUser;

    const payload: IUserStatusUpdate = {
        id: req.params.id as string,
        isBlocked: req.body.isBlocked,
        status: req.body.status,
        reason: req.body.reason,
        blockedReason: req.body.blockedReason,
    };

    const result = await adminService.updateUserStatus(payload, currentUser);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.isBlocked
            ? "User suspended successfully"
            : "User activated successfully",
        data: result,
    });
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
    const currentUser = req.user as IRequestUser;
    const result = await adminService.deleteUser(req.params.id as string, currentUser);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User deleted successfully",
        data: result,
    });
});
export const adminController = {
    getAllUsers,
    getUserById,
    updateRole,
    updateUserStatus,
    deleteUser,
};