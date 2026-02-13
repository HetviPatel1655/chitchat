import type { Server } from "http";
import { connectDB } from "./connectDB";

export const StartServer = async (server: Server, port: number) => {
    try {
        await connectDB();

        server.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};