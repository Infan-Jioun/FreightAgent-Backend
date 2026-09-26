import { Router } from "express";
import { locationController } from "./location.controller";
import {
    createLocationSchema,
    updateLocationSchema,
    blockLocationSchema,
    locationIdSchema,
    locationQuerySchema,
} from "./location.validation";
import { authenticate, authorize } from "../../../middleware/auth";
import { validateRequest } from "../../../middleware/validateRequest";
import { Role } from "../../../generated/prisma";

const router = Router();

// ─── Public / Authenticated (all roles) ──────────────────────────────────────

/**
 * GET /locations/search?q=chittagong&limit=10
 * Lightweight autocomplete — used in shipment create form
 * Accessible by: ADMIN, AGENT, CUSTOMER
 */
router.get(
    "/search",
    locationController.search
);

/**
 * GET /locations/code/:code
 * Fetch single location by IATA/port code (e.g. CGP, CTG)
 * Accessible by: ADMIN, AGENT, CUSTOMER
 */
router.get(
    "/code/:code",
    locationController.getByCode
);

/**
 * GET /locations/:id
 * Fetch single location by ID
 * Accessible by: ADMIN, AGENT, CUSTOMER
 */
router.get(
    "/:id",
    authenticate,
    validateRequest(locationIdSchema),
    locationController.getById
);

/**
 * GET /locations
 * List all locations with filters & pagination
 * Accessible by: ADMIN, AGENT, CUSTOMER
 */
router.get(
    "/",
    // validateRequest(locationQuerySchema),
    locationController.getAll
);

// ─── Admin Only ───────────────────────────────────────────────────────────────

/**
 * POST /locations
 * Create a new location/port
 * Accessible by: ADMIN only
 */
router.post(
    "/",
    authenticate,
    authorize(Role.ADMIN),
    validateRequest(createLocationSchema),
    locationController.create
);

/**
 * PATCH /locations/:id
 * Update location details
 * Accessible by: ADMIN only
 */
router.patch(
    "/:id",
    authenticate,
    authorize(Role.ADMIN),
    validateRequest(updateLocationSchema),
    locationController.update
);

/**
 * PATCH /locations/:id/block
 * Block a location (prevents new shipments using it)
 * Accessible by: ADMIN only
 */
router.patch(
    "/:id/block",
    authenticate,
    authorize(Role.ADMIN),
    validateRequest(blockLocationSchema),
    locationController.block
);

/**
 * PATCH /locations/:id/unblock
 * Unblock a location
 * Accessible by: ADMIN only
 */
router.patch(
    "/:id/unblock",
    authenticate,
    authorize(Role.ADMIN),
    validateRequest(locationIdSchema),
    locationController.unblock
);

/**
 * DELETE /locations/:id
 * Soft delete a location
 * Accessible by: ADMIN only
 */
router.delete(
    "/:id",
    authenticate,
    authorize(Role.ADMIN),
    validateRequest(locationIdSchema),
    locationController.softDelete
);

/**
 * PATCH /locations/:id/restore
 * Restore a soft-deleted location
 * Accessible by: ADMIN only
 */
router.patch(
    "/:id/restore",
    authenticate,
    authorize(Role.ADMIN),
    validateRequest(locationIdSchema),
    locationController.restore
);

export const locationRouter = router;