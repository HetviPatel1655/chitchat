export interface User {
    _id: string;
    username: string;
    email: string;
    profilePicture?: string;
}

export interface Message {
    _id: string;
    conversationId: string;
    senderId: any; // Allow object or string
    content: string;
    status: 'sent' | 'delivered' | 'read';
    timestamp: string;
    isPinned?: boolean;
    messageType?: 'regular' | 'system' | 'image' | 'video' | 'file';
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    replyTo?: {
        _id: string;
        content: string;
        senderId: any;
    };
    reactions?: {
        emoji: string;
        userId: any; // string or populated user object
    }[];
}

export interface Conversation {
    conversationId: string;
    type: "direct" | "group";
    name?: string; // Only for groups
    otherUser?: {
        _id: string;
        username: string;
        email: string;
        profilePicture?: string;
        lastSeen?: string;
    };
    participants?: string[]; // IDs of users
    ownerId?: string; // Added for groups
    lastMessage: string | {
        content: string;
        senderId: string;
        timestamp: string;
    };
    lastMessageTime: string;
    unreadCount?: number;
    isManuallyUnread?: boolean;
    isPinned?: boolean;
    pinnedAt?: string;
}
