import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResonse";
import { chatService } from "./chat.service";

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

    const messages = await chatService.getConversationMessages(
        user.id,
        user.role,
        conversationId as string
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Conversation messages retrieved successfully",
        data: messages,
    });
});

const sendMessage = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const { conversationId } = req.params;
    const { content } = req.body;

    const message = await chatService.sendMessage(
        user.id,
        user.role,
        conversationId as string,
        content
    );

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Message sent successfully",
        data: message,
    });
});

export const chatController = {
    getOrCreateConversation,
    getUserConversations,
    getConversationMessages,
    sendMessage,
};
