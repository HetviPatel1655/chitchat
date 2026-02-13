import { Server, Socket } from "socket.io";
import { verifyJWT } from "../utility/genJWT";
import { UsersModel } from "../models/users.model";
import { ConversationsModel } from "../models/conversations.model";
import { chatservice } from "./chat.service";
import { MsgsModel } from "../models/msgs.model";

// Store active users: userId -> Array of socketIds
const activeUsers = new Map<string, string[]>();

export class SocketService {
    static io: Server;

    static async initializeSocket(io: Server) {
        this.io = io;

        // Middleware to authenticate socket connections
        io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.query.token;

                if (!token) {
                    return next(new Error("Authentication error: No token provided"));
                }

                try {
                    const decoded = verifyJWT(token as string) as { id: string };
                    socket.data.userId = decoded.id;
                    socket.data.user = await UsersModel.findById(decoded.id);
                    next();
                } catch (e) {
                    return next(new Error("Authentication error: Invalid token"));
                }
            } catch (error) {
                next(new Error("Authentication error: Invalid token"));
            }
        });

        // Handle socket connections
        io.on("connection", async (socket: Socket) => {
            const userId = socket.data.userId;
            const username = socket.data.user?.username;

            console.log(`✅ User ${username} (${userId}) connected`);

            // Delta: Mark all pending messages as delivered
            const deliveredMessages = await chatservice.markMessagesAsDelivered(userId);
            deliveredMessages.forEach((msg) => {
                // Notify the SENDER that their message was delivered
                // We need to find the sender's socket
                const senderId = msg.senderId.toString();
                if (activeUsers.has(senderId)) {
                    // Check if sender is online, if so, emit to their personal room
                    // Or just emit to the user's personal room regardless, if they are online they get it
                    io.to(`user_${senderId}`).emit("message_delivered", {
                        messageId: msg._id.toString(),
                        conversationId: msg.conversationId.toString(),
                        isDelivered: true
                    });
                }
            });

            // 1. Join a personal room for targeted notifications (sidebar updates, etc.)
            socket.join(`user_${userId}`);

            // 2. Track active users
            if (!activeUsers.has(userId)) {
                activeUsers.set(userId, []);
            }
            activeUsers.get(userId)!.push(socket.id);

            // 3. Emit online status to everyone
            io.emit("user_online", { userId, username, timestamp: new Date() });

            // 4. Send the list of ALL currently online users to the newly connected socket
            const onlineUserIds = Array.from(activeUsers.keys());
            socket.emit("active_users", { userIds: onlineUserIds });

            // ==================== JOIN CONVERSATION ====================
            socket.on("join_conversation", (data: { conversationId: string }) => {
                socket.join(data.conversationId);
                console.log(`👥 User ${username} joined room: ${data.conversationId}`);
            });

            // ==================== TYPING INDICATOR ====================
            socket.on("typing", (data: { conversationId: string; isTyping: boolean }) => {
                console.log(`⌨️ ${username} typing=${data.isTyping} in room ${data.conversationId}`);
                const room = io.sockets.adapter.rooms.get(data.conversationId);
                console.log(`⌨️ Room ${data.conversationId} has ${room ? room.size : 0} members:`, room ? [...room] : []);
                socket.to(data.conversationId).emit("user_typing", {
                    userId,
                    username,
                    conversationId: data.conversationId,
                    isTyping: data.isTyping
                });
            });

            // ==================== SEND MESSAGE ====================
            socket.on("send_message", async (data: { conversationId: string; content: string; replyToId?: string }, callback) => {
                try {
                    // Check if user is online logic moved after message creation

                    const { conversationId, content, replyToId } = data;
                    if (!content?.trim()) {
                        return callback?.({ success: false, error: "Empty message" });
                    }

                    const message = await chatservice.saveMessage(userId, conversationId, content, replyToId);

                    // Find recipient to notify their sidebar
                    const conversation = await ConversationsModel.findById(conversationId);
                    const recipientId = conversation?.participant1Id.toString() === userId
                        ? conversation?.participant2Id.toString()
                        : conversation?.participant1Id.toString();

                    let status = "sent";
                    if (recipientId && activeUsers.has(recipientId)) {
                        status = "delivered";
                        message.status = "delivered";
                        await message.save();

                        // Notify sender immediately if delivered
                        io.to(`user_${userId}`).emit("message_delivered", {
                            messageId: message._id.toString(),
                            conversationId,
                            isDelivered: true
                        });
                    }

                    // Build reply data if replying to a message
                    let replyTo = null;
                    if (replyToId) {
                        const originalMsg = await MsgsModel.findById(replyToId)
                            .populate("senderId", "username")
                            .lean();
                        if (originalMsg) {
                            replyTo = {
                                _id: (originalMsg._id as any).toString(),
                                content: originalMsg.content,
                                senderId: originalMsg.senderId
                            };
                        }
                    }

                    const payload = {
                        _id: message._id.toString(),
                        conversationId,
                        senderId: userId,
                        senderUsername: username,
                        content: message.content,
                        timestamp: message.timestamp,
                        status: status,
                        ...(replyTo && { replyTo })
                    };

                    // Broadcast to specific conversation room (for active chat)
                    io.to(conversationId).emit("receive_message", payload);

                    // Broadcast to recipient's personal room (for sidebar sync)
                    if (recipientId) {
                        io.to(`user_${recipientId}`).emit("receive_message", payload);
                    }

                    callback?.({ success: true, messageId: message._id.toString() });
                } catch (error) {
                    console.error("Socket send_message error:", error);
                    callback?.({ success: false, error: "Internal error" });
                }
            });

            // ==================== PIN/UNPIN MESSAGE ====================
            socket.on("toggle_pin_message", async (data: { messageId: string }, callback?: Function) => {
                try {
                    const message = await chatservice.togglePinMessage(userId, data.messageId);

                    // Broadcast to conversation room
                    const broadcastData = {
                        messageId: message._id.toString(),
                        conversationId: message.conversationId.toString(),
                        isPinned: message.isPinned
                    };

                    console.log(`Broadcasting message_pinned to room ${message.conversationId.toString()}:`, broadcastData);
                    io.to(message.conversationId.toString()).emit("message_pinned", broadcastData);


                    const callbackResponse = {
                        success: true,
                        data: {
                            // _id: message._id.toString(),
                            // conversationId: message.conversationId.toString(),
                            // senderId: message.senderId.toString(),
                            content: message.content,
                            //status: message.status,
                            isPinned: message.isPinned,
                            // timestamp: message.timestamp
                        }
                    };


                    console.log('[CALLBACK] Sending response:', JSON.stringify(callbackResponse, null, 2));
                    callback?.(callbackResponse);
                } catch (error) {
                    console.error("Socket toggle_pin_message error:", error);
                    callback?.({ success: false, error: error instanceof Error ? error.message : "Failed to toggle pin" });
                }
            });

            // ==================== TYPING ====================
            socket.on("user_typing", (data: { conversationId: string; isTyping: boolean }) => {
                socket.to(data.conversationId).emit("user_typing_status", {
                    userId, username, isTyping: data.isTyping
                });
            });

            // ==================== MARK MESSAGES READ ====================
            socket.on("mark_messages_read", async (data: { conversationId: string; senderId: string }) => {
                try {
                    const readMessages = await chatservice.markMessagesAsRead(userId, data.conversationId);

                    if (readMessages.length > 0) {
                        // Notify the Sender (the person who sent the messages) that they have been read
                        // We can broadcast to the conversation room or specific user
                        // Emitting to conversation room is easier as it covers multiple devices

                        io.to(data.conversationId).emit("message_read", {
                            conversationId: data.conversationId,
                            messageIds: readMessages.map(m => m._id.toString()),
                            readerId: userId
                        });

                        console.log(`✅ Marked ${readMessages.length} messages as read in ${data.conversationId}`);
                    }
                } catch (error) {
                    console.error("Socket mark_messages_read error:", error);
                }
            });

            // ==================== DISCONNECT ====================
            socket.on("disconnect", async () => {
                const userSockets = activeUsers.get(userId);
                if (userSockets) {
                    const index = userSockets.indexOf(socket.id);
                    if (index > -1) userSockets.splice(index, 1);
                    if (userSockets.length === 0) {
                        activeUsers.delete(userId);
                        // Update lastSeen in DB
                        const lastSeen = new Date();
                        await UsersModel.findByIdAndUpdate(userId, { lastSeen });
                        io.emit("user_offline", { userId, username, lastSeen: lastSeen.toISOString() });
                    }
                }
                console.log(`❌ User ${username} disconnected`);
            });
        });
    }

    static isUserOnline(userId: string): boolean {
        return activeUsers.has(userId);
    }
}