import { NextFunction, Request, Response } from "express";
import { ZodError, ZodObject } from "zod";
import { sendResponse } from "../shared/sendResonse";
import status from "http-status";

type AnyZodObject = ZodObject<any, any>;

export const validateRequest = (schema: AnyZodObject) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync({ body: req.body, query: req.query, params: req.params })
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return sendResponse(res, {
                    httpStatusCode: status.NOT_FOUND,
                    success: false,
                    message: error.message,
                    data: null
                })
            }
        }
    }
}