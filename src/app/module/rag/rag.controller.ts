import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResonse";
import { ragService } from "./rag.service";
import { IRagQueryPayload } from "./rag.interface";

const askQuestion = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body as IRagQueryPayload;
    const result = await ragService.askQuestion(payload);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "AI response generated successfully",
        data: result,
    });
});

const getSessionHistory = catchAsync(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const history = await ragService.getSessionHistory(sessionId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Session history retrieved successfully",
        data: history,
    });
});

const clearSession = catchAsync(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const result = await ragService.clearSession(sessionId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
        data: result,
    });
});

const getPublicDirectory = catchAsync(async (_req: Request, res: Response) => {
    const result = await ragService.getPublicDirectory();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Public logistics directory retrieved successfully",
        data: result,
    });
});

export const ragController = {
    askQuestion,
    getSessionHistory,
    clearSession,
    getPublicDirectory,
};
