import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from "cloudinary";
import { envConfig } from "../_config/env";
import AppError from "../errorHelper/AppError";
import status from "http-status";

cloudinary.config({
    cloud_name: envConfig.CLOUDINARY_CLOUD_NAME,
    api_key: envConfig.CLOUDINARY_API_KEY,
    api_secret: envConfig.CLOUDINARY_API_SECRET,
    secure: true,
});

export const uploadBufferToCloudinary = async (
    buffer: Buffer,
    folder = "freightagent/avatars"
): Promise<UploadApiResponse> => {
    if (
        !envConfig.CLOUDINARY_CLOUD_NAME ||
        !envConfig.CLOUDINARY_API_KEY ||
        !envConfig.CLOUDINARY_API_SECRET
    ) {
        throw new AppError(
            status.INTERNAL_SERVER_ERROR,
            "Cloudinary credentials are missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file."
        );
    }

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "image",
            },
            (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
                if (error || !result) {
                    return reject(
                        new AppError(
                            status.INTERNAL_SERVER_ERROR,
                            error?.message || "Failed to upload image to Cloudinary"
                        )
                    );
                }
                resolve(result);
            }
        );

        uploadStream.end(buffer);
    });
};

export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error("Failed to delete asset from Cloudinary:", error);
    }
};

export const extractPublicIdFromUrl = (url: string): string | null => {
    try {
        if (!url.includes("res.cloudinary.com")) return null;
        const parts = url.split("/");
        const uploadIndex = parts.indexOf("upload");
        if (uploadIndex === -1) return null;

        // Strip version prefix if present (e.g., v1712345678)
        const relevantParts = parts.slice(uploadIndex + 1);
        if (relevantParts[0]?.startsWith("v")) {
            relevantParts.shift();
        }

        const fullPath = relevantParts.join("/");
        const lastDot = fullPath.lastIndexOf(".");
        return lastDot !== -1 ? fullPath.substring(0, lastDot) : fullPath;
    } catch {
        return null;
    }
};

import { redis } from "../lib/redis";

export const uploadPrivateDocumentToCloudinary = async (
    buffer: Buffer,
    folder = "freightagent/credentials"
): Promise<UploadApiResponse> => {
    if (
        !envConfig.CLOUDINARY_CLOUD_NAME ||
        !envConfig.CLOUDINARY_API_KEY ||
        !envConfig.CLOUDINARY_API_SECRET
    ) {
        throw new AppError(
            status.INTERNAL_SERVER_ERROR,
            "Cloudinary credentials are missing in .env"
        );
    }

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "auto",
                type: "authenticated", // Secure private storage - not public
            },
            (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
                if (error || !result) {
                    return reject(
                        new AppError(
                            status.INTERNAL_SERVER_ERROR,
                            error?.message || "Failed to upload document to Cloudinary"
                        )
                    );
                }
                resolve(result);
            }
        );

        uploadStream.end(buffer);
    });
};

/**
 * Generates an authenticated, time-limited Cloudinary signed URL for private license documents.
 * Employs Redis caching for 50 minutes (3,000s) to prevent redundant signature generation
 * on repetitive admin views, expiring safely ahead of Cloudinary's 60-minute (3,600s) window.
 */
export const getSignedDocumentUrl = async (
    publicId: string,
    expiresInSeconds = 3600
): Promise<string> => {
    if (!publicId) return "";

    const cacheKey = `cloudinary:signed_url:${publicId}`;

    try {
        const cached = await redis.get<string>(cacheKey);
        if (cached) {
            return cached;
        }
    } catch (err) {
        console.warn("[Cloudinary] Redis cache check failed, generating fresh URL:", err);
    }

    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signedUrl = cloudinary.url(publicId, {
        sign_url: true,
        type: "authenticated",
        secure: true,
        expires_at: expiresAt,
    });

    try {
        // Cache for 50 minutes (3,000 seconds)
        await redis.set(cacheKey, signedUrl, { ex: 50 * 60 });
    } catch (err) {
        console.warn("[Cloudinary] Failed to cache signed URL in Redis:", err);
    }

    return signedUrl;
};

export const invalidateSignedDocumentUrlCache = async (publicId: string): Promise<void> => {
    try {
        await redis.del(`cloudinary:signed_url:${publicId}`);
    } catch (err) {
        console.error("[Cloudinary] Failed to invalidate signed URL cache:", err);
    }
};

export const uploadPdfToCloudinary = async (
    buffer: Buffer,
    fileName: string,
    folder = "freightagent/invoices"
): Promise<string> => {
    if (
        !envConfig.CLOUDINARY_CLOUD_NAME ||
        !envConfig.CLOUDINARY_API_KEY ||
        !envConfig.CLOUDINARY_API_SECRET
    ) {
        throw new AppError(
            status.INTERNAL_SERVER_ERROR,
            "Cloudinary credentials are missing in .env"
        );
    }

    const cleanName = fileName.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_");

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "auto",
                format: "pdf",
                public_id: `${cleanName}_${Date.now()}`,
                flags: "attachment:false",
            },
            (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
                if (error || !result) {
                    return reject(
                        new AppError(
                            status.INTERNAL_SERVER_ERROR,
                            error?.message || "Failed to upload PDF document to Cloudinary"
                        )
                    );
                }

                // Generate signed Cloudinary URL with cryptographic signature to bypass PDF restriction
                try {
                    const signedUrl = cloudinary.url(result.public_id, {
                        resource_type: result.resource_type || "image",
                        format: "pdf",
                        sign_url: true,
                        secure: true,
                    });
                    if (signedUrl) {
                        return resolve(signedUrl);
                    }
                } catch {
                    // fallback to secure_url if signing throws
                }

                let url = result.secure_url;
                if (!url.endsWith(".pdf")) {
                    url = url + ".pdf";
                }
                resolve(url);
            }
        );

        uploadStream.end(buffer);
    });
};

export { cloudinary };

