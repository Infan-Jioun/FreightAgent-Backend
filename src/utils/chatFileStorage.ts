import fs from "fs";
import path from "path";
import crypto from "crypto";
import AppError from "../errorHelper/AppError";
import status from "http-status";
import { envConfig } from "../_config/env";
import { getBaseServerUrl } from "./invoiceStorage";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "chat");

// Ensure upload directory exists on module initialization.
// Wrapped in try/catch: Vercel's /var/task filesystem is read-only —
// the server must still boot even if directory creation fails.
try {
    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
} catch {
    // Serverless / read-only filesystem — local file storage is unavailable.
}

export interface ISavedChatFile {
    url: string;
    fileName: string;
    originalName: string;
    fileSize: number;
    mimeType: string;
}

/**
 * Persists an uploaded chat attachment (PDF, image, manifest) up to 10MB to the local backend storage.
 * Generates an unguessable cryptographically randomized filename and returns a direct streaming URL.
 */
export const saveChatFileLocally = async (
    file: Express.Multer.File
): Promise<ISavedChatFile> => {
    if (!file || !file.buffer) {
        throw new AppError(status.BAD_REQUEST, "No file provided for upload");
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB strict limit
    if (file.size > MAX_SIZE) {
        throw new AppError(
            status.BAD_REQUEST,
            "File size exceeds maximum allowed limit of 10MB"
        );
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedBase = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 40);

    const randomSuffix = crypto.randomBytes(6).toString("hex");
    const uniqueFileName = `${Date.now()}_${randomSuffix}_${sanitizedBase}${ext}`;
    const destinationPath = path.join(UPLOADS_DIR, uniqueFileName);

    await fs.promises.writeFile(destinationPath, file.buffer);

    const baseUrl = getBaseServerUrl();
    const fileUrl = `${baseUrl}/api/v1/chat/files/${uniqueFileName}`;

    return {
        url: fileUrl,
        fileName: uniqueFileName,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
    };
};

/**
 * Resolves the absolute path of a chat file while strictly preventing directory traversal attacks.
 */
export const getChatFilePath = (fileName: string): string => {
    // Strip any directory traversal patterns
    const safeFileName = path.basename(fileName);
    const resolvedPath = path.join(UPLOADS_DIR, safeFileName);

    if (!fs.existsSync(resolvedPath)) {
        throw new AppError(status.NOT_FOUND, "Requested file was not found on the server");
    }

    return resolvedPath;
};
