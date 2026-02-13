import mongoose, { ClientSession } from "mongoose";
import type { IUsers } from "../types/model.types";
import { UsersModel } from "../models/users.model";
import { ConversationsModel } from "../models/conversations.model";
import { MsgsModel } from "../models/msgs.model";
import { APIError } from "../error/apierror";
import { StatusCodes } from "http-status-codes";

export class chatservice {

    // Start or get direct chat conversation
    static async startDirectChat(senderId: string, receiverUsername: string) {
        try {
            // Find receiver by username
            const receiver = await UsersModel.findOne({ username: receiverUsername });
            if (!receiver) {
                throw new APIError(StatusCodes.NOT_FOUND, "Receiver user not found");
            }

            // Prevent user from messaging themselves
            if (senderId === receiver._id.toString()) {
                throw new APIError(StatusCodes.BAD_REQUEST, "Cannot start conversation with yourself");
            }

            // Ensure consistent ordering (smaller ID first)
            const participant1Id = senderId < receiver._id.toString() ? senderId : receiver._id.toString();
            const participant2Id = senderId < receiver._id.toString() ? receiver._id.toString() : senderId;

            // Check if conversation already exists
            let conversation = await ConversationsModel.findOne({
                participant1Id,
                participant2Id,
                type: "direct"
            });

            // If not, create new conversation
            if (!conversation) {
                conversation = await ConversationsModel.create({
                    participant1Id,
                    participant2Id,
                    type: "direct",
                    lastMessage: null
                });
            }

            return {
                conversationId: conversation._id.toString(),
                otherUser: {
                    _id: receiver._id.toString(),
                    username: receiver.username,
                    email: receiver.email
                },
                lastMessage: conversation.lastMessage?.content || "No messages yet",
                lastMessageTime: conversation.lastMessage?.timestamp || conversation.createdAt || new Date()
            };
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                error instanceof Error ? error.message : "Failed to start direct chat"
            );
        }
    }

    // Save message to database
    static async saveMessage(
        senderId: string,
        conversationId: string,
        content: string,
        replyToId?: string
    ) {
        try {
            // Verify conversation exists and user is participant
            const conversation = await ConversationsModel.findById(conversationId);
            if (!conversation) {
                throw new APIError(StatusCodes.NOT_FOUND, "Conversation not found");
            }

            const isParticipant =
                conversation.participant1Id.toString() === senderId ||
                conversation.participant2Id.toString() === senderId;

            if (!isParticipant) {
                throw new APIError(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
            }

            console.log(`Saving message: from ${senderId} to conv ${conversationId}. Content: "${content.substring(0, 20)}..."`);
            // Save message
            const message = await MsgsModel.create({
                conversationId,
                senderId,
                content,
                status: "sent",
                ...(replyToId && { replyToId })
            });

            // Update conversation's last message
            await ConversationsModel.findByIdAndUpdate(conversationId, {
                lastMessage: {
                    content,
                    senderId,
                    timestamp: new Date()
                }
            });
            console.log(`✅ Message saved successfully. ID: ${message._id}. Collection: ${MsgsModel.collection.name}`);

            return message;
        } catch (error) {
            console.log("Error saving message", error);
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                error instanceof Error ? error.message : "Failed to save message"
            );
        }
    }

    // Get messages with pagination
    static async getMessages(
        userId: string,
        conversationId: string,
        page: number = 1,
        limit: number = 20
    ) {
        try {
            // Verify user is participant
            const conversation = await ConversationsModel.findById(conversationId);
            if (!conversation) {
                throw new APIError(StatusCodes.NOT_FOUND, "Conversation not found");
            }

            const isParticipant =
                conversation.participant1Id.toString() === userId ||
                conversation.participant2Id.toString() === userId;

            if (!isParticipant) {
                throw new APIError(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
            }

            // Get messages
            console.log(`Fetching messages for conv: ${conversationId}, user: ${userId}`);
            const skip = (page - 1) * limit;
            const messages = await MsgsModel.find({
                conversationId: new mongoose.Types.ObjectId(conversationId)
            })
                .populate("senderId", "username email")
                .populate({
                    path: "replyToId",
                    select: "content senderId",
                    populate: { path: "senderId", select: "username" }
                })
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            console.log(`Found ${messages.length} messages for conv ${conversationId}`);
            const totalMessages = await MsgsModel.countDocuments({ conversationId });
            console.log(`Total messages in DB for this conv: ${totalMessages}`);

            return {
                messages: messages.reverse(),
                totalMessages,
                currentPage: page,
                totalPages: Math.ceil(totalMessages / limit)
            };
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                error instanceof Error ? error.message : "Failed to get messages"
            );
        }
    }

    // Get all conversations for a user
    static async getConversations(userId: string) {
        try {
            const conversations = await ConversationsModel.find({
                $or: [
                    { participant1Id: userId },
                    { participant2Id: userId }
                ]
            })
                .populate("participant1Id", "username email lastSeen")
                .populate("participant2Id", "username email lastSeen")
                .sort({ "lastMessage.timestamp": -1 })
                .lean();

            return conversations.map(conv => {
                const p1 = conv.participant1Id as any;
                const p2 = conv.participant2Id as any;

                const isP1Me = p1._id.toString() === userId.toString();
                console.log(`Debug GetConversations: Me=${userId}, P1=${p1._id}, match=${isP1Me}`);

                return {
                    conversationId: conv._id,
                    otherUser: isP1Me ? p2 : p1,
                    lastMessage: conv.lastMessage?.content || "No messages yet",
                    lastMessageTime: conv.lastMessage?.timestamp || conv.createdAt
                };
            });
        } catch (error) {
            throw new APIError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                error instanceof Error ? error.message : "Failed to get conversations"
            );
        }
    }

    // Toggle pin status of a message
    static async togglePinMessage(userId: string, messageId: string) {
        try {
            console.log(`🔍 Attempting to toggle pin for message ID: ${messageId}`);
            console.log(`🔍 Message ID type: ${typeof messageId}, length: ${messageId.length}`);
            const message = await MsgsModel.findById(messageId);
            console.log(`🔍 Message found:`, message ? `Yes (ID: ${message._id})` : 'No');
            if (!message) {
                throw new APIError(StatusCodes.NOT_FOUND, "Message not found");
            }

            // Verify conversation and user participation
            const conversation = await ConversationsModel.findById(message.conversationId);
            if (!conversation) {
                throw new APIError(StatusCodes.NOT_FOUND, "Conversation not found");
            }

            const isParticipant =
                conversation.participant1Id.toString() === userId ||
                conversation.participant2Id.toString() === userId;

            if (!isParticipant) {
                throw new APIError(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
            }

            // Toggle pin
            message.isPinned = !message.isPinned;
            await message.save();
            console.log(`✅ Message pinned successfully. ID: ${message._id}. Pinned: ${message.isPinned}`);

            return message;
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                error instanceof Error ? error.message : "Failed to toggle pin"
            );
        }
    }

    // Mark all pending messages for a user as delivered
    static async markMessagesAsDelivered(userId: string) {
        try {
            // 1. Find all conversations where user is a participant
            const conversations = await ConversationsModel.find({
                $or: [{ participant1Id: userId }, { participant2Id: userId }]
            }).select('_id');

            const conversationIds = conversations.map(c => c._id);

            // 2. Find all 'sent' messages in these conversations that were NOT sent by the user
            const query = {
                conversationId: { $in: conversationIds },
                senderId: { $ne: userId },
                status: "sent"
            };

            // 3. Update them to 'delivered'
            const messages = await MsgsModel.find(query);

            if (messages.length > 0) {
                await MsgsModel.updateMany(query, { status: "delivered" });
                console.log(`Updated ${messages.length} messages to delivered for user ${userId}`);
            }

            return messages;
        } catch (error) {
            console.error("Error marking messages as delivered:", error);
            return [];
        }
    }

    // Mark messages in a conversation as read
    static async markMessagesAsRead(userId: string, conversationId: string) {
        try {
            const query = {
                conversationId,
                senderId: { $ne: userId }, // Messages sent by OTHER user
                status: { $ne: "read" }    // Not already read
            };

            const messages = await MsgsModel.find(query);

            if (messages.length > 0) {
                await MsgsModel.updateMany(query, { status: "read" });
                console.log(`Updated ${messages.length} messages to read in conv ${conversationId} for user ${userId}`);
            }

            return messages;
        } catch (error) {
            console.error("Error marking messages as read:", error);
            return [];
        }
    }
}