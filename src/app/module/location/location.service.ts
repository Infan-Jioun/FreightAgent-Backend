import status from "http-status";
import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../../lib/prisma";
import { redis } from "../../../lib/redis";
import AppError from "../../../errorHelper/AppError";
import {
    CreateLocationInput,
    UpdateLocationInput,
    BlockLocationInput,
    LocationQuery,
    PaginatedLocations,
    LocationResponse,
} from "./location.interface";

// ─── Cache Keys ───────────────────────────────────────────
const CACHE_TTL = 20 * 60; // 20 minutes (seconds)
const cacheKey = {
    single: (id: string) => `location:id:${id}`,
    byCode: (code: string) => `location:code:${code}`,
    list: (query: LocationQuery) => `location:list:${JSON.stringify(query)}`,
    search: (q: string, limit: number) => `location:search:${q}:${limit}`,
};

// ─── Helpers ──────────────────────────────────────────────
const invalidateListCache = async () => {
    // Delete all list/search cache keys on any mutation
    const keys = await redis.keys("location:list:*");
    const searchKeys = await redis.keys("location:search:*");
    const all = [...keys, ...searchKeys];
    if (all.length > 0) await redis.del(...all);
};

// ─── Select Shape (reusable) ──────────────────────────────
const locationSelect = {
    id: true,
    name: true,
    code: true,
    country: true,
    countryCode: true,
    city: true,
    region: true,
    latitude: true,
    longitude: true,
    type: true,
    isBlocked: true,
    blockedReason: true,
    createdAt: true,
    updatedAt: true,
    createdBy: {
        select: { id: true, name: true, email: true },
    },
} satisfies Prisma.LocationSelect;

// ─── 1. Create ────────────────────────────────────────────
const create = async (
    input: CreateLocationInput,
    adminId: string
): Promise<LocationResponse> => {
    const existing = await prisma.location.findUnique({
        where: { code: input.code.toUpperCase() },
    });

    if (existing) {
        if (existing.isDeleted) {
            throw new AppError(
                status.CONFLICT,
                `Location with code "${input.code}" exists but is deleted. Restore it instead.`
            );
        }
        throw new AppError(
            status.CONFLICT,
            `Location with code "${input.code}" already exists`
        );
    }

    const location = await prisma.location.create({
        data: {
            ...input,
            code: input.code.toUpperCase(),
            countryCode: input.countryCode.toUpperCase(),
            createdById: adminId,
            updatedById: adminId,
        },
        select: locationSelect,
    });

    // Cache single + invalidate lists
    await Promise.all([
        redis.set(cacheKey.single(location.id), JSON.stringify(location), { ex: CACHE_TTL }),
        redis.set(cacheKey.byCode(location.code), JSON.stringify(location), { ex: CACHE_TTL }),
        invalidateListCache(),
    ]);

    return location as LocationResponse;
};

// ─── 2. Get All (paginated + filtered) ───────────────────
const getAll = async (query: LocationQuery): Promise<PaginatedLocations> => {
    const {
        search,
        country,
        countryCode,
        region,
        type,
        isBlocked,
        isDeleted = false,
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc",
    } = query;

    // ── Cache check ──
    const key = cacheKey.list({ search, country, countryCode, region, type, isBlocked, isDeleted, page, limit, sortBy, sortOrder  });
    console.log(key);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached as string) as PaginatedLocations;

    const where: Prisma.LocationWhereInput = {
        isDeleted,
        ...(isBlocked !== undefined && { isBlocked }),
        ...(type && { type }),
        ...(country && { country: { contains: country, mode: "insensitive" } }),
        ...(countryCode && { countryCode: countryCode.toUpperCase() }),
        ...(region && { region: { contains: region, mode: "insensitive" } }),
        ...(search && {
            OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
                { city: { contains: search, mode: "insensitive" } },
                { country: { contains: search, mode: "insensitive" } },
                { region: { contains: search, mode: "insensitive" } },
            ],
        }),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
        prisma.location.findMany({
            where,
            select: locationSelect,
            orderBy: { [sortBy]: sortOrder },
            skip,
            take: limit,
        }),
        prisma.location.count({ where }),
    ]);

    const totalPage = Math.ceil(total / limit);

    const result: PaginatedLocations = {
        data: data as LocationResponse[],
        meta: { total, page, limit, totalPage },
    };

    await redis.set(key, JSON.stringify(result), { ex: CACHE_TTL });

    return result;
};

// ─── 3. Get By ID ─────────────────────────────────────────
const getById = async (id: string): Promise<LocationResponse> => {
    // ── Cache check ──
    const cached = await redis.get(cacheKey.single(id));
    if (cached) return JSON.parse(cached as string) as LocationResponse;

    const location = await prisma.location.findFirst({
        where: { id, isDeleted: false },
        select: locationSelect,
    });

    if (!location) throw new AppError(status.NOT_FOUND, "Location not found");

    await redis.set(cacheKey.single(id), JSON.stringify(location), { ex: CACHE_TTL });

    return location as LocationResponse;
};

// ─── 4. Get By Code ───────────────────────────────────────
const getByCode = async (code: string): Promise<LocationResponse> => {
    const upperCode = code.toUpperCase();

    // ── Cache check ──
    const cached = await redis.get(cacheKey.byCode(upperCode));
    if (cached) return JSON.parse(cached as string) as LocationResponse;

    const location = await prisma.location.findFirst({
        where: { code: upperCode, isDeleted: false },
        select: locationSelect,
    });

    if (!location) throw new AppError(status.NOT_FOUND, `Location with code "${code}" not found`);

    await redis.set(cacheKey.byCode(upperCode), JSON.stringify(location), { ex: CACHE_TTL });

    return location as LocationResponse;
};

// ─── 5. Update ────────────────────────────────────────────
const update = async (
    id: string,
    input: UpdateLocationInput,
    adminId: string
): Promise<LocationResponse> => {
    await getById(id); // throws 404 if not found

    const location = await prisma.location.update({
        where: { id },
        data: {
            ...input,
            ...(input.countryCode && { countryCode: input.countryCode.toUpperCase() }),
            updatedById: adminId,
        },
        select: locationSelect,
    });

    // Invalidate caches
    await Promise.all([
        redis.del(cacheKey.single(id)),
        redis.del(cacheKey.byCode(location.code)),
        invalidateListCache(),
    ]);

    return location as LocationResponse;
};

// ─── 6. Block ─────────────────────────────────────────────
const block = async (
    id: string,
    input: BlockLocationInput,
    adminId: string
): Promise<LocationResponse> => {
    const location = await getById(id);

    if (location.isBlocked) {
        throw new AppError(status.BAD_REQUEST, "Location is already blocked");
    }

    const activeShipmentCount = await prisma.shipment.count({
        where: {
            OR: [{ originLocationId: id }, { destinationLocationId: id }],
            status: { notIn: ["DELIVERED", "CANCELLED"] },
        },
    });

    if (activeShipmentCount > 0) {
        throw new AppError(
            status.BAD_REQUEST,
            `Cannot block location: ${activeShipmentCount} active shipment(s) are using it`
        );
    }

    const updated = await prisma.location.update({
        where: { id },
        data: {
            isBlocked: true,
            blockedReason: input.blockedReason ?? null,
            updatedById: adminId,
        },
        select: locationSelect,
    });

    await Promise.all([
        redis.del(cacheKey.single(id)),
        redis.del(cacheKey.byCode(updated.code)),
        invalidateListCache(),
    ]);

    return updated as LocationResponse;
};

// ─── 7. Unblock ───────────────────────────────────────────
const unblock = async (id: string, adminId: string): Promise<LocationResponse> => {
    const location = await getById(id);

    if (!location.isBlocked) {
        throw new AppError(status.BAD_REQUEST, "Location is not blocked");
    }

    const updated = await prisma.location.update({
        where: { id },
        data: {
            isBlocked: false,
            blockedReason: null,
            updatedById: adminId,
        },
        select: locationSelect,
    });

    await Promise.all([
        redis.del(cacheKey.single(id)),
        redis.del(cacheKey.byCode(updated.code)),
        invalidateListCache(),
    ]);

    return updated as LocationResponse;
};

// ─── 8. Soft Delete ───────────────────────────────────────
const softDelete = async (id: string, adminId: string): Promise<void> => {
    const location = await getById(id);

    const corridorCount = await prisma.agentCorridor.count({
        where: {
            OR: [{ originPortId: id }, { destinationPortId: id }],
            isActive: true,
        },
    });

    if (corridorCount > 0) {
        throw new AppError(
            status.BAD_REQUEST,
            `Cannot delete location: ${corridorCount} active corridor(s) are using it`
        );
    }

    const activeShipmentCount = await prisma.shipment.count({
        where: {
            OR: [{ originLocationId: id }, { destinationLocationId: id }],
            status: { notIn: ["DELIVERED", "CANCELLED"] },
        },
    });

    if (activeShipmentCount > 0) {
        throw new AppError(
            status.BAD_REQUEST,
            `Cannot delete location: ${activeShipmentCount} active shipment(s) are using it`
        );
    }

    await prisma.location.update({
        where: { id },
        data: {
            isDeleted: true,
            deletedAt: new Date(),
            deletedById: adminId,
        },
    });

    await Promise.all([
        redis.del(cacheKey.single(id)),
        redis.del(cacheKey.byCode(location.code)),
        invalidateListCache(),
    ]);
};

// ─── 9. Restore ───────────────────────────────────────────
const restore = async (id: string, adminId: string): Promise<LocationResponse> => {
    const existing = await prisma.location.findUnique({
        where: { id },
        select: { id: true, isDeleted: true },
    });

    if (!existing) throw new AppError(status.NOT_FOUND, "Location not found");
    if (!existing.isDeleted) throw new AppError(status.BAD_REQUEST, "Location is not deleted");

    const restored = await prisma.location.update({
        where: { id },
        data: {
            isDeleted: false,
            deletedAt: null,
            deletedById: null,
            updatedById: adminId,
        },
        select: locationSelect,
    });

    await Promise.all([
        redis.set(cacheKey.single(id), JSON.stringify(restored), { ex: CACHE_TTL }),
        redis.set(cacheKey.byCode(restored.code), JSON.stringify(restored), { ex: CACHE_TTL }),
        invalidateListCache(),
    ]);

    return restored as LocationResponse;
};

// ─── 10. Search (autocomplete) ────────────────────────────
const search = async (query: string, limit = 10) => {
    if (!query || query.trim().length < 2) return [];

    // ── Cache check ──
    const key = cacheKey.search(query.trim().toLowerCase(), limit);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached as string);

    const results = await prisma.location.findMany({
        where: {
            isDeleted: false,
            isBlocked: false,
            OR: [
                { name: { contains: query, mode: "insensitive" } },
                { code: { contains: query, mode: "insensitive" } },
                { city: { contains: query, mode: "insensitive" } },
            ],
        },
        select: {
            id: true,
            name: true,
            code: true,
            city: true,
            country: true,
            countryCode: true,
            type: true,
            latitude: true,
            longitude: true,
        },
        take: limit,
        orderBy: { name: "asc" },
    });

    await redis.set(key, JSON.stringify(results), { ex: CACHE_TTL });

    return results;
};

export const locationService = {
    create,
    getAll,
    getById,
    getByCode,
    update,
    block,
    unblock,
    softDelete,
    restore,
    search,
};