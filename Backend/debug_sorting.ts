
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/MessagingApp";

async function debugSorting() {
    await mongoose.connect(mongoUri);
    console.log("Connected to DB");

    const db = mongoose.connection.db;
    if (!db) {
        console.error("Database connection failed - db object is undefined");
        await mongoose.disconnect();
        return;
    }
    const conversations = await db.collection('conversations').find({}).toArray();

    console.log("\n--- Conversations Summary ---");
    for (const conv of conversations) {
        console.log(`ID: ${conv._id}`);
        console.log(`  Type: ${conv.type}`);
        console.log(`  Name: ${conv.name || 'N/A'}`);
        console.log(`  UpdatedAt: ${conv.updatedAt}`);
        console.log(`  CreatedAt: ${conv.createdAt}`);
        console.log(`  LastMsg: ${conv.lastMessage?.content || 'NONE'}`);
        console.log(`  LastMsgTime: ${conv.lastMessage?.timestamp}`);

        // Find latest message in msgs collection for this conv
        const latestMsg = await db.collection('msgs').find({ conversationId: conv._id })
            .sort({ timestamp: -1 })
            .limit(1)
            .toArray();

        if (latestMsg.length > 0) {
            console.log(`  REAL Latest Msg Time: ${latestMsg[0].timestamp}`);
            console.log(`  REAL Latest Msg Content: ${latestMsg[0].content}`);
        }
    }

    await mongoose.disconnect();
}

debugSorting().catch(console.error);
