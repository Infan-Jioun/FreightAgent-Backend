import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AnyZodObject } from "zod/v3";
import { sendResposne } from "../shared/sendResonse";
import status from "http-status";

const validateRequest = (schema: AnyZodObject) => {
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync({ body: req.body, query: req.query, pramas: req.params })
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return sendResposne(res, {
                    httpStatusCode: status.NOT_FOUND,
                    success: false,
                    message: error.message,
                    data: null
                })
            }
        }
    }
}