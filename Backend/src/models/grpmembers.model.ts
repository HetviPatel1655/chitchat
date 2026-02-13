import mongoose, { Schema, Document } from "mongoose";

export interface IGrpmembers extends Document {
    grpname: string;
    noofmembers: number;
}

const GrpmembersSchema: Schema = new Schema({
    grpname: { type: String, required: true },
    noofmembers: { type: Number, default: 1 }
});
