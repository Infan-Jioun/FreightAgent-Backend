// user.validation.ts

import { z } from "zod";
import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";

// ─── Reusable Phone Schema ─────────────────────────────────────────────────
const internationalPhoneSchema = z
    .string()
    .min(7, "Phone number is too short")
    .max(20, "Phone number is too long")
    .refine(
        (val) => {
            try {
                return isValidPhoneNumber(val); // +8801711000000 ✅ | +12125551234 ✅
            } catch {
                return false;
            }
        },
        "Invalid phone number. Please include country code (e.g. +8801XXXXXXXXX)"
    )
    .transform((val) => {
        // সবসময় E.164 format-এ normalize করো: +8801711000000
        try {
            return parsePhoneNumber(val).format("E.164");
        } catch {
            return val;
        }
    });

// ─── Schemas ───────────────────────────────────────────────────────────────
export const updateProfileSchema = z.object({
    body: z
        .object({
            name: z.string().min(2).max(100).optional(),
            image: z.string().url("Image must be a valid URL").optional(),
            address: z.string().min(3).max(255).optional(),
        })
        .optional(),
});

export const requestPhoneVerificationSchema = z.object({
    body: z.object({
        phone: internationalPhoneSchema,
    }),
});

export const verifyPhoneSchema = z.object({
    body: z.object({
        phone: internationalPhoneSchema,
        code: z
            .string()
            .length(6, "Verification code must be 6 digits")
            .regex(/^\d+$/, "Code must be numeric"),
    }),
});