import z from "zod";

const requiredString = (fieldName: string) =>
    z.string({
        error: (issue) =>
            issue.input === undefined
                ? `${fieldName} is required`
                : `${fieldName} must be a string`,
    });

export const updateAgentShipmentStatusSchema = z.object({
    body: z.object({
        status: z.enum(
            ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"],
            {
                error: () => "Agent can only set status to ACCEPTED, PICKED_UP, IN_TRANSIT, or DELIVERED",
            }
        ),
        location: requiredString("Location"),
        note: z.string().optional(),
    }),
    params: z.object({
        id: requiredString("Shipment ID"),
    }),
});

export const acceptShipmentSchema = z.object({
    body: z.object({
        location: z.string().optional(),
        note: z.string().optional(),
    }).optional(),
    params: z.object({
        id: requiredString("Shipment ID"),
    }),
});

export const updateAvailabilitySchema = z.object({
    body: z.object({
        isAvailable: z.boolean({
            error: () => "isAvailable must be a boolean",
        }),
    }),
});

export type UpdateAgentShipmentStatusInput = z.infer<typeof updateAgentShipmentStatusSchema>["body"];
export type AcceptShipmentInput = z.infer<typeof acceptShipmentSchema>["body"];
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>["body"];
