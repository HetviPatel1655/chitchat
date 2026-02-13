import { NextFunction } from "express";
import { APIError } from "../error/apierror.js";
import { StatusCodes } from "http-status-codes";
import { verifyJWT } from "../utility/genJWT.js";
import { FindUser } from "../services/user.service.js";
import { Request } from "../types/request.types.js";
import { IUsers } from "../types/model.types.js";

export const validateJWT = async (req: Request, _: any, next: NextFunction) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(' ')[1]; // Expecting "Bearer <token>"

  if (!token) {
    throw new APIError(
      StatusCodes.UNAUTHORIZED,
      "Token Not Found. Unauthorized Request. Login Again"
    );
  }

  let decode: any;
  try {
    decode = verifyJWT(token);
  } catch (error) {
    console.log("Error in verifying token", error);
    throw new APIError(
      StatusCodes.UNAUTHORIZED,
      "Token is Expired. Login Again"
    );
  }

  const user = await FindUser({ query: { _id: decode.id } });

  if (!user) {
    throw new APIError(StatusCodes.UNAUTHORIZED, "Unauthorized Request.");
  }

  // ATTACH USER OBJECT IN REQ OBJECT FOR FURTHER USE IN CONTROLLERS
  req.authUser = user;
  req.userId = user._id.toString();

  // ATTACH ADMIN FLAG IN REQ OBJECT FOR FURTHER USE IN CONTROLLERS
  //   req.admin = user.role === "ADMIN";

  next();
};
