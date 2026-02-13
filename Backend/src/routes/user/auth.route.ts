import express from "express";
import { registercontroller, logincontroller } from "../../controllers/auth.controller.ts";

const auth_router = express.Router();

auth_router.post("/register", registercontroller);
auth_router.post("/login", logincontroller);

export { auth_router };

