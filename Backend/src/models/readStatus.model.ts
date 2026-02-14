import mongoose, { Schema, Document, Types } from "mongoose";

export interface IReadStatus extends Document {
    userId: Types.ObjectId;
    conversationId: Types.ObjectId;
    lastReadAt: Date;
}

const ReadStatusSchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "Users", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversations", required: true },
    lastReadAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for efficient lookup and to ensure one record per user per conversation
ReadStatusSchema.index({ userId: 1, conversationId: 1 }, { unique: true });

export const ReadStatusModel = mongoose.model<IReadStatus>("ReadStatus", ReadStatusSchema);
