import axios from "axios";
import { redis } from "../lib/redis";

export interface ExchangeRates {
    [currency: string]: number;
}

export interface CurrencyConversionResult {
    amountInUSD: number;
    convertedAmount: number;
    targetCurrency: string;
    exchangeRate: number;
    source: "live_cache" | "live_api" | "stale_cache" | "hardcoded_fallback";
}

// Emergency regional fallback rates (USD base) including pegged and non-ECB currencies
export const FALLBACK_RATES: ExchangeRates = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.78,
    BDT: 121.5, // Bangladesh Taka
    AED: 3.67,  // UAE Dirham (pegged to USD)
    SAR: 3.75,  // Saudi Riyal (pegged to USD)
    MYR: 4.45,  // Malaysian Ringgit
    SGD: 1.34,  // Singapore Dollar
    CNY: 7.24,  // Chinese Yuan
    INR: 86.5,  // Indian Rupee
    CAD: 1.39,  // Canadian Dollar
    AUD: 1.54,  // Australian Dollar
    JPY: 153.2, // Japanese Yen
};

const REDIS_KEY_LIVE = "exchange_rates:USD";
const REDIS_KEY_STALE = "exchange_rates:USD:stale";
const CACHE_TTL_SECONDS = 3600; // 1 hour
const STALE_TTL_SECONDS = 30 * 24 * 3600; // 30 days

/**
 * Retrieves exchange rates with USD as the base currency.
 * Priority order:
 * 1. Redis 1-hour active cache
 * 2. Frankfurter.app live API
 * 3. Redis stale cache (fallback if API is temporarily down)
 * 4. Hardcoded verified logistics rate table (emergency fallback)
 */
export const getExchangeRates = async (): Promise<{
    rates: ExchangeRates;
    source: "live_cache" | "live_api" | "stale_cache" | "hardcoded_fallback";
}> => {
    // 1. Check Redis 1-hour active cache
    try {
        const cached = await redis.get(REDIS_KEY_LIVE);
        if (cached) {
            const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
            return { rates: parsed as ExchangeRates, source: "live_cache" };
        }
    } catch (err) {
        console.warn("[ExchangeRate] Redis read error for live rates:", err);
    }

    // 2. Fetch from Frankfurter.app API
    try {
        const response = await axios.get("https://api.frankfurter.app/latest?from=USD", {
            timeout: 5000,
        });

        if (response.data && response.data.rates) {
            // Merge with pegged and regional currencies that Frankfurter (ECB-based) doesn't track directly
            const mergedRates: ExchangeRates = {
                ...FALLBACK_RATES,
                ...response.data.rates,
                USD: 1.0,
            };

            // Cache for 1 hour in Redis and update 30-day stale fallback
            try {
                await redis.set(REDIS_KEY_LIVE, JSON.stringify(mergedRates), {
                    ex: CACHE_TTL_SECONDS,
                });
                await redis.set(REDIS_KEY_STALE, JSON.stringify(mergedRates), {
                    ex: STALE_TTL_SECONDS,
                });
            } catch (cacheErr) {
                console.warn("[ExchangeRate] Failed to cache exchange rates in Redis:", cacheErr);
            }

            return { rates: mergedRates, source: "live_api" };
        }
    } catch (apiErr: any) {
        console.warn(
            `[ExchangeRate] Frankfurter.app API failed (${apiErr.message}). Attempting stale cache fallback.`
        );
    }

    // 3. Fallback to Redis stale cache
    try {
        const stale = await redis.get(REDIS_KEY_STALE);
        if (stale) {
            const parsed = typeof stale === "string" ? JSON.parse(stale) : stale;
            console.info("[ExchangeRate] Serving rates from Redis stale cache.");
            return { rates: parsed as ExchangeRates, source: "stale_cache" };
        }
    } catch (staleErr) {
        console.warn("[ExchangeRate] Redis read error for stale rates:", staleErr);
    }

    // 4. Emergency hardcoded fallback
    console.warn("[ExchangeRate] Serving rates from emergency hardcoded fallback.");
    return { rates: FALLBACK_RATES, source: "hardcoded_fallback" };
};

/**
 * Converts a USD amount to the requested target currency using live or cached rates.
 */
export const convertCurrency = async (
    amountInUSD: number,
    targetCurrency = "USD"
): Promise<CurrencyConversionResult> => {
    const upperCurrency = targetCurrency.toUpperCase();
    const { rates, source } = await getExchangeRates();

    const rate = rates[upperCurrency] ?? 1.0;
    const convertedAmount = Math.round(amountInUSD * rate * 100) / 100;

    return {
        amountInUSD,
        convertedAmount,
        targetCurrency: upperCurrency,
        exchangeRate: rate,
        source,
    };
};
