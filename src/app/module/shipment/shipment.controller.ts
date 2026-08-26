import status from "http-status";
import { catchAsync } from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResonse";
import { IRequestUser } from "../../interface/requestUserInterface";
import { shipmentService } from "./shipment.service";
import { Request, Response } from "express";
import { IQueryShipment, IUpdateShipmentStatus } from "./shipment.interface";

const createShipment = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const result = await shipmentService.createShipment(req.body, user);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Shipment created successfully",
        data: result,
    });
});
const getAllShipments = catchAsync(async (req: Request, res: Response) => {
    const query = req.query
    const user = req.user
    const result = await shipmentService.getAllShipments(query as IQueryShipment, user as IRequestUser);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Shipments fetched successfully",
        data: result.shipment,
        meta: result.meta,
    });
});
const getMyShipments = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const query = req.query
    const result = await shipmentService.getMyShipments(query as IQueryShipment, user as IRequestUser);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "My shipments fetched successfully",
        data: result.shipments,
        meta: result.meta,
    });
});
const getShipmentById = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const result = await shipmentService.getShipmentById(req.params.id as string, user as IRequestUser);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Shipment fetched successfully",
        data: result,
    });
});
const updateShipmentStatus = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const payload = req.body;
    const { id } = req.params;
    const result = await shipmentService.updateShipmentStatus(id as string, payload as IUpdateShipmentStatus, user as IRequestUser);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Shipment status updated successfully",
        data: result,
    });
});
const deleteShipment = catchAsync(async (req: Request, res: Response) => {
    const result = await shipmentService.deleteShipment(req.params.id as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Shipment deleted successfully",
        data: result,
    });
});
export const shipmentController = {
    createShipment,
    getAllShipments,
    getMyShipments,
    getShipmentById,
    updateShipmentStatus,
    deleteShipment
}
