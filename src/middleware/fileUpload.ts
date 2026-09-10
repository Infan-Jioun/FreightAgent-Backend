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
