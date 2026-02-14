import express from "express";
import { searchUsersController } from "../../controllers/user.controller";
import { validateJWT } from "../../middlewares/validateJWT";

const user_router = express.Router();

user_router.use(validateJWT);

user_router.get("/search", searchUsersController);

export { user_router };
