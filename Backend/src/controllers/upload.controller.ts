import { StatusCodes } from "http-status-codes";
import { Response } from "express";
import { Request } from "../types/request.types";
import { APIError } from "../error/apierror";
import { uploadService } from "../services/upload.service";

export class UploadController {

    static async uploadFile(req: Request, res: Response) {
        try {
            const file = req.file;
            if (!file) {
                throw new APIError(StatusCodes.BAD_REQUEST, "File is required");
            }
            const result = await uploadService.uploadFile(file);
            res.status(StatusCodes.OK).json({
                success: true,
                data: result
            });
        } catch (error: any) {
            console.log(error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "File upload failed",
                error: error.message || error
            });
        }
    }

}