import multer from "multer";
import AppError from "../errorHelper/AppError";
import status from "http-status";

const storage = multer.memoryStorage();

export const uploadSingleImage = (fieldName = "image") => {
    return multer({
        storage,
        limits: {
            fileSize: 5 * 1024 * 1024, // 5 MB limit
        },
        fileFilter: (_req, file, cb) => {
            const allowedMimeTypes = [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/jpg",
            ];

            if (!allowedMimeTypes.includes(file.mimetype)) {
                return cb(
                    new AppError(
                        status.BAD_REQUEST,
                        "Only image files (.jpeg, .png, .webp, .jpg) up to 5MB are allowed"
                    )
                );
            }

            cb(null, true);
        },
    }).single(fieldName);
};

export const uploadChatAttachment = (fieldName = "file") => {
    return multer({
        storage,
        limits: {
            fileSize: 10 * 1024 * 1024, // 10 MB limit
        },
        fileFilter: (_req, file, cb) => {
            const allowedMimeTypes = [
                // Images
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/jpg",
                "image/gif",
                "image/svg+xml",
                // Documents & PDFs
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "text/plain",
                "text/csv",
                "application/zip",
                "application/x-zip-compressed",
            ];

            if (!allowedMimeTypes.includes(file.mimetype)) {
                return cb(
                    new AppError(
                        status.BAD_REQUEST,
                        "Unsupported file format. Please upload standard document or image files (PDF, DOCX, XLSX, TXT, CSV, JPG, PNG, WEBP) up to 10MB."
                    )
                );
            }

            cb(null, true);
        },
    }).single(fieldName);
};

