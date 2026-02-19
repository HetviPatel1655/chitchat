import { Request as ExpresesRequest } from "express";
import { IUsers } from "./model.types";
import { MulterFile } from "./custom-multer"; // Import manual interface

export interface Request extends ExpresesRequest {
  authUser?: IUsers;
  userId?: string;
  files?:
  | { [fieldname: string]: MulterFile[] }
  | MulterFile[];
  file?: MulterFile;
}