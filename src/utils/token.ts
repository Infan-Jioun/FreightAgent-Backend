import { JwtPayload, SignOptions } from "jsonwebtoken";
import { JwtTokenUtils } from "./jwt";
import { envConfig } from "../_config/env";

const getAccessToken = (payload: JwtPayload) => {
    const accessToken = JwtTokenUtils.createToken(
        payload, envConfig.ACCESS_TOKEN_SECRET, {
            expiresIn: envConfig.ACCESS_TOKEN_EXPIRES_IN
        } as SignOptions
    )
    return accessToken
}
const refreshToken = (payload: JwtPayload) => {
   const refreshToken = JwtTokenUtils.createToken(
    payload, envConfig.
   )
}