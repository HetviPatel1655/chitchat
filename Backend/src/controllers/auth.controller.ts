import axios from "axios";
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { FindUser, createUser } from "../services/user.service";
import { APIError } from "../error/apierror";
import CryptoJS from "crypto-js";
import { generateJWT } from "../utility/genJWT";
import { UsersModel } from "../models/users.model";

export const registercontroller = async (req: Request, res: Response) => {
    const payload = req.body;
    console.log("Register Payload:", payload);

    let checkusername = await FindUser({ query: { email: payload.email } });
    console.log("Check Username (Email exists?):", checkusername);

    if (checkusername) {
        throw new APIError(StatusCodes.BAD_REQUEST, "User with this email already exists");
    }

    if (!process.env.AES_KEY) {
        throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, "Encryption key not found");
    }

    let password = CryptoJS.AES.encrypt(payload.password, process.env.AES_KEY).toString();

    const user = await createUser(
        new UsersModel({
            ...payload,
            username: payload.username,
            email: payload.email,
            password: password
        })
    );

    res.status(StatusCodes.CREATED).json({
        message: "User registered successfully",
        data: {
            userId: user._id,
            username: user.username,
            email: user.email
        }
    });
};

export const logincontroller = async (req: Request, res: Response) => {
    const payload = req.body;
    console.log("Login Payload:", payload);

    if (!payload.username || !payload.password) {
        throw new APIError(StatusCodes.BAD_REQUEST, "Username and password are required");
    }

    let query: any = {};
    if (payload.username.includes('@')) {
        query = { email: payload.username };
    } else {
        query = { username: payload.username };
    }

    let user = await FindUser({ query: query });
    console.log("Found User:", user);

    if (!user) {
        throw new APIError(StatusCodes.BAD_REQUEST, "User not found");
    }

    if (!process.env.AES_KEY) {
        throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, "AES_KEY environment variable is not set");
    }

    let password = CryptoJS.AES.decrypt(user.password, process.env.AES_KEY).toString(CryptoJS.enc.Utf8);

    if (password !== payload.password) {
        throw new APIError(StatusCodes.BAD_REQUEST, "Password is incorrect");
    }

    const token = generateJWT({ id: user._id.toString() });

    res.status(StatusCodes.OK).set({ "X-Auth-Token": token }).json({
        message: "User logged in successfully",
        data: {
            token,
            userId: user._id,
            username: user.username,
            email: user.email
        }
    });
};