import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMsgs extends Document {
    conversationId: Types.ObjectId;
    senderId: Types.ObjectId;
    content: string;
    status: "sent" | "delivered" | "read";
    isPinned: boolean;
    replyToId?: Types.ObjectId;
    messageType: 'regular' | 'system' | 'image' | 'video' | 'file' | 'audio';
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    timestamp: Date;
    reactions: {
        emoji: string;
        userId: Types.ObjectId;
    }[];
}

const MsgsSchema: Schema = new Schema({
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: "Conversations",
        required: true
    },
    senderId: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: true
    },
    content: {
        type: String,
        required: false
    },
    status: {
        type: String,
        enum: ["sent", "delivered", "read"],
        default: "sent"
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    replyToId: {
        type: Schema.Types.ObjectId,
        ref: "Msgs",
        default: null
    },
    messageType: {
        type: String,
        enum: ["regular", "system", "image", "video", "file", "audio"],
        default: "regular"
    },
    reactions: [{
        emoji: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: "Users", required: true }
    }],
    timestamp: {
        type: Date,
        default: Date.now
    },
    fileUrl: {
        type: String,
        default: ""
    },
    fileName: {
        type: String,
        default: ""
    },
    fileSize: {
        type: Number,
        default: 0
    },
    mimeType: {
        type: String,
        default: ""
    }
});

export const MsgsModel = mongoose.model<IMsgs>("Msgs", MsgsSchema);