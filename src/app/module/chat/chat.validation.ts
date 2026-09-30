import { z } from "zod";

export const createConversationSchema = z.object({
    body: z.object({
        shipmentId: z
            .string({ error: "Shipment ID is required" })
            .min(1, "Shipment ID cannot be empty")
            .trim(),
    }),
});

export const sendMessageSchema = z.object({
    params: z.object({
        conversationId: z
            .string({ error: "Conversation ID is required" })
            .min(1, "Conversation ID cannot be empty")
            .trim(),
    }),
    body: z.object({
        content: z
            .string({ error: "Message content is required" })
            .min(1, "Message content cannot be empty")
            .max(2000, "Message content cannot exceed 2000 characters")
            .trim(),
    }),
});

export const conversationParamsSchema = z.object({
    params: z.object({
        conversationId: z
            .string({ error: "Conversation ID is required" })
            .min(1, "Conversation ID cannot be empty")
            .trim(),
    }),
});

export const editMessageSchema = z.object({
    params: z.object({
        conversationId: z
            .string({ error: "Conversation ID is required" })
            .min(1, "Conversation ID cannot be empty")
            .trim(),
        messageId: z
            .string({ error: "Message ID is required" })
            .min(1, "Message ID cannot be empty")
            .trim(),
    }),
    body: z.object({
        content: z
            .string({ error: "Message content is required" })
            .min(1, "Message content cannot be empty")
            .max(2000, "Message content cannot exceed 2000 characters")
            .trim(),
    }),
});

export const getConversationMessagesSchema = z.object({
    params: z.object({
        conversationId: z
            .string({ error: "Conversation ID is required" })
            .min(1, "Conversation ID cannot be empty")
            .trim(),
    }),
    query: z.object({
        cursor: z.string().trim().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        after: z.string().trim().optional(),
    }),
});

// Socket Payload Validation Schemas (Amendment 3)
export const socketSendMessageSchema = z.object({
    conversationId: z.string().min(1, "Conversation ID is required"),
    content: z.string().min(1, "Message content cannot be empty").max(2000, "Message content cannot exceed 2000 characters"),
    clientMessageId: z.string().max(100).optional(),
    tempId: z.string().max(100).optional(),
    type: z.enum(["TEXT", "FILE"]).optional().default("TEXT"),
    attachmentUrl: z.string().url().max(1000).optional().nullable(),
    attachmentName: z.string().max(255).optional().nullable(),
});

export const socketEditMessageSchema = z.object({
    conversationId: z.string().min(1, "Conversation ID is required"),
    messageId: z.string().min(1, "Message ID is required"),
    content: z.string().min(1, "Message content cannot be empty").max(2000, "Message content cannot exceed 2000 characters"),
});

export const socketConversationRoomSchema = z.object({
    conversationId: z.string().min(1, "Conversation ID is required"),
});
