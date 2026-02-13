import mongoose, { Schema, Document } from "mongoose";

interface IUsers extends Document {
    username: string;
    email: string;
    password: string;
    lastSeen: Date;
    createdAt: Date;
}

const UsersSchema: Schema = new Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    lastSeen: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

export const UsersModel = mongoose.model<IUsers>("Users", UsersSchema);
