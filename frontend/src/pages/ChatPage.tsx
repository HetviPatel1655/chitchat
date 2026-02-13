import { useState, useCallback } from 'react';
import Sidebar from '../components/Chat/Sidebar';
import ChatWindow from '../components/Chat/ChatWindow';
import type { Conversation } from '../types';

const ChatPage = () => {
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [lastSeenMap, setLastSeenMap] = useState<Map<string, string>>(new Map());

    const handleOnlineStatusChange = useCallback((online: Set<string>, lastSeen: Map<string, string>) => {
        setOnlineUsers(online);
        setLastSeenMap(lastSeen);
    }, []);

    const handleBack = () => setSelectedConversation(null);

    return (
        <div className="fixed inset-0 bg-background overflow-hidden font-sans text-gray-900 select-none">
            <div className="flex w-full h-full max-w-[1920px] mx-auto overflow-hidden">

                {/* Sidebar — hidden on mobile when a conversation is selected */}
                <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[360px] flex-col flex-shrink-0 z-20`} style={{ backgroundColor: '#060d19' }}>
                    <Sidebar
                        onSelectConversation={setSelectedConversation}
                        selectedConversationId={selectedConversation?.conversationId}
                        onOnlineStatusChange={handleOnlineStatusChange}
                    />
                </div>

                {/* Divider between sidebar and chat — visible on md+ */}
                <div className="hidden md:block w-[3px] flex-shrink-0" style={{ background: 'linear-gradient(180deg, #2dd4bf22 0%, #0d1b2a 50%, #2dd4bf22 100%)' }} />

                {/* Chat Area — hidden on mobile when no conversation is selected */}
                <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 bg-chat-pattern relative`}>
                    <div className="flex-1 flex flex-col w-full max-w-5xl mx-auto my-0 xl:my-4 xl:rounded-2xl xl:shadow-2xl overflow-hidden border-white/5 border">
                        {selectedConversation ? (
                            <ChatWindow
                                conversation={selectedConversation}
                                isOtherUserOnline={onlineUsers.has(selectedConversation.otherUser._id)}
                                otherUserLastSeen={lastSeenMap.get(selectedConversation.otherUser._id) || selectedConversation.otherUser.lastSeen}
                                onBack={handleBack}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-chat-pattern">
                                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 animate-pulse shadow-glow">
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-primary-400">
                                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">Select a Chat</h2>
                                <p className="mt-2 text-[13px] text-gray-500 max-w-xs text-center leading-relaxed">
                                    Seamlessly connect with your team. Select a workspace or direct message to start.
                                </p>
                                <div className="mt-8 flex gap-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/10"></span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/10"></span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatPage;
