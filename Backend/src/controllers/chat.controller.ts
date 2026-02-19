import { StatusCodes } from "http-status-codes";
import { APIError } from "../error/apierror";
import { chatservice } from "../services/chat.service";
import type { Request } from "../types/request.types";
import type { Response } from "express";

export const startDirectMessage = async (req: Request, res: Response) => {
    const { receiverUsername } = req.body;
    const userId = req.userId;

    if (!receiverUsername) {
        throw new APIError(StatusCodes.BAD_REQUEST, "Receiver username is required");
    }

    const result = await chatservice.startDirectChat(userId!, receiverUsername);

    res.status(StatusCodes.OK).json({
        success: true,
        data: result
    });
};

export const getMessages = async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.userId;

    const result = await chatservice.getMessages(
        userId!,
        conversationId,
        Number(page),
        Number(limit)
    );

    res.status(StatusCodes.OK).json({
        success: true,
        data: result
    });
};

export const getConversations = async (req: Request, res: Response) => {
    const userId = req.userId;

    const result = await chatservice.getConversations(userId!);

    res.status(StatusCodes.OK).json({
        success: true,
        data: result
    });
};

// NOTE: Pin/unpin functionality is handled via WebSocket events (toggle_pin_message)
// See socket.service.ts for the implementation

export const markAsUnread = async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const userId = req.userId;

    await chatservice.markConversationAsUnread(userId!, conversationId);

    res.status(StatusCodes.OK).json({
        success: true,
        message: "Conversation marked as unread"
    });
};