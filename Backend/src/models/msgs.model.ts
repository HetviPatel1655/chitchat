import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMsgs extends Document {
    conversationId: Types.ObjectId;
    senderId: Types.ObjectId;
    content: string;
    status: "sent" | "delivered" | "read";
    isPinned: boolean;
    replyToId?: Types.ObjectId;
    timestamp: Date;
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
        required: true
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
    timestamp: {
        type: Date,
        default: Date.now
    }
});

export const MsgsModel = mongoose.model<IMsgs>("Msgs", MsgsSchema);