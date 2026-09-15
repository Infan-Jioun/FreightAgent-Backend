import { convertCurrency, ExchangeRates, getExchangeRates } from "../../../utils/exchangeRate";

export interface GeoCoordinate {
    latitude: number;
    longitude: number;
}

export interface PortGeoData {
    code: string;
    name: string;
    country: string;
    countryCode: string;
    region: "Asia" | "Middle East" | "Europe" | "Americas" | "Africa" | "Oceania";
    latitude: number;
    longitude: number;
}

export interface CostBreakdownItem {
    name: string;
    amountUSD: number;
    description: string;
}

export interface PricingCalculationResult {
    distanceKm: number;
    distanceMultiplier: number;
    distanceTier: "SHORT" | "MEDIUM" | "LONG";
    isFixedRoute: boolean;
    matchedRoute?: string | undefined;
    originPort: { code: string; name: string; region: string };
    destinationPort: { code: string; name: string; region: string };
    baseRatePerKg: number;
    weightKg: number;
    declaredCargoValueUSD: number;
    breakdown: {
        originHandling: number;
        oceanFreight: number;
        bafSurcharge: number;
        thcOrigin: number;
        thcDestination: number;
        transshipmentFee: number;
        customsClearance: number;
        customsDuty: number;
        vat: number;
        destinationHandling: number;
        cargoInsurance: number;
        lastMileDelivery: number;
        agencyFee: number;
        platformFee: number;
    };
    totalUSD: number;
    currency: string;
    exchangeRate: number;
    convertedTotal: number;
}

// 1. Regional Base Rate Table (USD per kg)
export const REGIONAL_BASE_RATES: Record<string, number> = {
    Asia: 0.8,
    "Middle East": 1.2,
    Europe: 2.0,
    Americas: 2.5,
    Africa: 1.8,
    Oceania: 2.2,
};

// 2. Fixed Route Freight Rate Table (Pre-negotiated high-volume commercial corridors)
export interface FixedRouteRate {
    originCode: string;
    destinationCode: string;
    originCountry: string;
    destinationCountry: string;
    baseOceanFreightUSD: number;
    transitDaysEst: number;
}

export const FIXED_ROUTE_RATES: FixedRouteRate[] = [
    {
        originCode: "BDCGP",
        destinationCode: "AEJEA",
        originCountry: "BD",
        destinationCountry: "AE",
        baseOceanFreightUSD: 850,
        transitDaysEst: 14,
    },
    {
        originCode: "BDCGP",
        destinationCode: "SAJED",
        originCountry: "BD",
        destinationCountry: "SA",
        baseOceanFreightUSD: 950,
        transitDaysEst: 18,
    },
    {
        originCode: "BDCGP",
        destinationCode: "MYPKG",
        originCountry: "BD",
        destinationCountry: "MY",
        baseOceanFreightUSD: 600,
        transitDaysEst: 7,
    },
    {
        originCode: "BDCGP",
        destinationCode: "SGSIN",
        originCountry: "BD",
        destinationCountry: "SG",
        baseOceanFreightUSD: 650,
        transitDaysEst: 8,
    },
    {
        originCode: "BDCGP",
        destinationCode: "CNSHA",
        originCountry: "BD",
        destinationCountry: "CN",
        baseOceanFreightUSD: 750,
        transitDaysEst: 12,
    },
    {
        originCode: "BDCGP",
        destinationCode: "USLAX",
        originCountry: "BD",
        destinationCountry: "US",
        baseOceanFreightUSD: 2100,
        transitDaysEst: 28,
    },
    {
        originCode: "BDCGP",
        destinationCode: "USNYC",
        originCountry: "BD",
        destinationCountry: "US",
        baseOceanFreightUSD: 2300,
        transitDaysEst: 32,
    },
    {
        originCode: "BDCGP",
        destinationCode: "NLRTM",
        originCountry: "BD",
        destinationCountry: "NL",
        baseOceanFreightUSD: 1800,
        transitDaysEst: 26,
    },
    {
        originCode: "CNSHA",
        destinationCode: "USLAX",
        originCountry: "CN",
        destinationCountry: "US",
        baseOceanFreightUSD: 1600,
        transitDaysEst: 16,
    },
    {
        originCode: "CNSHA",
        destinationCode: "NLRTM",
        originCountry: "CN",
        destinationCountry: "NL",
        baseOceanFreightUSD: 1750,
        transitDaysEst: 24,
    },
];

// Verified major ports reference table for immediate coordinates & region resolution
export const KNOWN_PORTS: Record<string, PortGeoData> = {
    // Bangladesh
    BDCGP: { code: "BDCGP", name: "Chattogram Port", country: "Bangladesh", countryCode: "BD", region: "Asia", latitude: 22.3167, longitude: 91.8000 },
    BDDAC: { code: "BDDAC", name: "Dhaka Airport / ICD", country: "Bangladesh", countryCode: "BD", region: "Asia", latitude: 23.8433, longitude: 90.3978 },
    BDMGL: { code: "BDMGL", name: "Mongla Port", country: "Bangladesh", countryCode: "BD", region: "Asia", latitude: 22.4833, longitude: 89.6000 },
    BDZYL: { code: "BDZYL", name: "Sylhet Osmani Airport", country: "Bangladesh", countryCode: "BD", region: "Asia", latitude: 24.9632, longitude: 91.8714 },

    // Middle East
    AEJEA: { code: "AEJEA", name: "Jebel Ali / Dubai", country: "United Arab Emirates", countryCode: "AE", region: "Middle East", latitude: 24.9857, longitude: 55.0273 },
    AEDXB: { code: "AEDXB", name: "Dubai International Airport", country: "United Arab Emirates", countryCode: "AE", region: "Middle East", latitude: 25.2532, longitude: 55.3657 },
    SAJED: { code: "SAJED", name: "Jeddah Islamic Port", country: "Saudi Arabia", countryCode: "SA", region: "Middle East", latitude: 21.4858, longitude: 39.1925 },
    SADMM: { code: "SADMM", name: "King Abdulaziz Port Dammam", country: "Saudi Arabia", countryCode: "SA", region: "Middle East", latitude: 26.4344, longitude: 50.1033 },
    QADOH: { code: "QADOH", name: "Hamad Port / Doha", country: "Qatar", countryCode: "QA", region: "Middle East", latitude: 25.2854, longitude: 51.5310 },
    KWKWI: { code: "KWKWI", name: "Shuwaikh / Kuwait Port", country: "Kuwait", countryCode: "KW", region: "Middle East", latitude: 29.3759, longitude: 47.9774 },
    OMSLL: { code: "OMSLL", name: "Port of Salalah", country: "Oman", countryCode: "OM", region: "Middle East", latitude: 17.0151, longitude: 54.0924 },

    // Asia
    MYPKG: { code: "MYPKG", name: "Port Klang", country: "Malaysia", countryCode: "MY", region: "Asia", latitude: 2.9999, longitude: 101.3928 },
    SGSIN: { code: "SGSIN", name: "Port of Singapore", country: "Singapore", countryCode: "SG", region: "Asia", latitude: 1.2903, longitude: 103.8520 },
    CNSHA: { code: "CNSHA", name: "Port of Shanghai", country: "China", countryCode: "CN", region: "Asia", latitude: 31.2304, longitude: 121.4737 },
    CNNGB: { code: "CNNGB", name: "Port of Ningbo-Zhoushan", country: "China", countryCode: "CN", region: "Asia", latitude: 29.8683, longitude: 121.5440 },
    CNSZX: { code: "CNSZX", name: "Port of Shenzhen", country: "China", countryCode: "CN", region: "Asia", latitude: 22.5431, longitude: 114.0579 },
    HKHKG: { code: "HKHKG", name: "Hong Kong Port", country: "Hong Kong", countryCode: "HK", region: "Asia", latitude: 22.3193, longitude: 114.1694 },
    INNSA: { code: "INNSA", name: "Nhava Sheva (JNPT) Mumbai", country: "India", countryCode: "IN", region: "Asia", latitude: 18.9499, longitude: 72.9515 },
    INMAA: { code: "INMAA", name: "Chennai Port", country: "India", countryCode: "IN", region: "Asia", latitude: 13.0827, longitude: 80.2707 },
    THBKK: { code: "THBKK", name: "Bangkok Port / Laem Chabang", country: "Thailand", countryCode: "TH", region: "Asia", latitude: 13.7563, longitude: 100.5018 },
    VNSGN: { code: "VNSGN", name: "Ho Chi Minh City Port", country: "Vietnam", countryCode: "VN", region: "Asia", latitude: 10.8231, longitude: 106.6297 },
    JPYOK: { code: "JPYOK", name: "Port of Yokohama", country: "Japan", countryCode: "JP", region: "Asia", latitude: 35.4437, longitude: 139.6380 },
    KRPUS: { code: "KRPUS", name: "Port of Busan", country: "South Korea", countryCode: "KR", region: "Asia", latitude: 35.1796, longitude: 129.0756 },

    // Europe
    NLRTM: { code: "NLRTM", name: "Port of Rotterdam", country: "Netherlands", countryCode: "NL", region: "Europe", latitude: 51.9244, longitude: 4.4777 },
    BEANR: { code: "BEANR", name: "Port of Antwerp-Bruges", country: "Belgium", countryCode: "BE", region: "Europe", latitude: 51.2194, longitude: 4.4025 },
    DEHAM: { code: "DEHAM", name: "Port of Hamburg", country: "Germany", countryCode: "DE", region: "Europe", latitude: 53.5511, longitude: 9.9937 },
    GBFXT: { code: "GBFXT", name: "Port of Felixstowe", country: "United Kingdom", countryCode: "GB", region: "Europe", latitude: 51.9634, longitude: 1.3511 },
    GBLON: { code: "GBLON", name: "London Gateway", country: "United Kingdom", countryCode: "GB", region: "Europe", latitude: 51.5074, longitude: -0.1278 },
    ESVLC: { code: "ESVLC", name: "Port of Valencia", country: "Spain", countryCode: "ES", region: "Europe", latitude: 39.4699, longitude: -0.3763 },
    GRPIR: { code: "GRPIR", name: "Port of Piraeus", country: "Greece", countryCode: "GR", region: "Europe", latitude: 37.9430, longitude: 23.6470 },
    ITGOA: { code: "ITGOA", name: "Port of Genoa", country: "Italy", countryCode: "IT", region: "Europe", latitude: 44.4056, longitude: 8.9463 },

    // Americas
    USLAX: { code: "USLAX", name: "Port of Los Angeles", country: "United States", countryCode: "US", region: "Americas", latitude: 33.7432, longitude: -118.2673 },
    USLGB: { code: "USLGB", name: "Port of Long Beach", country: "United States", countryCode: "US", region: "Americas", latitude: 33.7701, longitude: -118.1937 },
    USNYC: { code: "USNYC", name: "Port of New York & New Jersey", country: "United States", countryCode: "US", region: "Americas", latitude: 40.7128, longitude: -74.0060 },
    USHOU: { code: "USHOU", name: "Port of Houston", country: "United States", countryCode: "US", region: "Americas", latitude: 29.7604, longitude: -95.3698 },
    USSAV: { code: "USSAV", name: "Port of Savannah", country: "United States", countryCode: "US", region: "Americas", latitude: 32.0809, longitude: -81.0912 },
    CAVAN: { code: "CAVAN", name: "Port of Vancouver", country: "Canada", countryCode: "CA", region: "Americas", latitude: 49.2827, longitude: -123.1207 },
    BRSSZ: { code: "BRSSZ", name: "Port of Santos", country: "Brazil", countryCode: "BR", region: "Americas", latitude: -23.9618, longitude: -46.3322 },
    PABLB: { code: "PABLB", name: "Port of Balboa", country: "Panama", countryCode: "PA", region: "Americas", latitude: 8.9567, longitude: -79.5667 },

    // Africa & Oceania
    EGPSD: { code: "EGPSD", name: "Port Said (Suez Canal)", country: "Egypt", countryCode: "EG", region: "Africa", latitude: 31.2653, longitude: 32.3019 },
    ZADUR: { code: "ZADUR", name: "Port of Durban", country: "South Africa", countryCode: "ZA", region: "Africa", latitude: -29.8587, longitude: 31.0218 },
    KEMBA: { code: "KEMBA", name: "Port of Mombasa", country: "Kenya", countryCode: "KE", region: "Africa", latitude: -4.0435, longitude: 39.6682 },
    MATNG: { code: "MATNG", name: "Tanger Med", country: "Morocco", countryCode: "MA", region: "Africa", latitude: 35.8858, longitude: -5.5028 },
    AUSYD: { code: "AUSYD", name: "Port Botany / Sydney", country: "Australia", countryCode: "AU", region: "Oceania", latitude: -33.9744, longitude: 151.2183 },
    AUMEL: { code: "AUMEL", name: "Port of Melbourne", country: "Australia", countryCode: "AU", region: "Oceania", latitude: -37.8136, longitude: 144.9631 },
};

/**
 * Calculates Great-Circle Haversine distance between two latitude/longitude points on Earth.
 * Radius of Earth R = 6,371 km.
 */
export const calculateHaversineDistanceKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const rLat1 = (lat1 * Math.PI) / 180;
    const rLat2 = (lat2 * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(rLat1) * Math.cos(rLat2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
};

/**
 * Multiplier based on geodesic route distance tiers:
 * - Short (< 3,000 km): ×1.0
 * - Medium (3,000 km – 8,000 km): ×1.4
 * - Long (> 8,000 km): ×1.8
 */
export const getDistanceMultiplier = (
    distanceKm: number
): { multiplier: number; tier: "SHORT" | "MEDIUM" | "LONG" } => {
    if (distanceKm < 3000) {
        return { multiplier: 1.0, tier: "SHORT" };
    }
    if (distanceKm <= 8000) {
        return { multiplier: 1.4, tier: "MEDIUM" };
    }
    return { multiplier: 1.8, tier: "LONG" };
};

/**
 * Resolves port metadata by UN/LOCODE or port string
 */
export const resolvePortInfo = (portInput: string): PortGeoData => {
    const trimmed = (portInput || "").trim().toUpperCase();

    // Check exact UN/LOCODE
    if (KNOWN_PORTS[trimmed]) {
        return KNOWN_PORTS[trimmed];
    }

    // Try finding by name or code prefix
    const found = Object.values(KNOWN_PORTS).find(
        (p) =>
            p.name.toUpperCase().includes(trimmed) ||
            trimmed.includes(p.code) ||
            trimmed.includes(p.countryCode)
    );

    if (found) {
        return found;
    }

    // Default fallback to Chattogram Port (Asia) or Rotterdam (Europe) based on context
    return {
        code: trimmed.substring(0, 5) || "PORTX",
        name: portInput || "International Terminal",
        country: "International",
        countryCode: "XX",
        region: "Asia",
        latitude: 22.3167,
        longitude: 91.8000,
    };
};

/**
 * Core Geodesic & Multi-Currency Logistics Pricing Engine
 * Computes exact 13-item breakdown in USD with dynamic Frankfurter conversion
 */
export const calculateFreightCost = async (params: {
    origin: string;
    destination: string;
    weightKg: number;
    declaredCargoValueUSD?: number | undefined;
    targetCurrency?: string | undefined;
}): Promise<PricingCalculationResult> => {
    const originPort = resolvePortInfo(params.origin);
    const destinationPort = resolvePortInfo(params.destination);

    const weightKg = Math.max(1, params.weightKg || 1);
    const declaredValue = Math.max(0, params.declaredCargoValueUSD || 0);
    const currency = (params.targetCurrency || "USD").toUpperCase();

    // 1. Calculate Geodesic Haversine Distance
    const distanceKm = calculateHaversineDistanceKm(
        originPort.latitude,
        originPort.longitude,
        destinationPort.latitude,
        destinationPort.longitude
    );

    const { multiplier: distanceMultiplier, tier: distanceTier } = getDistanceMultiplier(distanceKm);

    // 2. Determine Base Rate per Kg from Destination/Origin Region
    const baseRatePerKg =
        REGIONAL_BASE_RATES[destinationPort.region] ??
        REGIONAL_BASE_RATES[originPort.region] ??
        1.5;

    // 3. Check for Pre-negotiated Fixed Route Tariff
    const matchedFixedRoute = FIXED_ROUTE_RATES.find(
        (r) =>
            (r.originCode === originPort.code && r.destinationCode === destinationPort.code) ||
            (r.originCountry === originPort.countryCode &&
                r.destinationCountry === destinationPort.countryCode)
    );

    let oceanFreightUSD = 0;
    let isFixedRoute = false;

    if (matchedFixedRoute) {
        isFixedRoute = true;
        // Fixed base up to 500kg, marginal surcharge above 500kg
        const base = matchedFixedRoute.baseOceanFreightUSD;
        const excessWeight = Math.max(0, weightKg - 500);
        const excessSurcharge = excessWeight * (baseRatePerKg * 0.6);
        oceanFreightUSD = Math.round((base + excessSurcharge) * 100) / 100;
    } else {
        // Variable rate: BaseRatePerKg * Weight * DistanceMultiplier
        oceanFreightUSD = Math.round(baseRatePerKg * weightKg * distanceMultiplier * 100) / 100;
    }

    // 4. Compute Remaining 12 Specialized Logistics Items
    const originHandling = 100.0;
    const bafSurcharge = Math.round(oceanFreightUSD * 0.125 * 100) / 100; // 12.5% Bunker Adjustment Factor
    const thcOrigin = 100.0;
    const thcDestination = 120.0;
    const transshipmentFee = distanceKm > 5000 ? 80.0 : 0.0;
    const customsClearance = 200.0;
    const customsDuty = Math.round(declaredValue * 0.05 * 100) / 100; // 5% Customs Duty
    const vat = Math.round((oceanFreightUSD + customsDuty) * 0.075 * 100) / 100; // 7.5% Port VAT
    const destinationHandling = 180.0;
    const cargoInsurance = Math.round(Math.max(50, declaredValue * 0.005) * 100) / 100; // 0.5% (Min $50)
    const lastMileDelivery = 150.0;

    const subtotal =
        originHandling +
        oceanFreightUSD +
        bafSurcharge +
        thcOrigin +
        thcDestination +
        transshipmentFee +
        customsClearance +
        customsDuty +
        vat +
        destinationHandling +
        cargoInsurance +
        lastMileDelivery;

    const agencyFee = Math.round(subtotal * 0.05 * 100) / 100; // 5% Agent Fee
    const platformFee = Math.round(subtotal * 0.03 * 100) / 100; // 3% Platform Fee

    const totalUSD = Math.round((subtotal + agencyFee + platformFee) * 100) / 100;

    // 5. Dynamic Currency Conversion via Frankfurter.app + Redis
    const conversion = await convertCurrency(totalUSD, currency);

    return {
        distanceKm,
        distanceMultiplier,
        distanceTier,
        isFixedRoute,
        matchedRoute: matchedFixedRoute
            ? `${matchedFixedRoute.originCode} → ${matchedFixedRoute.destinationCode}`
            : undefined,
        originPort: {
            code: originPort.code,
            name: originPort.name,
            region: originPort.region,
        },
        destinationPort: {
            code: destinationPort.code,
            name: destinationPort.name,
            region: destinationPort.region,
        },
        baseRatePerKg,
        weightKg,
        declaredCargoValueUSD: declaredValue,
        breakdown: {
            originHandling,
            oceanFreight: oceanFreightUSD,
            bafSurcharge,
            thcOrigin,
            thcDestination,
            transshipmentFee,
            customsClearance,
            customsDuty,
            vat,
            destinationHandling,
            cargoInsurance,
            lastMileDelivery,
            agencyFee,
            platformFee,
        },
        totalUSD,
        currency: conversion.targetCurrency,
        exchangeRate: conversion.exchangeRate,
        convertedTotal: conversion.convertedAmount,
    };
};
