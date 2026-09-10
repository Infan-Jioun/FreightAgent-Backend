

import { Request, Response } from "express";
import { catchAsync } from "../../../shared/catchAsync";
import { userService } from "./user.service";
import { sendResponse } from "../../../shared/sendResonse";
import status from "http-status";
import { IRequestUser } from "../../interface/requestUserInterface";


import AppError from "../../../errorHelper/AppError";

const getMe = catchAsync(async (req: Request, res: Response) => {
    const result = await userService.getMe(req.user as IRequestUser);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Profile retrieved successfully",
        data: result,
    });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
    const result = await userService.updateProfile(
        req.user as IRequestUser,
        req.body,
        req.file
    );
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Profile updated successfully",
        data: result,
    });
});

const uploadAvatar = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new AppError(status.BAD_REQUEST, "Please provide an image file to upload");
    }

    const result = await userService.uploadAvatar(
        req.user as IRequestUser,
        req.file
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Avatar uploaded successfully",
        data: result,
    });
});

const requestPhoneVerification = catchAsync(
    async (req: Request, res: Response) => {
        const result = await userService.requestPhoneVerification(
            req.user as IRequestUser,
            req.body
        );
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: result.message,
            data: null,
        });
    }
);

const verifyAndSavePhone = catchAsync(async (req: Request, res: Response) => {
    const result = await userService.verifyAndSavePhone(
        req.user as IRequestUser,
        req.body
    );
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Phone number verified and saved",
        data: result,
    });
});

const getActiveSessions = catchAsync(async (req: Request, res: Response) => {
    const sessionToken =
        (req.user as IRequestUser)?.sessionToken ||
        req.cookies?.["better-auth.session_token"];
    const result = await userService.getActiveSessions(
        req.user as IRequestUser,
        sessionToken
    );
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Active sessions retrieved",
        data: result,
    });
});

const revokeSession = catchAsync(async (req: Request, res: Response) => {
    const sessionToken =
        (req.user as IRequestUser)?.sessionToken ||
        req.cookies?.["better-auth.session_token"];
    const result = await userService.revokeSession(
        req.user as IRequestUser,
        req.params.sessionId as string,
        sessionToken
    );
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
        data: null,
    });
});

export const userController = {
    getMe,
    updateProfile,
    uploadAvatar,
    requestPhoneVerification,
    verifyAndSavePhone,
    getActiveSessions,
    revokeSession,
};