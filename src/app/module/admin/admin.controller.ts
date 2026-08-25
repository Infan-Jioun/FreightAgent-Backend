import { Request, Response } from "express";
import { catchAsync } from "../../../shared/catchAsync";
import { adminService } from "./admin.service";
import { Role } from "better-auth/plugins";
import { sendResponse } from "../../../shared/sendResonse";
import status from "http-status";
import { IGetUserQuery } from "./admin.interface";

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
export const adminController = {
    getAllUsers
}