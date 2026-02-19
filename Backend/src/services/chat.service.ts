import mongoose, { ClientSession } from "mongoose";
import type { IUsers } from "../types/model.types";
import { UsersModel } from "../models/users.model";
import { ConversationsModel } from "../models/conversations.model";
import { MsgsModel } from "../models/msgs.model";
import { GrpsModel } from "../models/groups.model";
import { ReadStatusModel } from "../models/readStatus.model";
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
                    participants: [new mongoose.Types.ObjectId(participant1Id), new mongoose.Types.ObjectId(participant2Id)],
                    type: "direct",
                    lastMessage: null
                });
            } else if (!conversation.participants || conversation.participants.length === 0) {
                // Migration: update existing conversation with participants array
                conversation.participants = [new mongoose.Types.ObjectId(participant1Id), new mongoose.Types.ObjectId(participant2Id)];
                await conversation.save();
            }

            return {
                conversationId: conversation._id.toString(),
                type: "direct",
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
        replyToId?: string,
        filename?: string,
        fileurl?: string,
        filesize?: number,
        mimetype?: string,
        messagetype?: string
    ) {
        try {
            // Verify conversation exists and user is participant
            const conversation = await ConversationsModel.findById(conversationId);
            if (!conversation) {
                throw new APIError(StatusCodes.NOT_FOUND, "Conversation not found");
            }

            const isParticipant = conversation.participants.some(p => p.toString() === senderId);

            if (!isParticipant) {
                throw new APIError(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
            }

            const safeContent = content || ""; // Ensure content is string
            console.log(`Saving message: from ${senderId} to conv ${conversationId}. Content: "${safeContent.substring(0, 20)}..."`);
            // Save message
            const message = await MsgsModel.create({
                conversationId,
                senderId,
                content: safeContent,
                status: "sent",
                ...(replyToId && { replyToId }),
                fileName: filename,
                fileUrl: fileurl,
                fileSize: filesize,
                mimeType: mimetype,
                messageType: messagetype
            });

            // Determine preview content for conversation list
            let previewContent = content;
            if (!previewContent) {
                if (messagetype === 'image') previewContent = '📷 Image';
                else if (messagetype === 'video') previewContent = '🎥 Video';
                else if (filename) previewContent = `📄 ${filename}`;
                else previewContent = 'File';
            }

            // Update conversation's last message and touch updatedAt
            await ConversationsModel.findByIdAndUpdate(conversationId, {
                lastMessage: {
                    content: previewContent,
                    senderId,
                    timestamp: new Date()
                },
                updatedAt: new Date() // Force touch for sorting
            });
            //console.log(`✅ Message saved successfully. ID: ${message._id}. Collection: ${MsgsModel.collection.name}`);

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

            const isParticipant = conversation.participants.some(p => p.toString() === userId);

            if (!isParticipant) {
                throw new APIError(StatusCodes.FORBIDDEN, "You are not a participant of this conversation");
            }

            // Get messages
            // console.log(`Fetching messages for conv: ${conversationId}, user: ${userId}`);
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
                .populate("reactions.userId", "username")
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            //console.log(`Found ${messages.length} messages for conv ${conversationId}`);
            const totalMessages = await MsgsModel.countDocuments({ conversationId });
            // console.log(`Total messages in DB for this conv: ${totalMessages}`);

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
            const userObjectId = new mongoose.Types.ObjectId(userId);

            // Raw collection access bypasses Mongoose schema casting/validation
            // This is CRITICAL for legacy documents where IDs are stored as plain strings.
            if (!mongoose.connection.db) {
                throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, "Database connection not established");
            }
            const conversationsColl = mongoose.connection.db.collection('conversations');
            const conversations = await conversationsColl.find({
                $or: [
                    { participants: userObjectId },
                    { participants: userId },
                    { participant1Id: userObjectId },
                    { participant1Id: userId },
                    { participant2Id: userObjectId },
                    { participant2Id: userId }
                ]
            })
                .sort({ updatedAt: -1, createdAt: -1 })
                .toArray();

            // console.log(`🔍 [getConversations] Found ${conversations.length} hits via raw query.`);

            // Manual population since we bypassed Mongoose
            const populatedConversations = await Promise.all(conversations.map(async (conv) => {
                const type = conv.type || "direct"; // Fallback for legacy
                // Ensure we have a lastMessage time for sorting/display
                // If it's missing from metadata, try to find it in the msgs collection (legacy support)
                let lastMsgContent = conv.lastMessage?.content;
                let lastMsgTime = conv.lastMessage?.timestamp || conv.updatedAt || conv.createdAt;

                if (!conv.lastMessage?.content) {
                    const latestMsg = await MsgsModel.findOne({ conversationId: conv._id })
                        .sort({ timestamp: -1 })
                        .lean();
                    if (latestMsg) {
                        if (latestMsg.content) lastMsgContent = latestMsg.content;
                        else if (latestMsg.messageType === 'image') lastMsgContent = '📷 Image';
                        else if (latestMsg.messageType === 'video') lastMsgContent = '🎥 Video';
                        else if (latestMsg.fileName) lastMsgContent = `📄 ${latestMsg.fileName}`;
                        else lastMsgContent = 'File';

                        lastMsgTime = latestMsg.timestamp;

                        // Async healing - don't wait for this
                        ConversationsModel.findByIdAndUpdate(conv._id, {
                            lastMessage: {
                                content: lastMsgContent,
                                senderId: latestMsg.senderId,
                                timestamp: latestMsg.timestamp
                            }
                        }).exec().catch(err => console.error("Error healing conversation:", err));
                    }
                }

                if (type === "group") {
                    const groupMetadata = await GrpsModel.findOne({ conversationId: conv._id }).select("owner").lean();

                    // Calculate unreadCount
                    const readStatus = await ReadStatusModel.findOne({ userId, conversationId: conv._id }).lean();
                    const unreadCount = await MsgsModel.countDocuments({
                        conversationId: conv._id,
                        senderId: { $ne: userId },
                        timestamp: { $gt: readStatus?.lastReadAt || new Date(0) }
                    });

                    return {
                        conversationId: conv._id.toString(),
                        type: "group",
                        name: conv.name || "Unnamed Group",
                        participants: (conv.participants || []).map((p: any) => p.toString()),
                        ownerId: groupMetadata?.owner?.toString(),
                        lastMessage: lastMsgContent || "No messages yet",
                        lastMessageTime: lastMsgTime,
                        unreadCount,
                        isManuallyUnread: (readStatus as any)?.isManuallyUnread || false,
                        isPinned: (readStatus as any)?.isPinned || false,
                        pinnedAt: (readStatus as any)?.pinnedAt
                    };
                }

                // Direct Chat
                const p1Id = conv.participant1Id?.toString();
                const p2Id = conv.participant2Id?.toString();
                const otherParticipantId = p1Id === userId ? p2Id : p1Id;

                const otherUser = await UsersModel.findById(otherParticipantId).select("username email lastSeen profilePicture").lean();

                // Calculate unreadCount for direct chat
                const readStatus = await ReadStatusModel.findOne({ userId, conversationId: conv._id }).lean();
                const unreadCount = await MsgsModel.countDocuments({
                    conversationId: conv._id,
                    senderId: { $ne: userId },
                    timestamp: { $gt: readStatus?.lastReadAt || new Date(0) }
                });

                return {
                    conversationId: conv._id.toString(),
                    type: "direct",
                    otherUser: otherUser || { _id: otherParticipantId, username: "User" },
                    lastMessage: lastMsgContent || "No messages yet",
                    lastMessageTime: lastMsgTime,
                    unreadCount,
                    isManuallyUnread: (readStatus as any)?.isManuallyUnread || false,
                    isPinned: (readStatus as any)?.isPinned || false,
                    pinnedAt: (readStatus as any)?.pinnedAt
                };
            }));

            return populatedConversations.filter(c => c !== null);
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

            const isParticipant = conversation.participants.some(p => p.toString() === userId);

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
                participants: userId
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

    static async markConversationAsUnread(userId: string, conversationId: string) {
        try {
            await ReadStatusModel.findOneAndUpdate(
                { userId, conversationId },
                { isManuallyUnread: true },
                { upsert: true, new: true }
            );
            return { success: true };
        } catch (error) {
            console.error("Error marking conversation as unread:", error);
            throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to mark as unread");
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

            // Update ReadStatus regardless of whether individual messages were updated
            // (This handles cases where messages were already read or for group sync)
            await ReadStatusModel.findOneAndUpdate(
                { userId, conversationId },
                {
                    lastReadAt: new Date(),
                    isManuallyUnread: false
                },
                { upsert: true, new: true }
            );
            //console.log(`Updated ReadStatus for user ${userId} in conv ${conversationId}`);

            return messages;
        } catch (error) {
            console.error("Error marking messages as read:", error);
            return [];
        }
    }

    static async toggleReaction(userId: string, messageId: string, emoji: string) {
        try {
            const message = await MsgsModel.findById(messageId);
            if (!message) {
                throw new APIError(StatusCodes.NOT_FOUND, "Message not found");
            }

            // Check if user already reacted
            const existingReactionIndex = message.reactions?.findIndex(
                (r: any) => r.userId.toString() === userId
            );

            if (message.reactions && existingReactionIndex !== -1 && existingReactionIndex !== undefined) {
                const existingReaction = message.reactions[existingReactionIndex];

                if (existingReaction.emoji === emoji) {
                    // Toggle off (remove)
                    message.reactions.splice(existingReactionIndex, 1);
                } else {
                    // Update emoji
                    message.reactions[existingReactionIndex].emoji = emoji;
                }
            } else {
                // Add new reaction
                if (!message.reactions) message.reactions = [];
                message.reactions.push({ emoji, userId: new mongoose.Types.ObjectId(userId) });
            }

            await message.save();

            // Return fully populated message
            return await MsgsModel.findById(messageId)
                .populate("senderId", "username")
                .populate("reactions.userId", "username")
                .lean();

        } catch (error) {
            if (error instanceof APIError) throw error;
            throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to toggle reaction");
        }
    }

    // Toggle pin status of a conversation for a user
    static async toggleConversationPin(userId: string, conversationId: string) {
        try {
            // Find existing status or create new one
            let readStatus = await ReadStatusModel.findOne({ userId, conversationId });

            if (!readStatus) {
                readStatus = await ReadStatusModel.create({
                    userId,
                    conversationId,
                    isPinned: true,
                    pinnedAt: new Date()
                });
            } else {
                readStatus.isPinned = !readStatus.isPinned;
                if (readStatus.isPinned) {
                    readStatus.pinnedAt = new Date();
                } else {
                    readStatus.pinnedAt = undefined;
                }
                await readStatus.save();
            }

            console.log(`📌 Conversation ${conversationId} pin toggled for user ${userId}. New status: ${readStatus.isPinned}`);
            return {
                conversationId,
                isPinned: readStatus.isPinned
            };

        } catch (error) {
            console.error("Error toggling conversation pin:", error);
            throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to toggle conversation pin");
        }
    }
}