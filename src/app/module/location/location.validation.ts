import { z } from "zod";
import { LocationType } from "../../../generated/prisma";

// ─── Helpers ──────────────────────────────────────────────
const locationTypeValues = Object.values(LocationType) as [string, ...string[]];

// ─── Create ───────────────────────────────────────────────
export const createLocationSchema = z.object({
    body: z.object({
        name: z
            .string({ error: "Name is required" })
            .min(2, "Name must be at least 2 characters")
            .max(100, "Name must not exceed 100 characters")
            .trim(),

        code: z
            .string({ error: "Code is required" })
            .min(2, "Code must be at least 2 characters")
            .max(10, "Code must not exceed 10 characters")
            .toUpperCase()
            .trim(),

        country: z
            .string({ error: "Country is required" })
            .min(2, "Country must be at least 2 characters")
            .max(100)
            .trim(),

        countryCode: z
            .string({ error: "Country code is required" })
            .length(2, "Country code must be exactly 2 characters (ISO 3166-1 alpha-2)")
            .toUpperCase()
            .trim(),

        city: z
            .string({ error: "City is required" })
            .min(2, "City must be at least 2 characters")
            .max(100)
            .trim(),

        region: z
            .string({ error: "Region is required" })
            .min(2, "Region must be at least 2 characters")
            .max(100)
            .trim(),

        latitude: z
            .number({ error: "Latitude is required" })
            .min(-90, "Latitude must be between -90 and 90")
            .max(90, "Latitude must be between -90 and 90"),

        longitude: z
            .number({ error: "Longitude is required" })
            .min(-180, "Longitude must be between -180 and 180")
            .max(180, "Longitude must be between -180 and 180"),

        type: z.nativeEnum(LocationType).optional(),
    }),
});

// ─── Update ───────────────────────────────────────────────
export const updateLocationSchema = z.object({
    params: z.object({
        id: z.string().uuid("Invalid location ID"),
    }),
    body: z
        .object({
            name: z.string().min(2).max(100).trim().optional(),
            country: z.string().min(2).max(100).trim().optional(),
            countryCode: z.string().length(2).toUpperCase().trim().optional(),
            city: z.string().min(2).max(100).trim().optional(),
            region: z.string().min(2).max(100).trim().optional(),
            latitude: z.number().min(-90).max(90).optional(),
            longitude: z.number().min(-180).max(180).optional(),
            type: z.enum(locationTypeValues as [string, ...string[]]).optional(),
        })
        .refine((data) => Object.keys(data).length > 0, {
            message: "At least one field is required to update",
        }),
});

// ─── Block ────────────────────────────────────────────────
export const blockLocationSchema = z.object({
    params: z.object({
        id: z.string().uuid("Invalid location ID"),
    }),
    body: z.object({
        blockedReason: z
            .string()
            .min(5, "Blocked reason must be at least 5 characters")
            .max(500)
            .trim()
            .optional(),
    }),
});

// ─── ID Param ─────────────────────────────────────────────
export const locationIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("Invalid location ID"),
    }),
});

// ─── Query ────────────────────────────────────────────────
export const locationQuerySchema = z.object({
    query: z.object({
        search: z.string().trim().optional(),
        country: z.string().trim().optional(),
        countryCode: z.string().length(2).toUpperCase().trim().optional(),
        region: z.string().trim().optional(),
        type: z.enum(locationTypeValues as [string, ...string[]]).optional(),
        isBlocked: z
            .enum(["true", "false"])
            .transform((v) => v === "true")
            .optional(),
        isDeleted: z
            .enum(["true", "false"])
            .transform((v) => v === "true")
            .optional(),
        page: z
            .string()
            .optional()
            .transform((v) => (v ? parseInt(v, 10) : 1))
            .pipe(z.number().min(1, "Page must be at least 1")),
        limit: z
            .string()
            .optional()
            .transform((v) => (v ? parseInt(v, 10) : 20))
            .pipe(z.number().min(1).max(100, "Limit must not exceed 100")),
        sortBy: z
            .enum(["name", "code", "country", "createdAt"])
            .optional()
            .default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
    }),
});

// ─── Exported Types ───────────────────────────────────────
export type CreateLocationSchema = z.infer<typeof createLocationSchema>;
export type UpdateLocationSchema = z.infer<typeof updateLocationSchema>;
export type BlockLocationSchema = z.infer<typeof blockLocationSchema>;
export type LocationQuerySchema = z.infer<typeof locationQuerySchema>;