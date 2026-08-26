import status from "http-status";
import { catchAsync } from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResonse";
import { IRequestUser } from "../../interface/requestUserInterface";
import { shipmentService } from "./shipment.service";
import { Request, Response } from "express";

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
export const shipmentController = {
    createShipment
}
