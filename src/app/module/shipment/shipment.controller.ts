import status from "http-status";
import { catchAsync } from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResonse";
import { IRequestUser } from "../../interface/requestUserInterface";
import { shipmentService } from "./shipment.service";
import { Request, Response } from "express";
import { IQueryShipment } from "./shipment.interface";

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
export const shipmentController = {
    createShipment,
    getAllShipments,
    getShipmentById
}
