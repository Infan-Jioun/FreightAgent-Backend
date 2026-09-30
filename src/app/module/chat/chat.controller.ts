import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResonse";
import { chatService } from "./chat.service";
import AppError from "../../../errorHelper/AppError";
import { getChatFilePath } from "../../../utils/chatFileStorage";

const getOrCreateConversation = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const { shipmentId } = req.body;

    const conversation = await chatService.getOrCreateConversationForShipment(
        user.id,
        user.role,
        shipmentId
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Conversation retrieved successfully",
        data: conversation,
    });
});

const getUserConversations = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const conversations = await chatService.getUserConversations(user.id, user.role);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Conversations retrieved successfully",
        data: conversations,
    });
});

const getConversationMessages = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const { conversationId } = req.params;
    const { cursor, limit, after } = req.query as {
        cursor?: string;
        limit?: string;
        after?: string;
    };

    const result = await chatService.getConversationMessages(
        user.id,
        user.role,
        conversationId as string,
        {
            cursor,
            limit: limit ? Number(limit) : undefined,
            after,
        }
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Conversation messages retrieved successfully",
        data: result,
    });
});

const sendMessage = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const { conversationId } = req.params;
    const { content, clientMessageId } = req.body;

    const message = await chatService.sendMessage(
        user.id,
        user.role,
        conversationId as string,
        content,
        clientMessageId
    );

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Message sent successfully",
        data: message,
    });
});

const markMessagesAsRead = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const { conversationId } = req.params;

    const result = await chatService.markMessagesAsRead(
        user.id,
        user.role,
        conversationId as string
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Messages marked as read successfully",
        data: result,
    });
});

const uploadAttachment = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const { conversationId } = req.params;

    if (!req.file) {
        throw new AppError(
            status.BAD_REQUEST,
            "Please provide a file to upload (maximum 10MB)"
        );
    }

    const message = await chatService.uploadChatAttachment(
        user.id,
        user.role,
        conversationId as string,
        req.file
    );

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "File uploaded and sent successfully",
        data: message,
    });
});

const streamChatFile = catchAsync(async (req: Request, res: Response) => {
    const { filename } = req.params;

    if (!filename || typeof filename !== "string") {
        throw new AppError(status.BAD_REQUEST, "File name parameter is required");
    }

    const filePath = getChatFilePath(filename);

    // If PDF, configure headers so the browser natively opens the PDF in-viewer
    if (filename.toLowerCase().endsWith(".pdf")) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    }

    res.sendFile(filePath);
});

const editMessage = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const { conversationId, messageId } = req.params;
    const { content } = req.body;

    const message = await chatService.editMessage(
        user.id,
        user.role,
        conversationId as string,
        messageId as string,
        content
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Message updated successfully",
        data: message,
    });
});

export const chatController = {
    getOrCreateConversation,
    getUserConversations,
    getConversationMessages,
    sendMessage,
    editMessage,
    markMessagesAsRead,
    uploadAttachment,
    streamChatFile,
};
