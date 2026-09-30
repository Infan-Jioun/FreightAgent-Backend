import { Request, Response } from "express";
import { catchAsync } from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResonse";
import status from "http-status";
import { notificationService } from "./notification.service";
import { IRequestUser } from "../../interface/requestUserInterface";
import { IGetNotificationQuery } from "./notification.interface";

const getUserNotifications = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await notificationService.getUserNotifications(
        user.userId,
        req.query as IGetNotificationQuery
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Notifications fetched successfully",
        data: result.notifications,
        meta: result.meta,
    });
});

const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await notificationService.getUnreadCount(user.userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Unread notification count fetched successfully",
        data: result,
    });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const { id } = req.params;
    const result = await notificationService.markAsRead(user.userId, id as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Notification marked as read",
        data: result,
    });
});

const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await notificationService.markAllAsRead(user.userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "All notifications marked as read",
        data: result,
    });
});

const deleteNotification = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const { id } = req.params;
    const result = await notificationService.deleteNotification(user.userId, id as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Notification deleted successfully",
        data: result,
    });
});

export const notificationController = {
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
};
