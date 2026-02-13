import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import type { Conversation, Message } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import MessageBubble from '../UI/MessageBubble';
import Avatar from '../UI/Avatar';
import PinnedMessagesBar from '../UI/PinnedMessagesBar';

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
    const { user } = useAuth();
    const { socket } = useSocket();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Initial fetch of messages
    useEffect(() => {
        if (socket && conversation.conversationId) {
            fetchMessages();
            // Join this conversation room
            socket.emit('join_conversation', { conversationId: conversation.conversationId });

            // Mark existing messages as read when entering the chat
            // We need to mark messages sent by the OTHER user as read
            if (conversation.otherUser && user) {
                socket.emit('mark_messages_read', {
                    conversationId: conversation.conversationId,
                    senderId: conversation.otherUser._id
                });
            }
        }

        // Reset typing state when switching conversations
        setIsOtherTyping(false);
    }, [conversation.conversationId, socket, user, conversation.otherUser]);

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

        // Listen for read receipts
        const handleMessageRead = (data: { conversationId: string, messageIds: string[] }) => {
            if (data.conversationId !== conversation.conversationId) return;

            setMessages(prev => prev.map(msg =>
                data.messageIds.includes(msg._id) ? { ...msg, status: 'read' } : msg
            ));
        };

        socket.on('receive_message', handleReceiveMessage);
        socket.on('message_delivered', handleMessageDelivered);
        socket.on('message_read', handleMessageRead);

        return () => {
            socket.off('receive_message', handleReceiveMessage);
            socket.off('message_delivered', handleMessageDelivered);
            socket.off('message_read', handleMessageRead);
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
                    <Avatar
                        src={conversation.otherUser.profilePicture}
                        alt={conversation.otherUser.username}
                        size="lg"
                        isOnline={isOtherUserOnline}
                    />
                    <div className="flex flex-col justify-center items-start">
                        <h3 className="text-white font-bold text-base leading-tight text-left">
                            {conversation.otherUser.username}
                        </h3>
                        {/* Dynamic Status */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {isOtherTyping ? (
                                <span className="text-[10px] text-accent-emerald font-semibold tracking-wide italic">typing...</span>
                            ) : isOtherUserOnline ? (
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
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-4 text-gray-400">
                    <button className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </button>
                    <button className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                    </button>
                </div>
            </div>

            {/* Pinned Messages Bar */}
            <PinnedMessagesBar
                pinnedMessages={messages.filter(msg => msg.isPinned)}
                onUnpin={handlePinToggle}
                currentUserId={user?._id}
                otherUsername={conversation.otherUser.username}
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

                        return (
                            <MessageBubble
                                key={msg._id || index}
                                message={msg}
                                isMyMessage={isMyMessage}
                                senderName={isMyMessage ? user?.username : conversation.otherUser?.username}
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
                                ? (replyingTo.senderId === user?._id ? 'You' : conversation.otherUser?.username)
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
        </div>
    );
};

export default ChatWindow;
