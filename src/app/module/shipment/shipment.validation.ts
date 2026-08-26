import z from "zod";

const requiredString = (fieldName: string) =>
    z.string({
        error: (issue) =>
            issue.input === undefined
                ? `${fieldName} is required`
                : `${fieldName} must be a string`,
    });

export const createShipmentSchema = z.object({
    body: z.object({
        origin: requiredString("Origin"),
        destination: requiredString("Destination"),
        weight: z.number({
            error: () => "Weight must be a number",
        }).positive("Weight must be positive"),
        description: z.string().optional(),
        estimatedDate: z.string().optional(),
    }),
});

export const updateShipmentStatusSchema = z.object({
    body: z.object({
        status: z.enum([
            "PENDING",
            "PICKED_UP",
            "IN_TRANSIT",
            "AT_CUSTOMS",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "CANCELLED",
        ], {
            error: () => "Invalid shipment status",
        }),
        location: requiredString("Location"),
        note: z.string().optional(),
    }),
    params: z.object({
        id: requiredString("Shipment ID"),
    }),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>["body"];
export type UpdateShipmentStatusInput = z.infer<typeof updateShipmentStatusSchema>["body"];