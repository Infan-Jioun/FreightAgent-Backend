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