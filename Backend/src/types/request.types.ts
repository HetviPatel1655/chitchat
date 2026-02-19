import { Request as ExpresesRequest } from "express";
import { IUsers } from "./model.types";
import "multer"; // Ensure global augmentation is loaded

export interface Request extends ExpresesRequest {
  authUser?: IUsers;
  userId?: string;
  files?:
  | { [fieldname: string]: Express.Multer.File[] }
  | Express.Multer.File[];
}