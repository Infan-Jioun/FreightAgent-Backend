import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { authService } from "./auth.service";
import { sendResposne } from "../../shared/sendResonse";
import status from "http-status";

const register = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.register(req.body, req);

    sendResposne(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Registration successful",
        data: result,
    });
});

export const authController = {
    register
} 