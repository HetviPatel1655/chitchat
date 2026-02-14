import mongoose from "mongoose";
import { GrpsModel } from "../models/groups.model";
import { ConversationsModel } from "../models/conversations.model";
import { UsersModel } from "../models/users.model";
import { MsgsModel } from "../models/msgs.model";
import { APIError } from "../error/apierror";
import { StatusCodes } from "http-status-codes";

export class GrpsService {

    static async createGroup(ownerId: string, name: string, memberIds: string[]) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            // Ensure owner is included in members
            const allMemberIds = Array.from(new Set([...memberIds, ownerId])).map(id => new mongoose.Types.ObjectId(id));

            // 1. Create the Conversation first
            const conversation = await ConversationsModel.create([{
                type: "group",
                name: name,
                participants: allMemberIds,
                lastMessage: null
            }], { session });

            const conversationId = conversation[0]._id;

            // 2. Create the Group Metadata
            const group = await GrpsModel.create([{
                name: name,
                conversationId: conversationId,
                owner: new mongoose.Types.ObjectId(ownerId)
            }], { session });

            // 3. Create System Message for group creation
            // Fetch names for a nice message
            const participantsFull = await UsersModel.find({ _id: { $in: allMemberIds } }, 'username').lean();
            const owner = participantsFull.find(p => p._id.toString() === ownerId);
            const others = participantsFull.filter(p => p._id.toString() !== ownerId).map(p => p.username);

            const systemContent = `${owner?.username || 'Admin'} created the group "${name}" and added ${others.join(", ")}`;

            const systemMsg = await MsgsModel.create([{
                conversationId,
                senderId: new mongoose.Types.ObjectId(ownerId), // Creator is technical sender
                content: systemContent,
                messageType: "system",
                status: "sent",
                timestamp: new Date()
            }], { session });

            // 4. Update Conversation with lastMessage
            await ConversationsModel.findByIdAndUpdate(conversationId, {
                lastMessage: {
                    content: systemContent,
                    senderId: new mongoose.Types.ObjectId(ownerId),
                    timestamp: new Date()
                }
            }, { session });

            await session.commitTransaction();
            session.endSession();

            return {
                conversationId: conversationId.toString(),
                groupId: group[0]._id.toString(),
                name: name,
                participants: allMemberIds,
                systemMessage: systemMsg[0]
            };
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw new APIError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to create group");
        }
    }

    static async listUserGroups(userId: string) {
        // We can just query conversations of type group where user is a participant
        return await ConversationsModel.find({
            type: "group",
            participants: userId
        }).select("_id name lastMessage createdAt").lean();
    }

    static async Listallgrps() {
        return await ConversationsModel.find({ type: "group" }).select("_id name participants lastMessage createdAt").lean();
    }

    static async addMember(conversationId: string, userId: string, adminId: string) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            // 1. Verify group exists and admin is owner
            const group = await GrpsModel.findOne({ conversationId });
            if (!group) throw new APIError(StatusCodes.NOT_FOUND, "Group not found");

            if (group.owner.toString() !== adminId) {
                throw new APIError(StatusCodes.FORBIDDEN, "Only group owner can add members");
            }

            // 2. Check if user is already a participant
            const conversation = await ConversationsModel.findById(conversationId);
            if (!conversation) throw new APIError(StatusCodes.NOT_FOUND, "Conversation not found");

            const isAlreadyMember = conversation.participants.some(p => p.toString() === userId);
            if (isAlreadyMember) {
                throw new APIError(StatusCodes.BAD_REQUEST, "User is already a member of this group");
            }

            // 3. Add to conversation participants
            await ConversationsModel.findByIdAndUpdate(conversationId, {
                $addToSet: { participants: new mongoose.Types.ObjectId(userId) }
            }, { session });

            // 4. Create System Message
            const admin = await UsersModel.findById(adminId, 'username').lean();
            const addedUser = await UsersModel.findById(userId, 'username').lean();

            const systemContent = `${admin?.username || 'Admin'} added ${addedUser?.username || 'a user'} to the group`;

            const systemMsg = await MsgsModel.create([{
                conversationId: new mongoose.Types.ObjectId(conversationId),
                senderId: new mongoose.Types.ObjectId(adminId),
                content: systemContent,
                messageType: "system",
                status: "sent",
                timestamp: new Date()
            }], { session });

            // 5. Update Conversation Metadata
            await ConversationsModel.findByIdAndUpdate(conversationId, {
                lastMessage: {
                    content: systemContent,
                    senderId: new mongoose.Types.ObjectId(adminId),
                    timestamp: new Date()
                },
                updatedAt: new Date()
            }, { session });

            await session.commitTransaction();
            session.endSession();

            return {
                success: true,
                systemMessage: systemMsg[0],
                groupName: group.name
            };
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error instanceof APIError ? error : new APIError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to add member");
        }
    }

    static async removeMember(conversationId: string, targetUserId: string, adminId: string) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            // 1. Verify group exists and admin is owner
            const group = await GrpsModel.findOne({ conversationId });
            if (!group) throw new APIError(StatusCodes.NOT_FOUND, "Group not found");

            if (group.owner.toString() !== adminId) {
                throw new APIError(StatusCodes.FORBIDDEN, "Only group owner can remove members");
            }

            // 2. Prevent owner from removing themselves (they should delete the group instead)
            if (targetUserId === adminId) {
                throw new APIError(StatusCodes.BAD_REQUEST, "Owner cannot remove themselves from the group");
            }

            // 3. Remove from conversation participants
            await ConversationsModel.findByIdAndUpdate(conversationId, {
                $pull: { participants: new mongoose.Types.ObjectId(targetUserId) }
            }, { session });

            // 4. Create System Message
            const admin = await UsersModel.findById(adminId, 'username').lean();
            const removedUser = await UsersModel.findById(targetUserId, 'username').lean();

            const systemContent = `${admin?.username || 'Admin'} removed ${removedUser?.username || 'a user'} from the group`;

            const systemMsg = await MsgsModel.create([{
                conversationId: new mongoose.Types.ObjectId(conversationId),
                senderId: new mongoose.Types.ObjectId(adminId),
                content: systemContent,
                messageType: "system",
                status: "sent",
                timestamp: new Date()
            }], { session });

            // 5. Update Conversation Metadata
            await ConversationsModel.findByIdAndUpdate(conversationId, {
                lastMessage: {
                    content: systemContent,
                    senderId: new mongoose.Types.ObjectId(adminId),
                    timestamp: new Date()
                },
                updatedAt: new Date()
            }, { session });

            await session.commitTransaction();
            session.endSession();

            return {
                success: true,
                systemMessage: systemMsg[0],
                groupName: group.name
            };
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error instanceof APIError ? error : new APIError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to remove member");
        }
    }

    static async deleteGroup(conversationId: string, ownerId: string) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const convId = new mongoose.Types.ObjectId(conversationId);
            const ownId = new mongoose.Types.ObjectId(ownerId);

            // 1. Verify group exists and user is owner
            const group = await GrpsModel.findOne({ conversationId: convId });
            if (!group) throw new APIError(StatusCodes.NOT_FOUND, "Group not found");

            if (group.owner.toString() !== ownerId) {
                throw new APIError(StatusCodes.FORBIDDEN, "Only group owner can delete the group");
            }

            // 2. Fetch all participants to notify them via socket later
            const conversation = await ConversationsModel.findById(convId);
            const participantIds = conversation?.participants.map(p => p.toString()) || [];

            console.log(`Deleting group: ${group.name} (${conversationId}) by owner ${ownerId}`);

            // 3. Delete everything associated with the group
            const grpDelete = await GrpsModel.findOneAndDelete({ conversationId: convId }, { session });
            const msgsDelete = await MsgsModel.deleteMany({ conversationId: convId }, { session });
            const convDelete = await ConversationsModel.findByIdAndDelete(convId, { session });

            console.log(`Deletion results - Meta: ${grpDelete ? 'OK' : 'FAIL'}, Msgs: ${msgsDelete.deletedCount}, Conv: ${convDelete ? 'OK' : 'FAIL'}`);

            await session.commitTransaction();
            session.endSession();

            return { success: true, participantIds };
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error("DeleteGroup Error:", error);
            throw error instanceof APIError ? error : new APIError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to delete group");
        }
    }

    static async leaveGroup(conversationId: string, userId: string) {
        await ConversationsModel.findByIdAndUpdate(conversationId, {
            $pull: { participants: new mongoose.Types.ObjectId(userId) }
        });
        return { success: true };
    }
}