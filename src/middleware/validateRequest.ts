import { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, ZodType } from "zod";
import { sendResponse } from "../shared/sendResonse";
import status from "http-status";

interface ParsedRequestData {
    body?: unknown;
    query?: unknown;
    params?: unknown;
}

export const validateRequest = (schema: ZodType): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = (await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            })) as ParsedRequestData;

            if (parsed.body !== undefined) {
                req.body = parsed.body;
            }
            if (parsed.query !== undefined) {
                Object.assign(req.query, parsed.query);
            }
            if (parsed.params !== undefined) {
                req.params = parsed.params as Request["params"];
            }

            next();
        } catch (error: unknown) {
            if (error instanceof ZodError) {
                const errors = error.issues.map((err) => ({
                    field: err.path.map(String).join(".") || "input",
                    message: err.message,
                }));

                sendResponse(res, {
                    httpStatusCode: status.BAD_REQUEST,
                    success: false,
                    message: errors[0]?.message ?? "Validation error",
                    data: errors,
                });
                return;
            }

            next(error);
        }
    };
};