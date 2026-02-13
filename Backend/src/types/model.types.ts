import { Types } from "mongoose";

export interface IUsers {
    _id: Types.ObjectId;
    username: string;
    email: string;
    password: string;
}

export interface IGrps {
    _id: Types.ObjectId;
    grpname: string;
    owner: string;
    noofmembers: number;
    members: Types.ObjectId[];
    createdAt: Date;
}

export interface IGrpmembers {
    _id: Types.ObjectId;
    grpname: string;
    noofmembers: number;
}

export interface IMsgs {
    _id: Types.ObjectId;
    sender: string;
    receiver: string;
    content: string;
    timestamp: Date;
}

