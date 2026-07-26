import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { authService } from "./auth.service";
import { sendResposne } from "../../shared/sendResonse";
import status from "http-status";
import { IRegisterInput } from "./auth.interface";

const register = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body;
    const result = await authService.register(payload as IRegisterInput)
    sendResposne(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Registration successful",
        data: result,
    });
});
const loginUser = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.loginUser(req.body);
    sendResposne(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Login Successfully",
        data: result
    })
})
const logout = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.logout(req.body)
    sendResposne(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Logout Successfully",
        data: result,
        meta: result
    })
})
export const authController = {
    register,
    loginUser
} 