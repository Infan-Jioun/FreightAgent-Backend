import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { authService } from "./auth.service";
import { sendResposne } from "../../shared/sendResonse";
import status from "http-status";
import { ILogoutInput, IRegisterInput } from "./auth.interface";
import { tokenUtils } from "../../utils/token";
import { cookieUtils } from "../../utils/cookie";

const register = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body;
    const result = await authService.register(payload);
    const { accessToken, refreshToken, token, ...rest } = result;
    tokenUtils.setAccessTokenCookie(res, req, accessToken)
    tokenUtils.setRefreshTokenCookie(res, refreshToken)
    tokenUtils.setBetterAuthSessionCookie(res, token as string)
    sendResposne(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "User Successfully Register",
        data: {
            accessToken,
            refreshToken,
            ...rest
        }
    })
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
    const betterAuthSession = req.cookies["better-auth.session_token"];
    const result = await authService.logout(betterAuthSession);
    cookieUtils.clearCookie(res, "accessToken", {
        httpOnly: true,
        secure: true,
        sameSite: "none"
    })
    cookieUtils.clearCookie(res, "refreshToken", {
        httpOnly: true,
        secure: true,
        sameSite: "none"
    })
    cookieUtils.clearCookie(res, "accessToken", {
        httpOnly: true,
        secure: true,
        sameSite: "none"
    })

    sendResposne(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Logout Successfully",
        data: result,

    })
})
const verifyEmaiil = catchAsync(async (req: Request, res: Response) => {
    const { otp, email } = req.body;
    const result = authService.verifyEmail(otp, email);
    sendResposne(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Successfully Otp sent! ",
        data: result
    })
})
export const authController = {
    register,
    loginUser,
    logout,
    verifyEmaiil
} 