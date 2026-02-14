import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import type { Conversation, Message } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import MessageBubble from '../UI/MessageBubble';
import Avatar from '../UI/Avatar';
import PinnedMessagesBar from '../UI/PinnedMessagesBar';
import AddMemberModal from './AddMemberModal';
import MemberListModal from './MemberListModal';
import ConfirmModal from '../UI/ConfirmModal';

interface ChatWindowProps {
    conversation: Conversation;
    isOtherUserOnline?: boolean;
    otherUserLastSeen?: string;
    onBack?: () => void;
}

const ChatWindow = ({ conversation, isOtherUserOnline = false, otherUserLastSeen, onBack }: ChatWindowProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [participants, setParticipants] = useState<string[]>(conversation.participants || []);
    const { user } = useAuth();
    const { socket } = useSocket();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [isMemberListModalOpen, setIsMemberListModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm?: () => void;
        type?: 'danger' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
    });

    const showAlert = (title: string, message: string, type: 'danger' | 'info' = 'info', onConfirm?: () => void) => {
        setAlertConfig({ isOpen: true, title, message, type, onConfirm });
    };

    useEffect(() => {
        setParticipants(conversation.participants || []);
    }, [conversation.conversationId, conversation.participants]);

    // Initial fetch of messages
    useEffect(() => {
        if (socket && conversation.conversationId) {
            fetchMessages();
            // Join this conversation room
            socket.emit('join_conversation', { conversationId: conversation.conversationId });

            // Mark existing messages as read when entering the chat
            // We need to mark messages sent by OTHERS as read
            if (conversation.type === 'direct' && conversation.otherUser && user) {
                socket.emit('mark_messages_read', {
                    conversationId: conversation.conversationId,
                    senderId: conversation.otherUser._id
                });
            } else if (conversation.type === 'group' && user) {
                // For groups, we could mark all as read OR track per-message. 
                // Simple implementation: emit generic read event for the room
                socket.emit('mark_messages_read', {
                    conversationId: conversation.conversationId
                });
            }
        }

        // Reset typing state when switching conversations
        setIsOtherTyping(false);
    }, [conversation.conversationId, socket, user, conversation.otherUser, conversation.type]);

    // Listen for typing indicator
    useEffect(() => {
        if (!socket) return;

        const handleUserTyping = (data: { userId: string; conversationId: string; isTyping: boolean }) => {
            if (data.conversationId !== conversation.conversationId) return;
            if (data.userId === user?._id) return; // Ignore own typing

            setIsOtherTyping(data.isTyping);

            // Safety timeout: auto-clear after 3s in case stop event is lost
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (data.isTyping) {
                typingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), 3000);
            }
        };

        socket.on('user_typing', handleUserTyping);
        return () => {
            socket.off('user_typing', handleUserTyping);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [socket, conversation.conversationId, user?._id]);

    // Listen for incoming messages and status updates
    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = (data: any) => { // Changed message to data to match instruction
            if (data.conversationId === conversation.conversationId) {
                setMessages(prev => {
                    if (prev.find(m => m._id === data._id)) return prev;
                    return [...prev, data];
                });

                // If I am in this chat and receive a message, mark it as read immediately
                // Only if the message is NOT from me
                if (data.senderId !== user?._id) {
                    socket.emit('mark_messages_read', {
                        conversationId: conversation.conversationId,
                        senderId: data.senderId
                    });
                }

                scrollToBottom();
            }
        };

        // Listen for message status updates (Delivered)
        const handleMessageDelivered = (data: { messageId: string, conversationId: string }) => {
            if (data.conversationId !== conversation.conversationId) return;

            setMessages(prev => prev.map(msg =>
                msg._id === data.messageId ? { ...msg, status: 'delivered' } : msg
            ));
        };

        const handleReadMessages = (data: { conversationId: string, messageIds: string[] }) => {
            if (data.conversationId !== conversation.conversationId) return;

            setMessages(prev => prev.map(msg =>
                data.messageIds.includes(msg._id) ? { ...msg, status: 'read' } : msg
            ));
        };

        const handleMemberAdded = (data: { conversationId: string, userId: string }) => {
            if (data.conversationId === conversation.conversationId) {
                setParticipants(prev => {
                    if (prev.includes(data.userId)) return prev;
                    return [...prev, data.userId];
                });
            }
        };

        const handleMemberRemoved = (data: { conversationId: string, userId: string }) => {
            if (data.conversationId === conversation.conversationId) {
                setParticipants(prev => prev.filter(id => id !== data.userId));
            }
        };

        const handleRemovedFromGroup = (data: { conversationId: string }) => {
            if (data.conversationId === conversation.conversationId) {
                showAlert(
                    "Removed from Group",
                    "You have been removed from this group by the owner.",
                    'danger',
                    () => window.location.reload()
                );
            }
        };

        const handleGroupDeleted = (data: { conversationId: string }) => {
            if (data.conversationId === conversation.conversationId) {
                showAlert(
                    "Group Deleted",
                    "This group has been deleted by the owner.",
                    'danger',
                    () => window.location.reload()
                );
            }
        };

        socket.on('receive_message', handleReceiveMessage);
        socket.on('message_delivered', handleMessageDelivered);
        socket.on('message_read', handleReadMessages);
        socket.on('removed_from_group', handleRemovedFromGroup);
        socket.on('group_deleted', handleGroupDeleted);
        socket.on('member_added', handleMemberAdded);
        socket.on('member_removed', handleMemberRemoved);

        return () => {
            socket.off('receive_message', handleReceiveMessage);
            socket.off('message_delivered', handleMessageDelivered);
            socket.off('message_read', handleReadMessages);
            socket.off('removed_from_group', handleRemovedFromGroup);
            socket.off('group_deleted', handleGroupDeleted);
            socket.off('member_added', handleMemberAdded);
            socket.off('member_removed', handleMemberRemoved);
        };
    }, [socket, conversation.conversationId, user?._id]);

    // Listen for pin/unpin events
    useEffect(() => {
        if (!socket) return;

        const handleMessagePinned = (data: { messageId: string; conversationId: string; isPinned: boolean }) => {
            console.log('Received message_pinned event:', data);
            if (data.conversationId === conversation.conversationId) {
                console.log('Updating message pin state for:', data.messageId, 'to:', data.isPinned);
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg._id === data.messageId ? { ...msg, isPinned: data.isPinned } : msg
                    )
                );
            } else {
                console.log('Ignoring pin event for different conversation');
            }
        };

        socket.on('message_pinned', handleMessagePinned);

        return () => {
            socket.off('message_pinned', handleMessagePinned);
        };
    }, [socket, conversation.conversationId]);

    const fetchMessages = async () => {
        try {
            const response = await api.get(`/chat/messages/${conversation.conversationId}`);
            const msgs = response.data.data.messages.map((msg: any) => ({
                ...msg,
                replyTo: msg.replyToId || undefined,
                replyToId: undefined,
            }));
            setMessages(msgs);
            scrollToBottom();
        } catch (err) {
            console.error("Failed to fetch messages", err);
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const handlePinToggle = (messageId: string, isPinned: boolean) => {
        setMessages((prev) =>
            prev.map((msg) => (msg._id === messageId ? { ...msg, isPinned } : msg))
        );
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !socket) return;

        // Stop typing indicator on send
        if (debounceRef.current) clearTimeout(debounceRef.current);
        socket.emit('typing', { conversationId: conversation.conversationId, isTyping: false });

        // Capture before clearing
        const currentReply = replyingTo;
        setReplyingTo(null);

        socket.emit('send_message', {
            conversationId: conversation.conversationId,
            content: newMessage,
            ...(currentReply && { replyToId: currentReply._id })
        }, (response: any) => {
            if (response.success) {
                const msg: Message = {
                    _id: response.messageId,
                    conversationId: conversation.conversationId,
                    senderId: user!._id,
                    content: newMessage,
                    status: 'sent',
                    timestamp: new Date().toISOString(),
                    ...(currentReply && {
                        replyTo: {
                            _id: currentReply._id,
                            content: currentReply.content,
                            senderId: currentReply.senderId
                        }
                    })
                };

                setMessages(prev => {
                    if (prev.find(m => m._id === msg._id)) return prev;
                    return [...prev, msg];
                });

                setNewMessage('');
                scrollToBottom();
            }
        });
    };

    const handleAddMember = (userIdToAdd: string) => {
        if (!socket) return;
        socket.emit('add_to_group', {
            conversationId: conversation.conversationId,
            userId: userIdToAdd
        }, (response: any) => {
            if (!response.success) {
                alert("Failed to add member: " + (response.error || "Unknown error"));
            }
        });
    };

    const handleRemoveMember = (targetUserId: string) => {
        if (!socket) return;
        socket.emit("remove_from_group", { conversationId: conversation.conversationId, userId: targetUserId }, (response: any) => {
            if (!response.success) {
                showAlert("Action Failed", response.error || "Failed to remove member", 'danger');
            }
        });
    };

    const handleDeleteGroup = () => {
        if (!socket) return;
        socket.emit("delete_group", { conversationId: conversation.conversationId }, (response: any) => {
            if (response.success) {
                // If onBack is provided (mobile), call it to go back to sidebar
                if (onBack) {
                    onBack();
                } else {
                    // Force a reload or navigation to clear the chat view
                    window.location.reload();
                }
            } else {
                showAlert("Deletion Failed", response.error || "Failed to delete group", 'danger');
            }
            setIsDeleteConfirmOpen(false); // Close modal after action
        });
    };

    return (
        <div className="flex flex-col h-full min-h-0 relative bg-chat-pattern overflow-hidden">
            {/* Header - Elevated with depth shadow */}
            <div className="px-5 py-3 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md" style={{ backgroundColor: '#0a1628', borderBottom: '2px solid rgba(45, 212, 191, 0.15)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                <div className="flex items-center gap-2 cursor-pointer">
                    {/* Back button - visible on mobile only */}
                    {onBack && (
                        <button onClick={onBack} className="md:hidden p-1.5 -ml-1 text-gray-400 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
                        </button>
                    )}
                    {conversation.type === 'group' ? (
                        <div className="w-12 h-12 bg-primary-600/20 rounded-2xl flex items-center justify-center text-primary-400 border border-primary-500/20">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        </div>
                    ) : (
                        <Avatar
                            src={conversation.otherUser?.profilePicture}
                            alt={conversation.otherUser?.username}
                            size="lg"
                            isOnline={isOtherUserOnline}
                        />
                    )}
                    <div className="flex flex-col justify-center items-start">
                        <h3 className="text-white font-bold text-base leading-tight text-left">
                            {conversation.type === 'group' ? conversation.name : conversation.otherUser?.username}
                        </h3>
                        {/* Dynamic Status */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {isOtherTyping ? (
                                <span className="text-[10px] text-accent-emerald font-semibold tracking-wide italic">typing...</span>
                            ) : conversation.type === 'direct' ? (
                                isOtherUserOnline ? (
                                    <>
                                        <span className="w-1.5 h-1.5 bg-accent-emerald rounded-full animate-pulse shadow-[0_0_4px_rgba(16,185,129,0.5)]"></span>
                                        <span className="text-[10px] text-accent-emerald font-bold tracking-wide uppercase">Online</span>
                                    </>
                                ) : (
                                    <span className="text-[10px] text-gray-400 tracking-wide">
                                        {otherUserLastSeen
                                            ? `Last seen ${new Date(otherUserLastSeen).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                                            : 'Offline'
                                        }
                                    </span>
                                )
                            ) : (
                                <button
                                    onClick={() => setIsMemberListModalOpen(true)}
                                    className="text-[10px] text-gray-400 tracking-wide hover:text-primary-400 transition-colors"
                                >
                                    {participants.length} members
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 text-gray-400">
                    {conversation.type === 'group' && conversation.ownerId === user?._id && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsAddMemberModalOpen(true)}
                                className="p-2 hover:bg-white/5 rounded-full transition-colors text-primary-400"
                                title="Add Member"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                            </button>
                            <button
                                onClick={() => setIsDeleteConfirmOpen(true)}
                                className="p-2 hover:bg-red-500/10 rounded-full transition-colors text-red-400"
                                title="Delete Group"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    )}
                    <button className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </button>
                    <button className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                    </button>
                </div>
            </div>

            {/* Pinned Messages Bar */}
            <PinnedMessagesBar
                pinnedMessages={messages.filter(msg => msg.isPinned)}
                onUnpin={handlePinToggle}
                currentUserId={user?._id}
                otherUsername={conversation.type === 'group' ? (conversation.name || 'Group') : (conversation.otherUser?.username || 'User')}
            />

            {/* Messages Area - High Density with Pattern */}
            <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar bg-chat-pattern">
                <div className="flex flex-col gap-0.5 max-w-4xl mx-auto w-full">
                    {/* Compact Date Separator */}
                    <div className="flex justify-center mb-6">
                        <span className="text-[10px] text-gray-400 px-3 py-1 bg-white/5 rounded-md uppercase tracking-[1.5px] font-bold border border-white/5 backdrop-blur-sm">Today</span>
                    </div>

                    {messages.map((msg, index) => {
                        const isMyMessage = typeof msg.senderId === 'string'
                            ? msg.senderId === user?._id
                            : (msg.senderId as any)?._id === user?._id;

                        // For group chats, we should ideally have the sender's username populated.
                        // If it's a string ID, we fallback to 'Member' for now if not me.
                        const senderName = isMyMessage
                            ? user?.username
                            : (typeof msg.senderId === 'object' ? (msg.senderId as any).username : (conversation.otherUser?.username || 'Member'));

                        return (
                            <MessageBubble
                                key={msg._id || index}
                                message={msg}
                                isMyMessage={isMyMessage}
                                senderName={senderName}
                                onPinToggle={handlePinToggle}
                                onReply={(m) => { setReplyingTo(m); inputRef.current?.focus(); }}
                                onQuoteClick={(id) => {
                                    const el = document.getElementById(`msg-${id}`);
                                    if (el) {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        el.classList.add('ring-2', 'ring-primary-400/50');
                                        setTimeout(() => el.classList.remove('ring-2', 'ring-primary-400/50'), 2000);
                                    }
                                }}
                            />
                        );
                    })}


                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Reply Preview Bar */}
            {replyingTo && (
                <div className="px-6 py-2.5 flex items-center gap-3" style={{ backgroundColor: '#111d2e', borderTop: '1px solid rgba(45, 212, 191, 0.1)' }}>
                    <div className="flex-1 px-3 py-1.5 rounded-lg" style={{ borderLeft: '3px solid #2dd4bf', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                        <p className="text-[11px] font-semibold text-left" style={{ color: '#2dd4bf' }}>
                            {typeof replyingTo.senderId === 'string'
                                ? (replyingTo.senderId === user?._id ? 'You' : (conversation.type === 'group' ? 'Member' : conversation.otherUser?.username))
                                : (replyingTo.senderId as any)?.username || 'User'
                            }
                        </p>
                        <p className="text-[12px] text-gray-400 truncate text-left" style={{ maxWidth: '400px' }}>
                            {replyingTo.content}
                        </p>
                    </div>
                    <button
                        onClick={() => setReplyingTo(null)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Input Area - Elevated with depth */}
            <div className="px-6 py-4 z-10 w-full" style={{ backgroundColor: '#0a1628', borderTop: '2px solid rgba(255,255,255,0.06)', boxShadow: '0 -4px 20px rgba(0,0,0,0.3)' }}>
                <div className="max-w-4xl mx-auto w-full relative">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                        {/* Attachment Button */}
                        <button type="button" className="p-2.5 text-gray-500 hover:text-primary-400 hover:bg-white/5 rounded-xl transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                        </button>

                        {/* Input Field (Pill Shape) */}
                        <div className="flex-1 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full h-11 px-5 bg-surface-dark border border-white/5 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500/50 text-[14px] text-gray-100 placeholder-gray-500 transition-all shadow-inner"
                                placeholder="Type a message..."
                                value={newMessage}
                                onChange={(e) => {
                                    setNewMessage(e.target.value);
                                    // Emit typing indicator with debounce
                                    if (socket && e.target.value.length > 0) {
                                        socket.emit('typing', { conversationId: conversation.conversationId, isTyping: true });
                                        if (debounceRef.current) clearTimeout(debounceRef.current);
                                        debounceRef.current = setTimeout(() => {
                                            socket.emit('typing', { conversationId: conversation.conversationId, isTyping: false });
                                        }, 2000);
                                    } else if (socket) {
                                        // Input cleared — stop typing immediately
                                        if (debounceRef.current) clearTimeout(debounceRef.current);
                                        socket.emit('typing', { conversationId: conversation.conversationId, isTyping: false });
                                    }
                                }}
                            />
                            {/* Emoji Button Inside Input */}
                            <button type="button" className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 text-gray-500 hover:text-primary-400 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </button>
                        </div>

                        {/* Send Button */}
                        <button
                            type="submit"
                            disabled={!newMessage.trim()}
                            className={`h-11 w-11 flex items-center justify-center rounded-xl shadow-md transform transition-all duration-200 
                                ${newMessage.trim()
                                    ? 'bg-primary-600 text-white hover:bg-primary-500 hover:scale-[1.05] shadow-glow'
                                    : 'bg-white/5 text-gray-600 cursor-not-allowed'}
                            `}
                        >
                            <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                        </button>
                    </form>
                </div>
            </div>
            {/* Add Member Modal */}
            <AddMemberModal
                isOpen={isAddMemberModalOpen}
                onClose={() => setIsAddMemberModalOpen(false)}
                conversation={conversation}
                onAddMember={handleAddMember}
            />

            <MemberListModal
                isOpen={isMemberListModalOpen}
                onClose={() => setIsMemberListModalOpen(false)}
                conversation={{ ...conversation, participants }}
                onRemoveMember={handleRemoveMember}
            />

            <ConfirmModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleDeleteGroup}
                title="Delete Group?"
                message="Are you SURE you want to delete this group? All messages and data will be permanently removed for EVERYONE. This action cannot be undone."
                confirmText="Delete Group"
                cancelText="Keep Group"
                type="danger"
            />

            <ConfirmModal
                isOpen={alertConfig.isOpen}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={alertConfig.onConfirm || (() => { })}
                title={alertConfig.title}
                message={alertConfig.message}
                confirmText="OK"
                showCancel={false}
                type={alertConfig.type}
            />
        </div>
    );
};

export default ChatWindow;
