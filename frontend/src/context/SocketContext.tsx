import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import io, { type Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

interface SocketContextType {
    socket: Socket | null;
    onlineUsers: string[]; // Array of user IDs or usernames
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const { user, token, logout } = useAuth();

    console.log("SocketProvider: Rendered. User:", user?.username, "Token:", !!token);

    useEffect(() => {
        console.log("SocketProvider: Effect triggered. User:", !!user, "Token:", !!token);
        if (token && user) {
            console.log("SocketProvider: Initiating connection...");
            // Initialize socket connection
            const socketUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
            const newSocket = io(socketUrl, {
                auth: {
                    token: token,
                },
                transports: ["websocket", "polling"], // Try websocket first
                withCredentials: true,
            });

            newSocket.on("connect", () => {
                console.log("Socket connected:", newSocket.id);
            });

            newSocket.on("getOnlineUsers", (users: string[]) => {
                setOnlineUsers(users);
            });

            newSocket.on("connect_error", (err: any) => {
                console.error("Socket connection error:", err);
                if (err.message === "Authentication error: Invalid token" || err.message === "Authentication error: No token provided") {
                    console.log("Socket authentication failed. Logging out.");
                    logout();
                }
            });

            setSocket(newSocket);

            // Cleanup on unmount or when token changes
            return () => {
                newSocket.close();
                setSocket(null);
            };
        } else {
            // If no token (logged out), ensure socket is closed
            if (socket) {
                socket.close();
                setSocket(null);
            }
        }
    }, [token, user]); // Re-run when token or user changes

    return (
        <SocketContext.Provider value={{ socket, onlineUsers }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error("useSocket must be used within a SocketProvider");
    }
    return context;
};
