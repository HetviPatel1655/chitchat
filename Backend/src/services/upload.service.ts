import mongoose, { ClientSession } from "mongoose";
import { APIError } from "../error/apierror";
import { StatusCodes } from "http-status-codes";

export class UploadService {
    async uploadFile(file: Express.Multer.File, session?: ClientSession) {
        try {
            // File is already saved by Multer diskStorage
            // Construct the URL to access it
            // Assuming server runs on port 3000 locally
            const baseUrl = process.env.BASE_URL || "http://localhost:3000";
            const fileUrl = `${baseUrl}/uploads/${file.filename}`;

            return {
                url: fileUrl,
                filename: file.filename,
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size
            };
        } catch (error: any) {
            console.log(error);
            throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
    }
}

export const uploadService = new UploadService();