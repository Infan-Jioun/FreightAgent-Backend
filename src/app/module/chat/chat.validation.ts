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
