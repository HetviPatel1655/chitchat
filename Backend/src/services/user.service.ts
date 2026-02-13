import type { ClientSession } from "mongoose";
import type { IUsers } from "../types/model.types.ts";
import { UsersModel } from "../models/users.model";
import { APIError } from "../error/apierror";
import { StatusCodes } from "http-status-codes";

export const createUser = async (user: IUsers) => {
    try {
        const u = await UsersModel.create(user);
        return u;
    } catch (error) {
        console.error("Error creating user:", error);
        throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error.message : String(error));
    }
}

export const FindUser = async ({ 
    query, 
    populate = [], 
    session,  
}: { 
    query: Partial<IUsers>; 
    populate?: {
        path: string;
        select?: string;
        populate?: { path: string; select?: string };
    }[];
    session?: ClientSession;
}) => {
    try {
        const user = await UsersModel.findOne(query);
        return user;
    } catch (error) {
        console.error("Error finding user by email:", error);
        throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to find user by email");
    }
}

