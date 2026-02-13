import mongoose, { Schema, Document } from "mongoose";

export interface IGrps extends Document {
    grpname: string;
    owner: string;
    noofmembers: number;  
    members: string[];
    createdAt: Date;
}

const GrpsSchema: Schema = new Schema({
    name: { type: String, required: true },
    owner: { type: String, required: true },
    noofmembers: { type: Number, default: 1 },
    members: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
});

export const Grps = mongoose.model<IGrps>("Grps", GrpsSchema);