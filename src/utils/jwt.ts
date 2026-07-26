import jwt, { JwtPayload } from "jsonwebtoken"


const createToken = (payload: JwtPayload, secret: string) => {
    const token = jwt.sign(payload, secret, { expiresIn: "5hr" })
    return token;
}
const verifyToken = (token: string, secret: string) => {
    try {
        const decoded = jwt.verify(token, secret) as JwtPayload;
        return {
            success: true,
            data: decoded
        }
    } catch (error: any) {
        return {
            success: false,
            message: error.message,
            error
        };
    }
};
const decodedToken = (token: string) => {
    const decode = jwt.decode(token) as JwtPayload
    return decode
}
export const JwtTokenUtils = {
    createToken,
    verifyToken,
    decodedToken
}
