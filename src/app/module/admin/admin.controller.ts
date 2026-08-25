import { Request, Response } from "express";
import { catchAsync } from "../../../shared/catchAsync";
import { adminService } from "./admin.service";
import { Role } from "better-auth/plugins";
import { sendResponse } from "../../../shared/sendResonse";
import status from "http-status";
import { IGetUserQuery, IRoleUpdate } from "./admin.interface";
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
    const payload = req.body as IRoleUpdate;
    const result = await adminService.updateRole(payload, currentUser);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Role updated successfully",
        data: result,
    });
});

// const deleteUser = catchAsync(async (req: Request, res: Response) => {
//     const currentUser = req.user as IRequestUser;
//     const result = await adminService.deleteUser(req.params.id, currentUser);
//     sendResponse(res, {
//         httpStatusCode: status.OK,
//         success: true,
//         message: "User deleted successfully",
//         data: result,
//     });
// });
export const adminController = {
    getAllUsers,
    getUserById,
    updateRole
}