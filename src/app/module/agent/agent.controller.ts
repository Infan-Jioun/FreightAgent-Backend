import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResonse";
import { IRequestUser } from "../../interface/requestUserInterface";
import { agentService } from "./agent.service";
import { IAgentShipmentQuery, IAgentStatusUpdate } from "./agent.interface";

const getAssignedShipments = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const query = req.query as IAgentShipmentQuery;
    const result = await agentService.getAssignedShipments(query, user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Assigned shipments fetched successfully",
        data: result.shipments,
        meta: result.meta,
    });
});

const getAssignedShipmentById = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const { id } = req.params;
    const result = await agentService.getAssignedShipmentById(id as string, user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Assigned shipment fetched successfully",
        data: result,
    });
});

const acceptShipment = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const { id } = req.params;
    const payload = req.body;
    const result = await agentService.acceptShipment(id as string, payload, user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Shipment accepted successfully",
        data: result,
    });
});

const updateShipmentStatus = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const { id } = req.params;
    const payload = req.body as IAgentStatusUpdate;
    const result = await agentService.updateShipmentStatus(id as string, payload, user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Shipment status updated successfully",
        data: result,
    });
});

const getAgentProfile = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await agentService.getAgentProfile(user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Agent profile fetched successfully",
        data: result,
    });
});

const toggleAvailability = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const { isAvailable } = req.body;
    const result = await agentService.toggleAvailability(user, isAvailable);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `Agent availability set to ${isAvailable ? "Available" : "Busy"}`,
        data: result,
    });
});

export const agentController = {
    getAssignedShipments,
    getAssignedShipmentById,
    acceptShipment,
    updateShipmentStatus,
    getAgentProfile,
    toggleAvailability,
};
