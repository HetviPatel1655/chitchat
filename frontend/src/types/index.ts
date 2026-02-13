export interface User {
    _id: string;
    username: string;
    email: string;
    profilePicture?: string;
}

export interface Message {
    _id: string;
    conversationId: string;
    senderId: string;
    content: string;
    status: 'sent' | 'delivered' | 'read';
    timestamp: string;
    isPinned?: boolean;
    replyTo?: {
        _id: string;
        content: string;
        senderId: { _id?: string; username: string } | string;
    };
}

export interface Conversation {
    conversationId: string;
    otherUser: {
        _id: string;
        username: string;
        email: string;
        profilePicture?: string;
        lastSeen?: string;
    };
    lastMessage: string | { // Backend getConversations returns string, but sometimes we might want object?
        content: string;
        senderId: string;
        timestamp: string;
    };
    // Wait, getConversations returns `lastMessage: string`.
    // But ChatWindow might need more?
    // Let's stick to what getConversations returns for list: string.
    // But modifying it to string might break if we want bold unread?
    // Backend says: lastMessage: conv.lastMessage?.content || "No messages yet" -> STRING.
    lastMessageTime: string;
}
