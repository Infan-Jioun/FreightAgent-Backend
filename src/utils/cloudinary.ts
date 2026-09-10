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

export { cloudinary };
