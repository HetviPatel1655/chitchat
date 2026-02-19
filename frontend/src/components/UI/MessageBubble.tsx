import React, { useState, useEffect, useRef } from 'react';
import type { Message } from '../../types';
import Avatar from './Avatar';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { formatSystemMessage } from '../../utils/stringUtils';

interface MessageBubbleProps {
    message: Message;
    isMyMessage: boolean;
    senderName?: string;
    onPinToggle?: (messageId: string, isPinned: boolean) => void;
    onReply?: (message: Message) => void;
    onQuoteClick?: (messageId: string) => void;
    onImageClick?: (imageUrl: string) => void;
    onFileClick?: (fileUrl: string, fileName: string, fileType: string) => void;
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMyMessage, senderName, onPinToggle, onReply, onQuoteClick, onImageClick, onFileClick }) => {
    const { socket } = useSocket();
    const { user } = useAuth();
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setShowReactionPicker(false);
            }
        };

        if (showReactionPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showReactionPicker]);

    const handlePinClick = async () => {
        if (!socket) {
            console.error('❌ Socket not available for pin toggle');
            return;
        }

        console.log('📌 Toggling pin for message:', message._id, 'Current isPinned:', message.isPinned);
        socket.emit("toggle_pin_message", { messageId: message._id }, (response: any) => {
            console.log('📌 Pin toggle response:', response);
            if (response?.success && response?.data) {
                console.log('✅ Pin toggled successfully. New state:', response.data.isPinned);
                onPinToggle?.(message._id, response.data.isPinned);
            } else {
                console.error('❌ Failed to toggle pin:', response?.error);
            }
        });
    };

    const handleReactionClick = (emoji: string) => {
        if (!socket) return;
        socket.emit("add_reaction", { messageId: message._id, emoji });
        setShowReactionPicker(false);
    };

    // Get the reply sender name
    const getReplyAuthor = () => {
        if (!message.replyTo) return '';
        const sid = message.replyTo.senderId;
        if (typeof sid === 'object' && sid.username) return sid.username;
        return 'User';
    };

    // Group reactions by emoji
    const groupedReactions = (message.reactions || []).reduce((acc, reaction) => {
        if (!acc[reaction.emoji]) {
            acc[reaction.emoji] = [];
        }
        acc[reaction.emoji]?.push(reaction);
        return acc;
    }, {} as Record<string, NonNullable<typeof message.reactions>>);

    const hasReactions = Object.keys(groupedReactions).length > 0;

    if (message.messageType === 'system') {
        return (
            <div className="flex justify-center w-full my-4 animate-fade-in">
                <div className="px-4 py-1.5 rounded-full bg-slate-800/40 border border-white/5 backdrop-blur-sm">
                    <p className="text-[11px] text-gray-400 font-medium tracking-wide text-center">
                        {formatSystemMessage(message.content, user?.username)}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div id={`msg-${message._id}`} className={`flex w-full ${isMyMessage ? 'justify-end' : 'justify-start'} mb-1.5 group animate-scale-in relative transition-all duration-500`}>
            <div className={`flex max-w-[60%] ${isMyMessage ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 relative`}>

                {/* Avatar Compact for received */}
                {!isMyMessage && (
                    <div className="mb-0.5">
                        <Avatar alt={senderName} size="xs" className="opacity-80" />
                    </div>
                )}

                <div className="relative">
                    {/* Reaction Picker - Positioned above the message */}
                    {showReactionPicker && (
                        <div
                            ref={pickerRef}
                            className={`absolute -top-12 ${isMyMessage ? 'right-0' : 'left-0'} z-50 bg-[#1e293b] border border-white/10 rounded-full shadow-xl flex items-center gap-1 p-1.5 text-xl animate-scale-in origin-bottom`}
                        >
                            {REACTION_EMOJIS.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => handleReactionClick(emoji)}
                                    className="hover:bg-white/10 p-1.5 rounded-full transition-colors hover:scale-125 transform duration-200"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}

                    <div
                        className={`relative px-3.5 py-2.5 text-[14px] leading-snug break-words transition-all duration-150 rounded-[14px] ${isMyMessage ? 'rounded-br-none' : 'rounded-bl-none'} ${message.isPinned ? 'ring-2 ring-accent-emerald/40' : ''}`}
                        style={isMyMessage ? {
                            background: 'linear-gradient(135deg, #2b7de9 0%, #1a5fbe 100%)',
                            color: '#ffffff',
                            boxShadow: '0 2px 12px -2px rgba(43, 125, 233, 0.4), 0 4px 8px -4px rgba(0, 0, 0, 0.3)',
                        } : {
                            backgroundColor: '#2a3a4e',
                            color: '#E5E7EB',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 2px 10px -2px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
                        }}
                    >
                        {/* Pin Indicator */}
                        {message.isPinned && (
                            <div className="absolute -top-2 -right-2 bg-accent-emerald rounded-full px-1.5 py-0.5 shadow-glow">
                                <span className="text-sm">📌</span>
                            </div>
                        )}

                        {/* Reply Quote Block */}
                        {message.replyTo && (
                            <div
                                className="mb-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                style={{
                                    backgroundColor: isMyMessage ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                                    borderLeft: '3px solid #2dd4bf',
                                }}
                                onClick={() => onQuoteClick?.(message.replyTo!._id)}
                            >
                                <p className="text-[11px] font-semibold" style={{ color: '#2dd4bf' }}>
                                    {getReplyAuthor()}
                                </p>
                                <p className="text-[12px] truncate mt-0.5" style={{ color: isMyMessage ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)', maxWidth: '220px' }}>
                                    {message.replyTo.content}
                                </p>
                            </div>
                        )}

                        {/* Media Rendering */}
                        {message.fileUrl && (
                            <div className="mb-1.5 rounded-lg overflow-hidden relative group/media">
                                {message.messageType === 'video' ? (
                                    <video
                                        src={message.fileUrl}
                                        controls
                                        className="max-w-[260px] max-h-[300px] object-cover w-full h-auto bg-black/20"
                                    />
                                ) : message.messageType === 'image' || (!message.messageType && (message.mimeType?.startsWith('image/') || message.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i))) ? (
                                    <img
                                        src={message.fileUrl}
                                        alt={message.fileName || "Shared content"}
                                        className="max-w-[260px] max-h-[300px] object-cover w-full h-auto cursor-pointer hover:opacity-95 transition-opacity"
                                        onClick={() => onImageClick?.(message.fileUrl!)}
                                    />
                                ) : (
                                    // Generic File Card
                                    <div
                                        className="flex items-center gap-3 p-3 bg-black/20 hover:bg-black/30 transition-colors cursor-pointer min-w-[200px]"
                                        onClick={() => {
                                            const isDoc = message.fileName?.match(/\.(docx|doc|xlsx|xls|ppt|pptx)$/i);
                                            if (isDoc && onFileClick) {
                                                onFileClick(message.fileUrl!, message.fileName!, message.mimeType || 'application/octet-stream');
                                            } else {
                                                window.open(message.fileUrl, '_blank');
                                            }
                                        }}
                                    >
                                        <div className="p-2 bg-white/10 rounded-lg text-2xl">
                                            📄
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-sm font-medium truncate w-full" title={message.fileName}>
                                                {message.fileName || "Unknown File"}
                                            </span>
                                            {message.fileSize && (
                                                <span className="text-[10px] text-gray-400">
                                                    {(message.fileSize / 1024).toFixed(1)} KB
                                                </span>
                                            )}
                                        </div>
                                        <div className="ml-auto">
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}

                        <div className={`flex items-center gap-1 mt-1 text-[10px] ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                            style={{ color: isMyMessage ? 'rgba(255,255,255,0.6)' : '#6B7280' }}
                        >
                            <span>
                                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>

                            {/* Status Ticks (Only for My Messages) */}
                            {isMyMessage && (
                                <span className="ml-1 flex items-center">
                                    {/* Sent (Single White Tick) */}
                                    {message.status === 'sent' && (
                                        <svg className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.9)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}

                                    {/* Delivered (Double White Tick) */}
                                    {message.status === 'delivered' && (
                                        <div className="flex">
                                            <svg className="w-3.5 h-3.5 -mr-1.5" style={{ color: 'rgba(255,255,255,0.9)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                            </svg>
                                            <svg className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.9)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}

                                    {/* Read (Double Bright Blue Tick) */}
                                    {message.status === 'read' && (
                                        <div className="flex">
                                            <svg className="w-3.5 h-3.5 -mr-1.5" style={{ color: '#34d399' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                            </svg>
                                            <svg className="w-3.5 h-3.5" style={{ color: '#34d399' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                </span>
                            )}
                        </div>

                        {/* Reactions Display */}
                        {hasReactions && (
                            <div className={`absolute -bottom-3 ${isMyMessage ? 'left-0' : 'right-0'} flex gap-1 bg-[#1e293b] border border-white/10 rounded-full px-1.5 py-0.5 shadow-sm transform scale-90`}>
                                {Object.entries(groupedReactions).map(([emoji, reactions]) => (
                                    <div key={emoji} className="flex items-center gap-0.5 text-[11px] text-gray-300">
                                        <span>{emoji}</span>
                                        {reactions!.length > 1 && <span className="font-bold">{reactions!.length}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons - Show on Hover */}
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-transparent">
                    {/* React Button */}
                    <button
                        onClick={() => setShowReactionPicker(!showReactionPicker)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                        title="Add reaction"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </button>
                    {/* Reply Button */}
                    <button
                        onClick={() => onReply?.(message)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                        title="Reply"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                    </button>
                    {/* Pin Button */}
                    <button
                        onClick={handlePinClick}
                        className="p-1.5 hover:bg-white/10 rounded-lg"
                        title={message.isPinned ? "Unpin message" : "Pin message"}
                    >
                        <span className={`text-base ${message.isPinned ? 'text-accent-emerald' : 'text-gray-400'}`}>
                            📌
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
