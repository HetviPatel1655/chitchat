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

const path = require("path");

const app = express();
const port = 3000;
const server = http.createServer(app);

app.use(cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
    exposedHeaders: ["set-cookie"]
}));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));


app.use(rootRouter);

app.all("*", (req, res) => {
    console.log("Route not found");
    res.status(404).json({ message: "Route not found" });
});

const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

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