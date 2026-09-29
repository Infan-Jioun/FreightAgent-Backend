import fs from "fs";
import path from "path";
import { envConfig } from "../_config/env";

const INVOICES_DIR = path.resolve(process.cwd(), "uploads", "invoices");
const WITHDRAWALS_DIR = path.resolve(process.cwd(), "uploads", "withdrawals");

// Ensure upload directories exist on module initialization.
// Wrapped in try/catch: Vercel and similar read-only serverless environments
// will throw ENOENT here — the server must still boot; PDF generation will
// fail at write-time with a clear error rather than crashing on startup.
try {
    if (!fs.existsSync(INVOICES_DIR)) {
        fs.mkdirSync(INVOICES_DIR, { recursive: true });
    }
    if (!fs.existsSync(WITHDRAWALS_DIR)) {
        fs.mkdirSync(WITHDRAWALS_DIR, { recursive: true });
    }
} catch {
    // Serverless / read-only filesystem — directories cannot be created at startup.
    // Local PDF storage is unavailable; uploads will be skipped or directed to cloud storage.
}

/**
 * Normalizes backend base URL to avoid duplicate `/api/v1` segments
 */
export const getBaseServerUrl = (): string => {
    const rawUrl = envConfig.BACKEND_URL || "http://localhost:5000";
    return rawUrl.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
};

export interface ISavedInvoicePdf {
    filePath: string;
    fileName: string;
    localUrl: string;
}

/**
 * Persists an invoice PDF to the local storage (uploads/invoices)
 * and returns the direct local streaming URL.
 */
export const saveInvoicePdfLocally = async (
    trackingId: string,
    pdfBuffer: Buffer
): Promise<ISavedInvoicePdf> => {
    const sanitizedTrackingId = trackingId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Invoice_${sanitizedTrackingId}.pdf`;
    const filePath = path.join(INVOICES_DIR, fileName);

    await fs.promises.writeFile(filePath, pdfBuffer);

    const baseUrl = getBaseServerUrl();
    const localUrl = `${baseUrl}/api/v1/payment/invoice-pdf/${trackingId}`;

    return { filePath, fileName, localUrl };
};

/**
 * Resolves local invoice PDF file path if it exists on disk
 */
export const getLocalInvoiceFilePath = (trackingId: string): string | null => {
    const sanitizedTrackingId = trackingId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Invoice_${sanitizedTrackingId}.pdf`;
    const filePath = path.join(INVOICES_DIR, fileName);

    return fs.existsSync(filePath) ? filePath : null;
};

/**
 * Persists a withdrawal slip PDF to local storage (uploads/withdrawals)
 * and returns the direct local streaming URL.
 */
export const saveWithdrawalSlipLocally = async (
    withdrawalNumber: string,
    pdfBuffer: Buffer
): Promise<ISavedInvoicePdf> => {
    const sanitizedNumber = withdrawalNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Voucher_${sanitizedNumber}.pdf`;
    const filePath = path.join(WITHDRAWALS_DIR, fileName);

    await fs.promises.writeFile(filePath, pdfBuffer);

    const baseUrl = getBaseServerUrl();
    const localUrl = `${baseUrl}/api/v1/payment/withdrawal-slip-pdf/${withdrawalNumber}`;

    return { filePath, fileName, localUrl };
};

/**
 * Resolves local withdrawal slip PDF file path if it exists on disk
 */
export const getLocalWithdrawalSlipPath = (withdrawalNumber: string): string | null => {
    const sanitizedNumber = withdrawalNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Voucher_${sanitizedNumber}.pdf`;
    const filePath = path.join(WITHDRAWALS_DIR, fileName);

    return fs.existsSync(filePath) ? filePath : null;
};
