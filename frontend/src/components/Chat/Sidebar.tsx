import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import type { Conversation } from '../../types';
import Avatar from '../UI/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

interface SidebarProps {
    onSelectConversation: (conversation: Conversation) => void;
    selectedConversationId?: string;
    onOnlineStatusChange?: (onlineUsers: Set<string>, lastSeenMap: Map<string, string>) => void;
}

const Sidebar = ({ onSelectConversation, selectedConversationId, onOnlineStatusChange }: SidebarProps) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const { user, logout } = useAuth();
    const { socket } = useSocket();
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [lastSeenMap, setLastSeenMap] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        fetchConversations();
    }, []);

    // Real-time Sidebar Updates
    const lastProcessedMessageIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = (message: any) => {
            if (message._id === lastProcessedMessageIdRef.current) {
                console.log("Sidebar Duplicate event ignored:", message._id);
                return;
            }
            lastProcessedMessageIdRef.current = message._id;

            setConversations(prev => {
                const index = prev.findIndex(c => c.conversationId === message.conversationId);

                if (index !== -1) {
                    // Update existing conversation preview
                    const updated = [...prev];
                    const conversation = { ...updated[index] } as any;

                    conversation.lastMessage = message.content;
                    conversation.lastMessageTime = message.timestamp;

                    // Increment unread count if NOT currently selected
                    if (message.conversationId !== selectedConversationId) {
                        conversation.unreadCount = (conversation.unreadCount || 0) + 1;
                    }

                    // Move to top
                    updated.splice(index, 1);
                    return [conversation, ...updated];
                } else {
                    // For brand new conversations unknown to this user's current session
                    fetchConversations();
                    return prev;
                }
            });
        };

        const handleMessageRead = (data: { conversationId: string, readerId: string }) => {
            // If the reader is ME (the current user), validation is implicit because I triggered it.
            // Or if the reader is the OTHER user, it means THEY read my messages (doesn't affect my unread count).
            // Wait: unread count is messages *I* haven't read.
            // So if *I* emit mark_messages_read, I am the reader.

            if (data.readerId === user?._id) {
                setConversations(prev => prev.map(c =>
                    c.conversationId === data.conversationId
                        ? { ...c, unreadCount: 0 } as any
                        : c
                ));
            }
        };

        socket.on('receive_message', handleReceiveMessage);
        socket.on('message_read', handleMessageRead);

        return () => {
            socket.off('receive_message', handleReceiveMessage);
            socket.off('message_read', handleMessageRead);
        };
    }, [socket, selectedConversationId]);

    // Track online/offline users
    useEffect(() => {
        if (!socket) return;

        // Handle initial list of active users (received on connect)
        const handleActiveUsers = (data: { userIds: string[] }) => {
            setOnlineUsers(new Set(data.userIds));
        };

        const handleUserOnline = (data: { userId: string }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                next.add(data.userId);
                return next;
            });
        };

        const handleUserOffline = (data: { userId: string; lastSeen?: string }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                next.delete(data.userId);
                return next;
            });
            if (data.lastSeen) {
                setLastSeenMap(prev => {
                    const next = new Map(prev);
                    next.set(data.userId, data.lastSeen!);
                    return next;
                });
            }
        };

        socket.on('active_users', handleActiveUsers);
        socket.on('user_online', handleUserOnline);
        socket.on('user_offline', handleUserOffline);

        return () => {
            socket.off('active_users', handleActiveUsers);
            socket.off('user_online', handleUserOnline);
            socket.off('user_offline', handleUserOffline);
        };
    }, [socket]);

    // Notify parent about online status changes
    useEffect(() => {
        onOnlineStatusChange?.(onlineUsers, lastSeenMap);
    }, [onlineUsers, lastSeenMap]);

    const fetchConversations = async () => {
        try {
            const response = await api.get('/chat/conversations');
            if (Array.isArray(response.data.data)) {
                setConversations(response.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch conversations", err);
        }
    };

    const handleLogout = () => {
        logout();
        window.location.href = '/login'; // Explicit redirect for immediate feedback
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;

        // For now, this just starts a chat like before. Ideal search filters list.
        setLoading(true);
        try {
            // Logic to filter local list or fetch new user
            // Reusing the "Start New Chat" logic for simplicity in this transition
            const response = await api.post('/chat/start-direct-message', {
                receiverUsername: searchTerm
            });
            const newConversation = response.data.data;
            if (!conversations.find(c => c.conversationId === newConversation.conversationId)) {
                setConversations([newConversation, ...conversations]);
            }
            onSelectConversation(newConversation);
            setSearchTerm('');
        } catch (err) {
            console.error("Failed to start chat", err);
        } finally {
            setLoading(false);
        }
    };

    // Filter conversations if search term is typed but not submitted?
    // Implementing basic local filter for existing chats
    const filteredConversations = conversations.filter(c =>
        c.otherUser?.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-sidebar relative border-r border-white/5">
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <Avatar src={user?.profilePicture} alt={user?.username} size="md" isOnline={true} />
                    <h2 className="text-lg font-bold text-gray-100 tracking-tight">Messages</h2>
                </div>
                <div className="flex gap-1 text-gray-400">
                    <button
                        onClick={handleLogout}
                        title="Logout"
                        className="p-2 hover:bg-red-500/10 rounded-full transition-colors hover:text-red-400"
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    </button>
                    <button className="p-2 hover:bg-white/5 rounded-full transition-colors hover:text-white">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                    </button>
                    <button className="p-2 hover:bg-white/5 rounded-full transition-colors hover:text-white">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="px-4 pb-3">
                <form onSubmit={handleSearch} className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-gray-500 group-focus-within:text-primary-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-9 pr-8 py-2 bg-surface-light border border-transparent rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:bg-surface-light focus:border-white/10 focus:ring-2 focus:ring-primary-500/20 transition-all shadow-inner disabled:opacity-50"
                        placeholder="Search conversations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={loading}
                    />
                    {loading && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <div className="animate-spin h-3.5 w-3.5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                        </div>
                    )}
                </form>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar">
                <div className="space-y-0.5">
                    {filteredConversations.map(conversation => {
                        const otherUser = conversation.otherUser;
                        const isSelected = selectedConversationId === conversation.conversationId;
                        const unreadCount = (conversation as any).unreadCount || 0;

                        return (
                            <button
                                key={conversation.conversationId}
                                onClick={() => {
                                    // Reset unread count when clicking
                                    setConversations(prev => prev.map(c =>
                                        c.conversationId === conversation.conversationId
                                            ? { ...c, unreadCount: 0 } as any
                                            : c
                                    ));
                                    onSelectConversation(conversation);
                                }}
                                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 group relative text-left
                                    ${isSelected
                                        ? 'bg-white/5 shadow-soft border-l-2 border-primary-500 rounded-l-none'
                                        : 'hover:bg-white/[0.03] border-l-2 border-transparent'
                                    }`}
                            >
                                <div className="relative shrink-0">
                                    <Avatar src={otherUser?.profilePicture} alt={otherUser?.username} size="lg" isOnline={otherUser ? onlineUsers.has(otherUser._id) : false} />
                                    {otherUser && onlineUsers.has(otherUser._id) && (
                                        <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-accent-emerald border-2 border-sidebar rounded-full shadow-sm"></span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <h3 className={`font-semibold text-[13.5px] truncate ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                                            {otherUser?.username}
                                        </h3>
                                        <span className={`text-[10px] ${isSelected ? 'text-primary-400' : 'text-gray-500'}`}>
                                            {new Date(conversation.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className={`text-[12.5px] leading-tight truncate ${unreadCount > 0 && !isSelected ? 'text-white font-semibold' : isSelected ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-400'}`}>
                                        {typeof conversation.lastMessage === 'string' ? conversation.lastMessage : conversation.lastMessage?.content}
                                    </p>
                                </div>

                                {/* Real Unread Badge */}
                                {unreadCount > 0 && !isSelected && (
                                    <div className="px-1.5 py-0.5 min-w-[18px] h-[18px] bg-primary-600 rounded-full flex items-center justify-center shadow-glow animate-scale-in">
                                        <span className="text-[10px] font-bold text-white">{unreadCount}</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Floating Action Button (New Chat) - Compact & Dark */}
            <button
                onClick={() => document.querySelector<HTMLInputElement>('input[placeholder="Search conversations..."]')?.focus()}
                className="absolute bottom-6 right-6 w-12 h-12 bg-primary-600 hover:bg-primary-500 text-white rounded-2xl shadow-glow hover:shadow-xl transition-all flex items-center justify-center transform hover:scale-105 active:scale-95"
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </button>
        </div>
    );
};

export default Sidebar;
