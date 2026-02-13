import mongoose, { Schema, Document } from "mongoose";
import { Types } from "mongoose";

export interface IConversations extends Document {
    participant1Id: Types.ObjectId;
    participant2Id: Types.ObjectId;
    type: "direct";
    lastMessage: {
        content: string;
        senderId: Types.ObjectId;
        timestamp: Date;
    } | null;
    createdAt: Date;
}

const ConversationsSchema: Schema = new Schema({
    participant1Id: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: true
    },
    participant2Id: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: true
    },
    type: {
        type: String,
        default: "direct"
    },
    lastMessage: {
        content: String,
        senderId: {
            type: Schema.Types.ObjectId,
            ref: "Users"
        },
        timestamp: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Unique index to prevent duplicate conversations
ConversationsSchema.index(
    { participant1Id: 1, participant2Id: 1 },
    { unique: true, sparse: true }
);

export const ConversationsModel = mongoose.model<IConversations>("Conversations", ConversationsSchema);