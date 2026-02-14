import mongoose, { Schema, Document } from "mongoose";
import { Types } from "mongoose";

export interface IConversations extends Document {
    participant1Id?: Types.ObjectId; // Used for direct chat
    participant2Id?: Types.ObjectId; // Used for direct chat
    participants: Types.ObjectId[];  // Used for both, but required for groups
    type: "direct" | "group";
    name?: string; // Group name
    lastMessage: {
        content: string;
        senderId: Types.ObjectId;
        timestamp: Date;
    } | null;
    createdAt: Date;
    updatedAt: Date;
}

const ConversationsSchema: Schema = new Schema({
    participant1Id: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: false
    },
    participant2Id: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: false
    },
    participants: [{
        type: Schema.Types.ObjectId,
        ref: "Users"
    }],
    type: {
        type: String,
        enum: ["direct", "group"],
        default: "direct"
    },
    name: {
        type: String,
        default: null
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
}, { timestamps: true });

// Unique index to prevent duplicate conversations
ConversationsSchema.index(
    { participant1Id: 1, participant2Id: 1 },
    { unique: true, sparse: true }
);

export const ConversationsModel = mongoose.model<IConversations>("Conversations", ConversationsSchema);