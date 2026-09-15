import z from "zod";

export const updateRoleSchema = z.object({
    body: z.object({
        role: z.enum(["CUSTOMER", "AGENT", "ADMIN"], {
            error: () => "Role must be CUSTOMER, AGENT or ADMIN",
        }),
    }),
    params: z.object({
        id: z.string({ error: () => "User ID is required" }),
    }),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const updateUserStatusSchema = z.object({
    body: z
        .object({
            isBlocked: z.boolean().optional(),
            status: z.enum(["ACTIVE", "BLOCKED", "SUSPENDED"]).optional(),
            reason: z.string().max(255).optional(),
            blockedReason: z.string().max(255).optional(),
        })
        .refine(
            (data) => data.isBlocked !== undefined || data.status !== undefined,
            {
                message: "Either isBlocked or status (ACTIVE/BLOCKED/SUSPENDED) must be provided",
            }
        ),
    params: z.object({
        id: z.string({ error: () => "User ID is required" }),
    }),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const assignRoadAgentSchema = z.object({
    body: z.object({
        agentId: z.string({ error: () => "Agent ID is required" }),
        note: z.string().optional(),
    }),
    params: z.object({
        id: z.string({ error: () => "Shipment ID is required" }),
    }),
});

export type AssignRoadAgentInput = z.infer<typeof assignRoadAgentSchema>;