import multer from "multer";
import path from "path";
import fs from "fs";
import { Request } from "../types/request.types";
import { MulterFile } from "../types/custom-multer";

// Ensure upload directory exists
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req: any, file: any, cb: any) => {
        // Using 'any' for callback params to avoid strict type mismatch with multer internals
        cb(null, uploadDir);
    },
    filename: (req: any, file: any, cb: any) => {
        const username = req.authUser?.username || req.userId || "anonymous";
        const sanitizedUsername = username.toString().replace(/[^a-zA-Z0-9]/g, "_");
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${sanitizedUsername}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

export const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});
