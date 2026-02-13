import "express-async-errors";
import mongoose from "mongoose";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { StartServer } from "./src/utility/StartServer";
import { rootRouter } from "./src/routes/index";
import { SocketService } from "./src/services/socket.service";

const app = express();
const port = 3000;
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true
}));
app.use(express.json());
app.use(rootRouter);

// Initialize Socket.IO
SocketService.initializeSocket(io);

// Make io instance available globally
app.set("io", io);

app.get("/health", (req, res) => {
    const dbconnected = mongoose.connection.readyState === 1;
    res.json({
        server: "running",
        database: dbconnected ? "connected" : "disconnected"
    });
});

StartServer(server, port);