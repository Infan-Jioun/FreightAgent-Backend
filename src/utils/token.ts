import { JwtPayload, SignOptions } from "jsonwebtoken";
import { JwtTokenUtils } from "./jwt";
import { envConfig } from "../_config/env";
import { Request, Response } from "express";
import { cookieUtils } from "./cookie";

const getAccessToken = (payload: JwtPayload) => {
    const accessToken = JwtTokenUtils.createToken(
        payload, envConfig.ACCESS_TOKEN_SECRET, {
            expiresIn: envConfig.ACCESS_TOKEN_EXPIRES_IN
        } as SignOptions
    )
    return accessToken;
}
const getRefreshToken = (payload: JwtPayload) => {
    const refreshToken = JwtTokenUtils.createToken(
        payload, envConfig.REFRESH_TOKEN_SECRET, {
            expiresIn: envConfig.REFRESH_TOKEN_EXPIRES_IN
        } as SignOptions
    )
    return refreshToken;
}
const setAccessTokenCookie = (res: Response, req: Request, token: string) => {
    cookieUtils.setCookie(res, "accessToken", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 60 * 60 * 60 * 24 * 1000
    })
}
const setRefreshTokenCookie = (res: Response, token: string) => {
    // const maxAge = ms(envVars.REFRESH_TOKEN_EXPIRES_IN as StringValue);
    cookieUtils.setCookie(res, "refreshToken", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: '/',
        // 7days
        maxAge: 60 * 60 * 60 * 24 * 1000 * 7
    })
}
const setBetterAuthSessionCookie = (res: Response, token: string) => {
    // const maxAge = ms(envVars.REFRESH_TOKEN_EXPIRES_IN as StringValue);
    cookieUtils.setCookie(res, "better-auth.session_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: '/',
        // 1 days
        maxAge: 60 * 60 * 60 * 24
    })
}
export const tokenUtils = {
    getAccessToken,
    getRefreshToken,
    setAccessTokenCookie,
    setRefreshTokenCookie,
    setBetterAuthSessionCookie
}