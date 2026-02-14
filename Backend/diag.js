
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/MessagingApp";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('MessagingApp');
        const conversations = await db.collection('conversations').find({}).toArray();

        console.log("\n--- Conversations Diagnostic ---");
        for (const conv of conversations) {
            console.log(`ID: ${conv._id}`);
            console.log(`  Type: ${conv.type}`);
            console.log(`  Name: ${conv.name || 'N/A'}`);
            console.log(`  UpdatedAt: ${conv.updatedAt}`);
            console.log(`  CreatedAt: ${conv.createdAt}`);
            console.log(`  LastMsg: ${conv.lastMessage?.content || 'NONE'}`);
            console.log(`  LastMsgTime: ${conv.lastMessage?.timestamp}`);

            const latestMsg = await db.collection('msgs').findOne(
                { conversationId: conv._id },
                { sort: { timestamp: -1 } }
            );

            if (latestMsg) {
                console.log(`  Actual Latest Msg: ${latestMsg.timestamp} | ${latestMsg.content.substring(0, 20)}`);
            }
        }
    } finally {
        await client.close();
    }
}

run().catch(console.error);
