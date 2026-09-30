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

const getRoadAgents = catchAsync(async (req: Request, res: Response) => {
    const result = await adminService.getRoadAgents(req.query);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Road agents fetched successfully",
        data: result.agents,
        meta: result.meta,
    });
});

const assignRoadAgent = catchAsync(async (req: Request, res: Response) => {
    const currentUser = req.user as IRequestUser;
    const { id } = req.params;
    const { agentId, note } = req.body;

    const result = await adminService.assignRoadAgent(
        { shipmentId: id as string, agentId, note },
        currentUser
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Road agent assigned to shipment successfully",
        data: result,
    });
});

const getUserActiveSessions = catchAsync(async (req: Request, res: Response) => {
    const currentUser = req.user as IRequestUser;
    const { id } = req.params;

    const result = await adminService.getUserActiveSessions(id as string, currentUser);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User active sessions fetched successfully",
        data: result,
    });
});

const revokeUserSession = catchAsync(async (req: Request, res: Response) => {
    const currentUser = req.user as IRequestUser;
    const { id, sessionId } = req.params;

    const result = await adminService.revokeUserSession(
        id as string,
        sessionId as string,
        currentUser
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
        data: null,
    });
});

const revokeAllUserSessions = catchAsync(async (req: Request, res: Response) => {
    const currentUser = req.user as IRequestUser;
    const { id } = req.params;

    const result = await adminService.revokeAllUserSessions(id as string, currentUser);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
        data: null,
    });
});

const getAllActiveSessions = catchAsync(async (req: Request, res: Response) => {
    const currentUser = req.user as IRequestUser;
    const result = await adminService.getAllActiveSessions(req.query, currentUser);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Active sessions fetched successfully",
        data: result.sessions,
        meta: result.meta,
    });
});

export const adminController = {
    getAllUsers,
    getUserById,
    updateRole,
    updateUserStatus,
    deleteUser,
    getRoadAgents,
    assignRoadAgent,
    getUserActiveSessions,
    revokeUserSession,
    revokeAllUserSessions,
    getAllActiveSessions,
};
