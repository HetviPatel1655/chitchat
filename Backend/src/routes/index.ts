import express from "express";
import { auth_router } from "./user/auth.route";
import { chat_router } from "./user/chat.route";
import { user_router } from "./user/user.route";

export const rootRouter = express.Router();

rootRouter.use("/auth", auth_router);
rootRouter.use("/chat", chat_router);
rootRouter.use("/users", user_router);
