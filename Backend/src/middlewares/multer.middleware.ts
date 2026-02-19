import multer from "multer";
import path from "path";
import fs from "fs";
import { Request } from "../types/request.types";

// Ensure upload directory exists
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb: any) => {
        cb(null, uploadDir);
    },
    filename: (req: Request, file: Express.Multer.File, cb: any) => {
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
