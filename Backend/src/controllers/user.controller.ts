import { StatusCodes } from "http-status-codes";
import { APIError } from "../error/apierror";
import * as UserService from "../services/user.service";
import type { Request } from "../types/request.types";
import type { Response } from "express";

export const searchUsersController = async (req: Request, res: Response) => {
    const { term, ids } = req.query;
    const userId = req.userId;

    let users;
    if (ids && typeof ids === "string") {
        const idList = ids.split(",").filter(id => id.trim().length > 0);
        users = await UserService.searchUsersByIds(idList);
    } else if (typeof term === "string" && term.trim().length > 0) {
        users = await UserService.searchUsers(term, userId!);
    } else {
        throw new APIError(StatusCodes.BAD_REQUEST, "Invalid search parameters: Either 'term' or 'ids' is required");
    }

    res.status(StatusCodes.OK).json({
        success: true,
        data: users
    });
};
