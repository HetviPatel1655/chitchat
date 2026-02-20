import { Server, Socket } from "socket.io";
import { verifyJWT } from "../utility/genJWT";
import { UsersModel } from "../models/users.model";
import { ConversationsModel } from "../models/conversations.model";
import { chatservice } from "./chat.service";
import { MsgsModel } from "../models/msgs.model";
import { GrpsService } from "./grps.service";
import { GrpsModel } from "../models/groups.model";
import mongoose, { Types } from "mongoose";

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

            //console.log(`✅ User ${username} (${userId}) connected`);

            // Join user-specific room for private notifications (like pin updates)
            socket.join(`user_${userId}`);

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

            // 2. Automatically join all conversation rooms the user is a part of
            const userConversations = await ConversationsModel.find({ participants: userId });
            userConversations.forEach(conv => {
                socket.join(conv._id.toString());
                //  console.log(`📡 User ${username} auto-joined room: ${conv._id}`);
            });

            // 3. Track active users
            if (!activeUsers.has(userId)) {
                activeUsers.set(userId, []);
            }
            activeUsers.get(userId)!.push(socket.id);

            // 4. Emit online status to everyone
            io.emit("user_online", { userId, username, timestamp: new Date() });

            // 5. Send the list of ALL currently online users to the newly connected socket
            const onlineUserIds = Array.from(activeUsers.keys());
            socket.emit("active_users", { userIds: onlineUserIds });

            // ==================== GROUP OPERATIONS ====================

            socket.on("create_group", async (data: { name: string; members: string[] }, callback) => {
                try {
                    const result = await GrpsService.createGroup(userId, data.name, data.members);
                    const conversationId = result.conversationId;

                    // Join the room for the creator
                    socket.join(conversationId);

                    // Notify all online members to join the new room and update their sidebar
                    result.participants.forEach((participantId: Types.ObjectId) => {
                        const pidStr = participantId.toString();
                        io.to(`user_${pidStr}`).emit("group_created", {
                            conversationId,
                            name: data.name,
                            type: "group",
                            ownerId: userId,
                            lastMessage: "Group created",
                            lastMessageTime: new Date()
                        });

                        // If they are online, make their sockets join the new room
                        const memberSockets = activeUsers.get(pidStr);
                        if (memberSockets) {
                            memberSockets.forEach(sid => {
                                const s = io.sockets.sockets.get(sid);
                                s?.join(conversationId);
                            });
                        }
                    });

                    // Broadcast the system message to the new group room
                    const systemPayload = {
                        _id: result.systemMessage._id.toString(),
                        conversationId,
                        senderId: userId,
                        senderUsername: socket.data.user?.username,
                        content: result.systemMessage.content,
                        timestamp: result.systemMessage.timestamp,
                        status: "sent",
                        messageType: "system",
                        type: "group"
                    };

                    io.to(conversationId).emit("receive_message", systemPayload);

                    if (typeof callback === 'function') callback({ success: true, conversationId });
                } catch (error) {
                    console.error("Socket create_group error:", error);
                    if (typeof callback === 'function') callback({ success: false, error: "Failed to create group" });
                }
            });

            socket.on("get_my_groups", async (callback) => {
                try {
                    const groups = await GrpsService.listUserGroups(userId);
                    if (typeof callback === 'function') callback({ success: true, groups });
                } catch (error) {
                    if (typeof callback === 'function') callback({ success: false, error: "Failed to fetch groups" });
                }
            });

            socket.on("add_to_group", async (data: { conversationId: string; userId: string }, callback) => {
                try {
                    const result = await GrpsService.addMember(data.conversationId, data.userId, userId);

                    // 1. Notify the new user to update their sidebar
                    io.to(`user_${data.userId}`).emit("group_created", {
                        conversationId: data.conversationId,
                        name: result.groupName,
                        type: "group",
                        ownerId: userId,
                        lastMessage: result.systemMessage.content,
                        lastMessageTime: result.systemMessage.timestamp
                    });

                    // 2. Make their sockets join the room if online
                    const memberSockets = activeUsers.get(data.userId);
                    if (memberSockets) {
                        memberSockets.forEach(sid => {
                            const s = io.sockets.sockets.get(sid);
                            s?.join(data.conversationId);
                        });
                    }

                    // 3. Broadcast the system message to the entire group
                    const systemPayload = {
                        _id: result.systemMessage._id.toString(),
                        conversationId: data.conversationId,
                        senderId: userId,
                        senderUsername: socket.data.user?.username,
                        content: result.systemMessage.content,
                        timestamp: result.systemMessage.timestamp,
                        status: "sent",
                        messageType: "system",
                        type: "group"
                    };

                    io.to(data.conversationId).emit("receive_message", systemPayload);

                    // 4. Broadcast participant update to the entire group
                    io.to(data.conversationId).emit("member_added", {
                        conversationId: data.conversationId,
                        userId: data.userId
                    });

                    if (typeof callback === 'function') callback({ success: true });
                } catch (error) {
                    console.error("Socket add_to_group error:", error);
                    if (typeof callback === 'function') callback({ success: false, error: error instanceof Error ? error.message : "Failed to add member" });
                }
            });

            socket.on("remove_from_group", async (data: { conversationId: string; userId: string }, callback) => {
                try {
                    const result = await GrpsService.removeMember(data.conversationId, data.userId, userId);

                    // 1. Notify the REMOVED user to update their sidebar (remove the group)
                    io.to(`user_${data.userId}`).emit("removed_from_group", {
                        conversationId: data.conversationId
                    });

                    // 2. Make their sockets leave the room
                    const memberSockets = activeUsers.get(data.userId);
                    if (memberSockets) {
                        memberSockets.forEach(sid => {
                            const s = io.sockets.sockets.get(sid);
                            s?.leave(data.conversationId);
                        });
                    }

                    // 3. Broadcast the system message to the remaining group
                    const systemPayload = {
                        _id: result.systemMessage._id.toString(),
                        conversationId: data.conversationId,
                        senderId: userId,
                        senderUsername: socket.data.user?.username,
                        content: result.systemMessage.content,
                        timestamp: result.systemMessage.timestamp,
                        status: "sent",
                        messageType: "system",
                        type: "group"
                    };

                    io.to(data.conversationId).emit("receive_message", systemPayload);

                    // 4. Broadcast participant update to the entire group
                    io.to(data.conversationId).emit("member_removed", {
                        conversationId: data.conversationId,
                        userId: data.userId
                    });

                    if (typeof callback === 'function') callback({ success: true });
                } catch (error) {
                    console.error("Socket remove_from_group error:", error);
                    if (typeof callback === 'function') callback({ success: false, error: error instanceof Error ? error.message : "Failed to remove member" });
                }
            });

            socket.on("delete_group", async (data: { conversationId: string }, callback) => {
                try {
                    const result = await GrpsService.deleteGroup(data.conversationId, userId);

                    // Notify all participants involved to remove the group from their sidebars
                    result.participantIds.forEach(pid => {
                        io.to(`user_${pid}`).emit("group_deleted", {
                            conversationId: data.conversationId
                        });

                        // Make their sockets leave the room
                        const memberSockets = activeUsers.get(pid);
                        if (memberSockets) {
                            memberSockets.forEach(sid => {
                                const s = io.sockets.sockets.get(sid);
                                s?.leave(data.conversationId);
                            });
                        }
                    });

                    if (typeof callback === 'function') callback({ success: true });
                } catch (error) {
                    console.error("Socket delete_group error:", error);
                    if (typeof callback === 'function') callback({ success: false, error: error instanceof Error ? error.message : "Failed to delete group" });
                }
            });

            // ==================== JOIN CONVERSATION ====================
            socket.on("join_conversation", (data: { conversationId: string }) => {
                socket.join(data.conversationId);
                // console.log(`👥 User ${username} explicitly joined room: ${data.conversationId}`);
            });

            // ==================== TYPING INDICATOR ====================
            socket.on("typing", (data: { conversationId: string; isTyping: boolean }) => {
                //   console.log(`${username} typing=${data.isTyping} in room ${data.conversationId}`);
                const room = io.sockets.adapter.rooms.get(data.conversationId);
                //console.log(`⌨️ Room ${data.conversationId} has ${room ? room.size : 0} members:`, room ? [...room] : []);
                socket.to(data.conversationId).emit("user_typing", {
                    userId,
                    username,
                    conversationId: data.conversationId,
                    isTyping: data.isTyping
                });
            });

            // ==================== SEND MESSAGE ====================
            socket.on("send_message", async (data: { conversationId: string; content: string; replyToId?: string; fileName?: string; fileUrl?: string; fileSize?: number; mimeType?: string; messageType?: string }, callback) => {
                try {
                    const { conversationId, content, replyToId, fileName, fileUrl, fileSize, mimeType, messageType } = data;

                    // Allow empty content IF there is a file attached
                    if (!content?.trim() && !fileUrl) {
                        if (typeof callback === 'function') callback({ success: false, error: "Empty message" });
                        return;
                    }

                    const message = await chatservice.saveMessage(userId, conversationId, content, replyToId, fileName, fileUrl, fileSize, mimeType, messageType);

                    // Find recipient to notify their sidebar
                    const conversation = await ConversationsModel.findById(conversationId);

                    if (!conversation) return;

                    let status = "sent";
                    // For direct chats, we still want to track 'delivered' status for the recipient
                    if (conversation.type === "direct") {
                        const recipientId = conversation.participants.find(p => p.toString() !== userId)?.toString();
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
                        fileName: message.fileName,
                        fileUrl: message.fileUrl,
                        fileSize: message.fileSize,
                        mimeType: message.mimeType,
                        messageType: message.messageType,
                        type: conversation.type,
                        ...(replyTo && { replyTo })
                    };

                    // 1. Broadcast to the conversation room (active viewers)
                    io.to(conversationId).emit("receive_message", payload);

                    // 2. Broadcast to all participants' personal rooms (sidebar sync for offline/inactive users)
                    conversation.participants.forEach(participantId => {
                        const pidStr = participantId.toString();
                        if (pidStr !== userId) {
                            io.to(`user_${pidStr}`).emit("receive_message", payload);
                        }
                    });

                    if (typeof callback === 'function') callback({ success: true, messageId: message._id.toString() });
                } catch (error) {
                    console.error("Socket send_message error:", error);
                    if (typeof callback === 'function') callback({ success: false, error: "Internal error" });
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
                    if (typeof callback === 'function') callback(callbackResponse);
                } catch (error) {
                    console.error("Socket toggle_pin_message error:", error);
                    if (typeof callback === 'function') callback({ success: false, error: error instanceof Error ? error.message : "Failed to toggle pin" });
                }
            });


            // ==================== DELETE MESSAGE ====================
            socket.on("delete_message", async (data: { messageId: string; conversationId: string }, callback) => {
                try {
                    const message = await MsgsModel.findById(data.messageId);

                    if (!message) {
                        if (typeof callback === 'function') callback({ success: false, error: "Message not found" });
                        return;
                    }

                    // Only sender can delete their message
                    if (message.senderId.toString() !== userId) {
                        if (typeof callback === 'function') callback({ success: false, error: "Unauthorized" });
                        return;
                    }

                    // Update message to deleted state
                    message.isDeleted = true;
                    message.content = "This message was deleted";
                    message.fileUrl = "";
                    message.fileName = "";
                    message.fileSize = 0;
                    message.mimeType = "";
                    message.messageType = "regular"; // Reset type

                    await message.save();

                    // Update conversation's last message to reflect deletion
                    const latestMsg = await MsgsModel.findOne({ conversationId: data.conversationId })
                        .sort({ timestamp: -1 })
                        .lean();

                    if (latestMsg) {
                        let previewContent = latestMsg.content || "";
                        if (!previewContent) {
                            if (latestMsg.messageType === 'image') previewContent = '📷 Image';
                            else if (latestMsg.messageType === 'video') previewContent = '🎥 Video';
                            else if (latestMsg.fileName) previewContent = `📄 ${latestMsg.fileName}`;
                            else previewContent = 'File';
                        }

                        await ConversationsModel.findByIdAndUpdate(data.conversationId, {
                            lastMessage: {
                                content: previewContent,
                                senderId: latestMsg.senderId,
                                timestamp: latestMsg.timestamp
                            }
                        });
                    }

                    // Broadcast to conversation room
                    const payload = {
                        messageId: data.messageId,
                        conversationId: data.conversationId,
                        isDeleted: true
                    };

                    io.to(data.conversationId).emit("message_deleted", payload);

                    if (typeof callback === 'function') callback({ success: true, messageId: data.messageId });
                } catch (error) {
                    console.error("Socket delete_message error:", error);
                    if (typeof callback === 'function') callback({ success: false, error: "Failed to delete message" });
                }
            });

            // ==================== DELETE MESSAGE FOR ME ====================
            socket.on("delete_message_for_me", async (data: { messageId: string; conversationId: string }, callback) => {
                try {
                    const message = await MsgsModel.findById(data.messageId);

                    if (!message) {
                        if (typeof callback === 'function') callback({ success: false, error: "Message not found" });
                        return;
                    }

                    // Add user to deletedBy array
                    if (!message.deletedBy) message.deletedBy = [];
                    // Check if already deleted
                    if (message.deletedBy.some(id => id.toString() === userId)) {
                        if (typeof callback === 'function') callback({ success: true, messageId: data.messageId });
                        return;
                    }

                    message.deletedBy.push(new mongoose.Types.ObjectId(userId));
                    await message.save();

                    // Calculate the new latest message for this user for sidebar preview
                    const latestMsg = await MsgsModel.findOne({
                        conversationId: data.conversationId,
                        deletedBy: { $ne: new mongoose.Types.ObjectId(userId) }
                    })
                        .sort({ timestamp: -1 })
                        .lean();

                    let previewContent = "No messages";
                    let previewTime = new Date();

                    if (latestMsg) {
                        previewContent = latestMsg.content || "";
                        if (!previewContent) {
                            if (latestMsg.messageType === 'image') previewContent = '📷 Image';
                            else if (latestMsg.messageType === 'video') previewContent = '🎥 Video';
                            else if (latestMsg.fileName) previewContent = `📄 ${latestMsg.fileName}`;
                            else previewContent = 'File';
                        }
                        previewTime = latestMsg.timestamp;
                    }

                    // Emit only to the user who performed the action 
                    // Use their specific user room instead of socket.id for robustness
                    io.to(`user_${userId}`).emit("conversation_updated", {
                        conversationId: data.conversationId,
                        lastMessage: previewContent,
                        lastMessageTime: previewTime
                    });

                    if (typeof callback === 'function') callback({ success: true, messageId: data.messageId });
                } catch (error) {
                    console.error("Socket delete_message_for_me error:", error);
                    if (typeof callback === 'function') callback({ success: false, error: "Failed to delete message" });
                }
            });

            // ==================== TYPING ====================


            // ==================== MARK MESSAGES READ ====================
            socket.on("mark_messages_read", async (data: { conversationId: string }) => {
                try {
                    const readMessages = await chatservice.markMessagesAsRead(userId, data.conversationId);

                    // Notify the conversation room (including other tabs for this user)
                    // We emit even if readMessages.length === 0 to sync ReadStatus across client tabs
                    io.to(data.conversationId).emit("message_read", {
                        conversationId: data.conversationId,
                        messageIds: readMessages.map(m => m._id.toString()),
                        readerId: userId
                    });

                    if (readMessages.length > 0) {
                        console.log(`✅ Marked ${readMessages.length} messages as read in ${data.conversationId}`);
                    }
                } catch (error) {
                    console.error("Socket mark_messages_read error:", error);
                }
            });

            // ==================== MARK CONVERSATION UNREAD ====================
            socket.on("mark_conversation_unread", async (data: { conversationId: string }, callback) => {
                try {
                    await chatservice.markConversationAsUnread(userId, data.conversationId);

                    // Notify only this user's other sessions/tabs
                    io.to(`user_${userId}`).emit("conversation_unread", {
                        conversationId: data.conversationId
                    });

                    if (typeof callback === 'function') callback({ success: true });
                } catch (error) {
                    console.error("Socket mark_conversation_unread error:", error);
                    if (typeof callback === 'function') callback({ success: false, error: "Failed to mark as unread" });
                }
            });

            // ==================== ADD REACTION ====================
            socket.on("add_reaction", async (data: { messageId: string, emoji: string }, callback) => {
                try {
                    const updatedMessage = await chatservice.toggleReaction(userId, data.messageId, data.emoji);

                    if (updatedMessage) {
                        const payload = {
                            messageId: updatedMessage._id.toString(),
                            conversationId: updatedMessage.conversationId.toString(),
                            reactions: updatedMessage.reactions
                        };

                        io.to(updatedMessage.conversationId.toString()).emit("message_reaction_update", payload);

                        if (typeof callback === 'function') callback({ success: true, data: payload });
                    }
                } catch (error) {
                    console.error("Socket add_reaction error:", error);
                    if (typeof callback === 'function') callback({ success: false, error: "Failed to add reaction" });
                }
            });

            // ==================== TOGGLE CONVERSATION PIN ====================
            socket.on("toggle_conversation_pin", async (data: { conversationId: string }, callback) => {
                try {
                    const result = await chatservice.toggleConversationPin(userId, data.conversationId);

                    // Notify only this user's other sessions/tabs
                    io.to(`user_${userId}`).emit("conversation_pinned", {
                        conversationId: data.conversationId,
                        isPinned: result.isPinned
                    });

                    if (typeof callback === 'function') callback({ success: true, data: result });
                } catch (error) {
                    console.error("Socket toggle_conversation_pin error:", error);
                    if (typeof callback === 'function') callback({ success: false, error: "Failed to toggle pin" });
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
                // console.log(`❌ User ${username} disconnected`);
            });
        });
    }

    static isUserOnline(userId: string): boolean {
        return activeUsers.has(userId);
    }
}