import mongoose, { Schema, Document, Types } from "mongoose";

export interface IGrps extends Document {
    name: string;
    conversationId: Types.ObjectId;
    owner: Types.ObjectId;
    createdAt: Date;
}

const GrpsSchema: Schema = new Schema({
    name: { type: String, required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversations", required: true },
    owner: { type: Schema.Types.ObjectId, ref: "Users", required: true },
    createdAt: { type: Date, default: Date.now }
});

export const GrpsModel = mongoose.model<IGrps>("Grps", GrpsSchema);