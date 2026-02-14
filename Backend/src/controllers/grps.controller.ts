import { Request, Response } from "express";
import { GrpsService } from "../services/grps.service";
import { StatusCodes } from "http-status-codes";
import { APIError } from "../error/apierror";

export const viewgrpscontroller = async (req: Request, res: Response) => {
    const groups = await GrpsService.Listallgrps();
    res.status(StatusCodes.OK).json({
        message: "Groups retrieved successfully",
        data: groups
    });
    if (!groups) {
        throw new APIError(StatusCodes.NOT_FOUND, "No groups found");
    }

}

export const creategroupcontroller = async (req: Request, res: Response) => {

}

export const joingroupcontroller = async (req: Request, res: Response) => {

}

export const leavegroupcontroller = async (req: Request, res: Response) => {

}

export const deletegroupcontroller = async (req: Request, res: Response) => {

}