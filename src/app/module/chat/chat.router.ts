import { Router } from "express";
import { authenticate } from "../../../middleware/auth";
import { validateRequest } from "../../../middleware/validateRequest";
import { uploadChatAttachment } from "../../../middleware/fileUpload";
import { chatController } from "./chat.controller";
import {
    createConversationSchema,
    sendMessageSchema,
    editMessageSchema,
    conversationParamsSchema,
    getConversationMessagesSchema,
} from "./chat.validation";

const router = Router();

// All chat conversation routes require authenticated session (Amendment 3)
router.use(authenticate);

// Protected streaming endpoint for chat attachments (PDFs, manifests, images)
router.get("/files/:filename", chatController.streamChatFile);

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

// 3. Get messages for a specific conversation with cursor pagination & ?after= support
router.get(
    "/conversations/:conversationId/messages",
    validateRequest(getConversationMessagesSchema),
    chatController.getConversationMessages
);

// 4. Send message to a specific conversation (HTTP fallback alongside Socket.io)
router.post(
    "/conversations/:conversationId/messages",
    validateRequest(sendMessageSchema),
    chatController.sendMessage
);

// 5. Edit message in a specific conversation
router.patch(
    "/conversations/:conversationId/messages/:messageId",
    validateRequest(editMessageSchema),
    chatController.editMessage
);

// 6. Mark conversation messages as read
router.patch(
    "/conversations/:conversationId/read",
    validateRequest(conversationParamsSchema),
    chatController.markMessagesAsRead
);

// 7. Upload file attachment (max 10MB) to conversation
router.post(
    "/conversations/:conversationId/upload",
    validateRequest(conversationParamsSchema),
    uploadChatAttachment("file"),
    chatController.uploadAttachment
);

export const chatRouter = router;
