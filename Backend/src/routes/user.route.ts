import express from "express";
import { grps_router } from "./user/grps.route";
import { chat_router } from "./user/chat.route";

const user_router = express.Router();

user_router.use("/groups", grps_router);
user_router.use("/chats", chat_router);

export { user_router };

