

// ─── Query Params ────────────────────────────────────────────────────────────

import { LocationType } from "../../../generated/prisma";

export interface LocationQuery {
    search?: string | undefined;
    country?: string | undefined;
    countryCode?: string | undefined;
    region?: string | undefined;
    type?: LocationType | undefined;
    isBlocked?: boolean | undefined;
    isDeleted?: boolean | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: "name" | "code" | "country" | "createdAt" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}

// ─── Create ──────────────────────────────────────────────────────────────────

export interface CreateLocationInput {
    name: string;
    code: string;
    country: string;
    countryCode: string;
    city: string;
    region: string;
    latitude: number;
    longitude: number;
    type?: LocationType;
}

// ─── Update ──────────────────────────────────────────────────────────────────

export interface UpdateLocationInput {
    name?: string;
    country?: string;
    countryCode?: string;
    city?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
    type?: LocationType;
}

// ─── Block / Unblock ─────────────────────────────────────────────────────────

export interface BlockLocationInput {
    blockedReason?: string;
}

// ─── Paginated Response ──────────────────────────────────────────────────────

export interface PaginatedLocations {
    data: LocationResponse[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPage: number;
    };
}

// ─── Response Shape ──────────────────────────────────────────────────────────

export interface LocationResponse {
    id: string;
    name: string;
    code: string;
    country: string;
    countryCode: string;
    city: string;
    region: string;
    latitude: number;
    longitude: number;
    type?: LocationType;
    isBlocked: boolean;
    blockedReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: {
        id: string;
        name: string;
        email: string;
    } | null;
}