import { JwtPayload, SignOptions } from "jsonwebtoken";
import { JwtTokenUtils } from "./jwt";
import { envConfig } from "../_config/env";
import { CookieOptions, Request, Response } from "express";
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
const getBaseCookieOptions = (req?: Request): CookieOptions => {
    const origin = (req?.headers?.origin || req?.headers?.referer || "") as string;
    const forwardedHost = (req?.headers?.["x-forwarded-host"] || "") as string;
    const host = (req?.headers?.host || "") as string;

    const isLocalhost =
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        forwardedHost.includes("localhost") ||
        forwardedHost.includes("127.0.0.1") ||
        host.includes("localhost") ||
        host.includes("127.0.0.1");

    const isHttp = origin.startsWith("http://");

    // Localhost / HTTP development: Chrome rejects SameSite=None and Secure over insecure HTTP
    if (isLocalhost || isHttp) {
        return {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            path: "/",
        };
    }

    // Production cross-site HTTPS
    return {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        // @ts-ignore
        partitioned: true,
        path: "/",
    };
};

const setAccessTokenCookie = (res: Response, req: Request | undefined, token: string) => {
    const baseOptions = getBaseCookieOptions(req);
    cookieUtils.setCookie(res, "accessToken", token, {
        ...baseOptions,
        maxAge: 24 * 60 * 60 * 1000, // 1 day
    });
};

const setRefreshTokenCookie = (res: Response, reqOrToken: Request | string, maybeToken?: string) => {
    const req = typeof reqOrToken === "object" ? reqOrToken : undefined;
    const token = typeof reqOrToken === "string" ? reqOrToken : (maybeToken || "");
    const baseOptions = getBaseCookieOptions(req);
    cookieUtils.setCookie(res, "refreshToken", token, {
        ...baseOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
};

const setBetterAuthSessionCookie = (res: Response, reqOrToken: Request | string, maybeToken?: string) => {
    const req = typeof reqOrToken === "object" ? reqOrToken : undefined;
    const token = typeof reqOrToken === "string" ? reqOrToken : (maybeToken || "");
    const baseOptions = getBaseCookieOptions(req);
    cookieUtils.setCookie(res, "better-auth.session_token", token, {
        ...baseOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
};

const clearAuthCookies = (res: Response, req?: Request) => {
    const baseOptions = getBaseCookieOptions(req);
    cookieUtils.clearCookie(res, "accessToken", baseOptions);
    cookieUtils.clearCookie(res, "refreshToken", baseOptions);
    cookieUtils.clearCookie(res, "better-auth.session_token", baseOptions);
};

export const tokenUtils = {
    getAccessToken,
    getRefreshToken,
    setAccessTokenCookie,
    setRefreshTokenCookie,
    setBetterAuthSessionCookie,
    clearAuthCookies,
    getBaseCookieOptions,
};