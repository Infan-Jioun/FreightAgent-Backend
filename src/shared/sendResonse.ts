import { Response } from "express"

interface IResponseData<T> {
    httpStatusCode: number
    success: boolean
    message: string
    data?: T,
    meta?: {
        page: number,
        limit: number,
        total: number,
        totalPage: number
    }
}
export const sendResposne = <T>(res: Response, responseData: IResponseData<T>) => {
    const { httpStatusCode, message, success, data, meta } = responseData;
    res.status(httpStatusCode).json({
        success,
        message,
        data,
        meta
    })
}