import fs from "fs";
import os from "os";
import path from "path";
import { envConfig } from "../_config/env";

const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// On serverless read-only filesystems (Vercel, AWS Lambda), write to os.tmpdir()
const BASE_UPLOADS_DIR = isServerless
    ? path.join(os.tmpdir(), "uploads")
    : path.resolve(process.cwd(), "uploads");

const INVOICES_DIR = path.join(BASE_UPLOADS_DIR, "invoices");
const WITHDRAWALS_DIR = path.join(BASE_UPLOADS_DIR, "withdrawals");

// Ensure upload directories exist on module initialization
try {
    if (!fs.existsSync(INVOICES_DIR)) {
        fs.mkdirSync(INVOICES_DIR, { recursive: true });
    }
    if (!fs.existsSync(WITHDRAWALS_DIR)) {
        fs.mkdirSync(WITHDRAWALS_DIR, { recursive: true });
    }
} catch {
    // Graceful fallback for strict read-only environments
}

/**
 * Normalizes backend base URL to avoid duplicate `/api/v1` segments
 * and dynamically resolves the deployed production host (Vercel, Render, Railway, etc.)
 * to prevent leaking localhost:5000 in deployed production environments.
 */
export const getBaseServerUrl = (reqHostOrUrl?: string): string => {
    // 1. If an explicit host/url string was passed (e.g. from an Express request)
    if (reqHostOrUrl && typeof reqHostOrUrl === "string" && reqHostOrUrl.trim()) {
        const cleanReq = reqHostOrUrl.trim();
        const fullUrl = cleanReq.startsWith("http") ? cleanReq : `https://${cleanReq}`;
        return fullUrl.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
    }

    const envBackendUrl = (envConfig?.BACKEND_URL || process.env.BACKEND_URL || "").trim();
    const isProduction = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

    // 2. If BACKEND_URL is explicitly set and points to an external/production domain (not localhost)
    if (envBackendUrl && !envBackendUrl.includes("localhost") && !envBackendUrl.includes("127.0.0.1")) {
        return envBackendUrl.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
    }

    // 3. Dynamic cloud platform detection
    // Vercel production custom domain or project production URL
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, "")}`;
    }

    // Vercel automatic deployment URL
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
    }

    // Render external URL
    if (process.env.RENDER_EXTERNAL_URL) {
        return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
    }

    // Railway public domain
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        return `https://${process.env.RAILWAY_PUBLIC_DOMAIN.replace(/\/$/, "")}`;
    }

    // 4. If in production/Vercel and BACKEND_URL was accidentally left as localhost or missing,
    // fallback to known production backend deployment rather than local5000
    if (isProduction) {
        return "https://freight-agent-backend.vercel.app";
    }

    // 5. Local development fallback
    if (envBackendUrl) {
        return envBackendUrl.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
    }

    return "http://localhost:5000";
};

/**
 * Resolves a shipment's invoice PDF URL to a valid streaming URL.
 * Preserves external cloud storage URLs (Cloudinary/S3), while guaranteeing
 * that internal endpoint URLs always point to the active backend domain
 * rather than hardcoded localhost:5000.
 */
export const resolveInvoiceUrl = (
    trackingId: string,
    existingUrl?: string | null,
    reqHostOrUrl?: string
): string => {
    if (!existingUrl) {
        const baseUrl = getBaseServerUrl(reqHostOrUrl);
        const sanitizedTrackingId = trackingId.replace(/[^a-zA-Z0-9_-]/g, "_");
        return `${baseUrl}/api/v1/payment/invoice-pdf/${sanitizedTrackingId}`;
    }

    // If already a Cloudinary or S3 hosted PDF, keep intact
    if (
        existingUrl.includes("res.cloudinary.com") ||
        existingUrl.includes("cloudinary.com") ||
        existingUrl.includes("amazonaws.com")
    ) {
        return existingUrl;
    }

    // If it's an internal invoice PDF route (or contaminated with localhost:5000 / duplicate api segments)
    const baseUrl = getBaseServerUrl(reqHostOrUrl);
    const sanitizedTrackingId = trackingId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${baseUrl}/api/v1/payment/invoice-pdf/${sanitizedTrackingId}`;
};

/**
 * Resolves an agent withdrawal slip PDF URL to a valid streaming URL.
 * Preserves external cloud storage URLs, while guaranteeing internal endpoint
 * URLs always point to the active backend domain.
 */
export const resolveWithdrawalSlipUrl = (
    withdrawalNumber: string,
    existingUrl?: string | null,
    reqHostOrUrl?: string
): string => {
    if (!existingUrl) {
        const baseUrl = getBaseServerUrl(reqHostOrUrl);
        const sanitizedNumber = withdrawalNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
        return `${baseUrl}/api/v1/payment/withdrawal-slip-pdf/${sanitizedNumber}`;
    }

    if (
        existingUrl.includes("res.cloudinary.com") ||
        existingUrl.includes("cloudinary.com") ||
        existingUrl.includes("amazonaws.com")
    ) {
        return existingUrl;
    }

    const baseUrl = getBaseServerUrl(reqHostOrUrl);
    const sanitizedNumber = withdrawalNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${baseUrl}/api/v1/payment/withdrawal-slip-pdf/${sanitizedNumber}`;
};

export interface ISavedInvoicePdf {
    filePath: string;
    fileName: string;
    localUrl: string;
}

/**
 * Persists an invoice PDF to local storage (or /tmp on serverless)
 * and returns the direct local streaming URL.
 */
export const saveInvoicePdfLocally = async (
    trackingId: string,
    pdfBuffer: Buffer,
    reqHostOrUrl?: string
): Promise<ISavedInvoicePdf> => {
    const sanitizedTrackingId = trackingId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Invoice_${sanitizedTrackingId}.pdf`;
    const filePath = path.join(INVOICES_DIR, fileName);

    try {
        if (!fs.existsSync(INVOICES_DIR)) {
            await fs.promises.mkdir(INVOICES_DIR, { recursive: true });
        }
        await fs.promises.writeFile(filePath, pdfBuffer);
    } catch (err) {
        console.warn(`[InvoiceStorage] Local cache write skipped or failed (${filePath}):`, err);
    }

    const localUrl = resolveInvoiceUrl(trackingId, null, reqHostOrUrl);
    return { filePath, fileName, localUrl };
};

/**
 * Resolves local invoice PDF file path if it exists on disk
 */
export const getLocalInvoiceFilePath = (trackingId: string): string | null => {
    const sanitizedTrackingId = trackingId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Invoice_${sanitizedTrackingId}.pdf`;

    // Check primary location
    const filePath = path.join(INVOICES_DIR, fileName);
    if (fs.existsSync(filePath)) {
        return filePath;
    }

    // Check secondary fallback location (cwd uploads if running serverless)
    const fallbackPath = path.resolve(process.cwd(), "uploads", "invoices", fileName);
    if (fs.existsSync(fallbackPath)) {
        return fallbackPath;
    }

    return null;
};

/**
 * Persists a withdrawal slip PDF to local storage (or /tmp on serverless)
 * and returns the direct local streaming URL.
 */
export const saveWithdrawalSlipLocally = async (
    withdrawalNumber: string,
    pdfBuffer: Buffer,
    reqHostOrUrl?: string
): Promise<ISavedInvoicePdf> => {
    const sanitizedNumber = withdrawalNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Voucher_${sanitizedNumber}.pdf`;
    const filePath = path.join(WITHDRAWALS_DIR, fileName);

    try {
        if (!fs.existsSync(WITHDRAWALS_DIR)) {
            await fs.promises.mkdir(WITHDRAWALS_DIR, { recursive: true });
        }
        await fs.promises.writeFile(filePath, pdfBuffer);
    } catch (err) {
        console.warn(`[InvoiceStorage] Local voucher write skipped or failed (${filePath}):`, err);
    }

    const localUrl = resolveWithdrawalSlipUrl(withdrawalNumber, null, reqHostOrUrl);
    return { filePath, fileName, localUrl };
};

/**
 * Resolves local withdrawal slip PDF file path if it exists on disk
 */
export const getLocalWithdrawalSlipPath = (withdrawalNumber: string): string | null => {
    const sanitizedNumber = withdrawalNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Voucher_${sanitizedNumber}.pdf`;

    const filePath = path.join(WITHDRAWALS_DIR, fileName);
    if (fs.existsSync(filePath)) {
        return filePath;
    }

    const fallbackPath = path.resolve(process.cwd(), "uploads", "withdrawals", fileName);
    if (fs.existsSync(fallbackPath)) {
        return fallbackPath;
    }

    return null;
};
