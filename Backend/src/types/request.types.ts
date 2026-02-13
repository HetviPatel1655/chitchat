import { Request as ExpresesRequest } from "express";
import { IUsers } from "./model.types";

export interface Request extends ExpresesRequest {
  authUser?: IUsers;
  userId?: string;
  // admin?: boolean;
  // files?:
  //   | { [fieldname: string]: Express.Multer.File[] }
  //   | Express.Multer.File[];
}