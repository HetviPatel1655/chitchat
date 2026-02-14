import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import type { Conversation } from '../../types';
import Avatar from '../UI/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import CreateGroupModal from './CreateGroupModal';
import ConfirmModal from '../UI/ConfirmModal';
import { formatSystemMessage } from '../../utils/stringUtils';

interface SidebarProps {
    onSelectConversation: (conversation: Conversation) => void;
    selectedConversationId?: string;
    onOnlineStatusChange?: (onlineUsers: Set<string>, lastSeenMap: Map<string, string>) => void;
}

const Sidebar = ({ onSelectConversation, selectedConversationId, onOnlineStatusChange }: SidebarProps) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);

    // Helper to format date nicely
    const formatMessageTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffInDays === 0 && date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffInDays === 1 || (diffInDays === 0 && date.toDateString() !== now.toDateString())) {
            return 'Yesterday';
        } else if (diffInDays < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type?: 'danger' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
    });

    const showAlert = (title: string, message: string, type: 'danger' | 'info' = 'info') => {
        setAlertConfig({ isOpen: true, title, message, type });
    };
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
                return;
            }
            lastProcessedMessageIdRef.current = message._id;

            setConversations(prev => {
                const index = prev.findIndex(c => c.conversationId === message.conversationId);

                if (index !== -1) {
                    const updated = [...prev];
                    const conversation = { ...updated[index] } as any;

                    conversation.lastMessage = message.content;
                    conversation.lastMessageTime = message.timestamp;

                    if (message.conversationId !== selectedConversationId && message.senderId !== user?._id) {
                        conversation.unreadCount = (conversation.unreadCount || 0) + 1;
                    }

                    updated.splice(index, 1);
                    return [conversation, ...updated];
                } else {
                    fetchConversations();
                    return prev;
                }
            });
        };

        const handleMessageRead = (data: { conversationId: string, readerId: string }) => {
            if (data.readerId === user?._id) {
                setConversations(prev => prev.map(c =>
                    c.conversationId === data.conversationId
                        ? { ...c, unreadCount: 0 } as any
                        : c
                ));
            }
        };

        const handleGroupCreated = (group: any) => {
            setConversations(prev => {
                if (prev.find(c => c.conversationId === group.conversationId)) return prev;
                return [group, ...prev];
            });
        };

        const handleGroupDeleted = (data: { conversationId: string }) => {
            setConversations(prev => prev.filter(c => c.conversationId !== data.conversationId));
        };

        const handleRemovedFromGroup = (data: { conversationId: string }) => {
            setConversations(prev => prev.filter(c => c.conversationId !== data.conversationId));
        };

        const handleMemberAdded = (data: { conversationId: string, userId: string }) => {
            setConversations(prev => prev.map(c => {
                if (c.conversationId === data.conversationId) {
                    if (c.participants?.includes(data.userId)) return c;
                    return { ...c, participants: [...(c.participants || []), data.userId] };
                }
                return c;
            }));
        };

        const handleMemberRemoved = (data: { conversationId: string, userId: string }) => {
            setConversations(prev => prev.map(c => {
                if (c.conversationId === data.conversationId) {
                    return { ...c, participants: (c.participants || []).filter(id => id !== data.userId) };
                }
                return c;
            }));
        };

        socket.on('receive_message', handleReceiveMessage);
        socket.on('message_read', handleMessageRead);
        socket.on('group_created', handleGroupCreated);
        socket.on('group_deleted', handleGroupDeleted);
        socket.on('removed_from_group', handleRemovedFromGroup);
        socket.on('member_added', handleMemberAdded);
        socket.on('member_removed', handleMemberRemoved);

        return () => {
            socket.off('receive_message', handleReceiveMessage);
            socket.off('message_read', handleMessageRead);
            socket.off('group_created', handleGroupCreated);
            socket.off('group_deleted', handleGroupDeleted);
            socket.off('removed_from_group', handleRemovedFromGroup);
            socket.off('member_added', handleMemberAdded);
            socket.off('member_removed', handleMemberRemoved);
        };
    }, [socket, selectedConversationId]);

    // Online Status Tracking
    useEffect(() => {
        if (!socket) return;

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
    }, [onlineUsers, lastSeenMap, onOnlineStatusChange]);

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

    const handleCreateGroup = (name: string, members: string[]) => {
        if (!socket) return;
        socket.emit('create_group', { name, members }, (response: any) => {
            if (response.success) {
                // Success: Sidebar will be updated via 'group_created' listener
                fetchConversations();
            } else {
                showAlert("Group Creation Failed", response.error || "Failed to create group", 'danger');
            }
        });
    };

    const handleSearchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;

        setLoading(true);
        setError('');
        try {
            const response = await api.post('/chat/start-direct-message', {
                receiverUsername: searchTerm
            });
            const newConversation = response.data.data;

            // Add to list if not already there
            if (!conversations.find(c => c.conversationId === newConversation.conversationId)) {
                setConversations([newConversation, ...conversations]);
            }

            onSelectConversation(newConversation);
            setConversations(prev => prev.map(c =>
                c.conversationId === newConversation.conversationId
                    ? { ...c, unreadCount: 0 }
                    : c
            ));
            setSearchTerm('');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to start chat');
            setTimeout(() => setError(''), 3000);
        } finally {
            setLoading(false);
        }
    };

    const filteredConversations = conversations
        .filter(c => {
            if (c.type === 'group') return c.name?.toLowerCase().includes(searchTerm.toLowerCase());
            return c.otherUser?.username.toLowerCase().includes(searchTerm.toLowerCase());
        })
        .sort((a, b) => {
            const timeA = new Date(a.lastMessageTime).getTime();
            const timeB = new Date(b.lastMessageTime).getTime();
            return timeB - timeA;
        });

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
                        onClick={logout}
                        title="Logout"
                        className="p-2 hover:bg-red-500/10 rounded-full transition-colors hover:text-red-400"
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    </button>
                    <button
                        onClick={() => setIsCreateGroupModalOpen(true)}
                        title="New Group"
                        className="p-2 hover:bg-white/5 rounded-full transition-colors hover:text-white"
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="px-4 pb-3">
                <form onSubmit={handleSearchSubmit} className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        className={`block w-full pl-9 pr-8 py-2 bg-surface-light border ${error ? 'border-red-500' : 'border-transparent'} rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white/10 focus:ring-2 focus:ring-primary-500/20 transition-all shadow-inner`}
                        placeholder="Search or start new chat..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={loading}
                    />
                    {loading && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <svg className="animate-spin h-4 w-4 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    )}
                </form>
                {error && <p className="text-[10px] text-red-500 mt-1 px-1 animate-pulse">{error}</p>}
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar">
                <div className="space-y-1">
                    {filteredConversations.map(conversation => {
                        const isGroup = conversation.type === 'group';
                        const otherUser = conversation.otherUser;
                        const isSelected = selectedConversationId === conversation.conversationId;
                        const unreadCount = conversation.unreadCount || 0;

                        return (
                            <button
                                key={conversation.conversationId}
                                onClick={() => {
                                    onSelectConversation(conversation);
                                    setConversations(prev => prev.map(c =>
                                        c.conversationId === conversation.conversationId
                                            ? { ...c, unreadCount: 0 }
                                            : c
                                    ));
                                }}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group relative text-left
                                    ${isSelected
                                        ? 'bg-white/5 shadow-soft border-l-2 border-primary-500 rounded-l-none'
                                        : 'hover:bg-white/[0.03] border-l-2 border-transparent'
                                    }`}
                            >
                                <div className="relative shrink-0">
                                    {isGroup ? (
                                        <div className="w-12 h-12 bg-primary-600/20 rounded-2xl flex items-center justify-center text-primary-400 border border-primary-500/20">
                                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                        </div>
                                    ) : (
                                        <>
                                            <Avatar src={otherUser?.profilePicture} alt={otherUser?.username} size="lg" isOnline={otherUser ? onlineUsers.has(otherUser._id) : false} />
                                            {otherUser && onlineUsers.has(otherUser._id) && (
                                                <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-accent-emerald border-2 border-sidebar rounded-full shadow-sm"></span>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <h3 className={`font-semibold text-[13.5px] truncate ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                                            {isGroup ? conversation.name : otherUser?.username}
                                        </h3>
                                        <span className={`text-[10px] ${isSelected ? 'text-primary-400' : 'text-gray-500'}`}>
                                            {formatMessageTime(conversation.lastMessageTime)}
                                        </span>
                                    </div>
                                    <p className={`text-[12.5px] leading-tight truncate ${unreadCount > 0 && !isSelected ? 'text-white font-semibold' : isSelected ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-400'}`}>
                                        {formatSystemMessage(
                                            typeof conversation.lastMessage === 'string'
                                                ? conversation.lastMessage
                                                : conversation.lastMessage?.content || "",
                                            user?.username
                                        )}
                                    </p>
                                </div>

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

            <CreateGroupModal
                isOpen={isCreateGroupModalOpen}
                onClose={() => setIsCreateGroupModalOpen(false)}
                onCreateGroup={handleCreateGroup}
            />

            <ConfirmModal
                isOpen={alertConfig.isOpen}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                title={alertConfig.title}
                message={alertConfig.message}
                confirmText="OK"
                showCancel={false}
                type={alertConfig.type}
            />
        </div>
    );
};


export default Sidebar;
