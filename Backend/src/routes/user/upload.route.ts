import express from "express";
import { UploadController } from "../../controllers/upload.controller";
import { validateJWT } from "../../middlewares/validateJWT";
import { upload } from "../../middlewares/multer.middleware";

const upload_router = express.Router();

upload_router.use(validateJWT);

upload_router.post("/", upload.single("file"), UploadController.uploadFile);

export { upload_router };