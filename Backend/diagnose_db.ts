
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MsgsModel } from './src/models/msgs.model';
import { ConversationsModel } from './src/models/conversations.model';
import { UsersModel } from './src/models/users.model';

dotenv.config();

const diagnose = async () => {
    try {
        await mongoose.connect(process.env.DB_URL as string);
        console.log("Connected to DB:", mongoose.connection.name);

        const msgCount = await MsgsModel.countDocuments();
        console.log("Total messages in 'msgs' collection:", msgCount);

        const convCount = await ConversationsModel.countDocuments();
        console.log("Total conversations:", convCount);

        const userCount = await UsersModel.countDocuments();
        console.log("Total users:", userCount);

        const latestMsgs = await MsgsModel.find().sort({ timestamp: -1 }).limit(5);
        console.log("Latest 5 messages:", latestMsgs.map(m => ({
            id: m._id,
            content: m.content,
            timestamp: m.timestamp,
            senderId: m.senderId,
            conversationId: m.conversationId
        })));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

diagnose();
