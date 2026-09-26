import { Router } from "express";
import { authenticate } from "../../../middleware/auth";
import { validateRequest } from "../../../middleware/validateRequest";
import { chatController } from "./chat.controller";
import {
    createConversationSchema,
    sendMessageSchema,
    conversationParamsSchema,
} from "./chat.validation";

const router = Router();

// All chat routes require authenticated session
router.use(authenticate);

// 1. Get or create conversation for an assigned consignment
router.post(
    "/conversation",
    validateRequest(createConversationSchema),
    chatController.getOrCreateConversation
);

// 2. List all accessible conversations for current user
router.get(
    "/conversations",
    chatController.getUserConversations
);

// 3. Get messages for a specific conversation
router.get(
    "/conversations/:conversationId/messages",
    validateRequest(conversationParamsSchema),
    chatController.getConversationMessages
);

// 4. Send message to a specific conversation (HTTP fallback alongside Socket.io)
router.post(
    "/conversations/:conversationId/messages",
    validateRequest(sendMessageSchema),
    chatController.sendMessage
);

export const chatRouter = router;
