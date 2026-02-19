import express from "express";
import { startDirectMessage, getMessages, getConversations } from "../../controllers/chat.controller";
import { validateJWT } from "../../middlewares/validateJWT";
import { upload_router } from "../../routes/user/upload.route";

const chat_router = express.Router();

// Apply auth middleware to all routes
chat_router.use(validateJWT);

// Start direct conversation
chat_router.post("/start-direct-message", startDirectMessage);

// Get messages from a conversation
chat_router.get("/messages/:conversationId", getMessages);

// Get all conversations for current user
chat_router.get("/conversations", getConversations);

// Upload file
// File Upload Routes
chat_router.use("/upload", upload_router);



// NOTE: Pin/unpin is handled via WebSocket events (toggle_pin_message)
// No HTTP endpoint needed for real-time events

export { chat_router };