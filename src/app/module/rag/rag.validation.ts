import { z } from "zod";

export const ragQuerySchema = z.object({
    body: z.object({
        message: z
            .string({ error: "Message is required" })
            .min(1, "Message cannot be empty")
            .max(2000, "Message cannot exceed 2000 characters")
            .trim(),
        sessionId: z.string().trim().optional(),
        model: z.string().trim().optional(),
    }),
});

export const ragSessionParamsSchema = z.object({
    params: z.object({
        sessionId: z
            .string({ error: "Session ID is required" })
            .min(1, "Session ID cannot be empty")
            .trim(),
    }),
});
