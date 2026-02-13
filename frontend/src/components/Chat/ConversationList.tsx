import { useState, useEffect } from 'react';
import api from '../../services/api';
import type { Conversation } from '../../types';
//import type { Conversation } from '../../types';
// import { useAuth } from '../../context/AuthContext'; // Removed unused

interface ConversationListProps {
    onSelectConversation: (conversation: Conversation) => void;
    selectedConversationId?: string;
}

const ConversationList = ({ onSelectConversation, selectedConversationId }: ConversationListProps) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [newChatUsername, setNewChatUsername] = useState('');
    const [error, setError] = useState('');
    // const { user } = useAuth(); // Removed unused user
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchConversations();
    }, []);

    const fetchConversations = async () => {
        try {
            const response = await api.get('/chat/conversations');
            console.log("Fetched Conversations:", response.data);
            if (Array.isArray(response.data.data)) {
                setConversations(response.data.data);
            } else {
                console.warn("Conversations data is not an array:", response.data.data);
                setConversations([]);
            }
        } catch (err) {
            console.error("Failed to fetch conversations", err);
        }
    };

    const startNewChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newChatUsername.trim()) return;

        setLoading(true);
        setError('');
        try {
            const response = await api.post('/chat/start-direct-message', {
                receiverUsername: newChatUsername
            });
            const newConversation = response.data.data;

            // Add to list if not already there
            if (!conversations.find(c => c.conversationId === newConversation.conversationId)) {
                setConversations([newConversation, ...conversations]);
            }

            onSelectConversation(newConversation);
            setNewChatUsername('');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to start chat');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#f0f2f5] border-r border-[#d1d7db] shrink-0 h-[60px]">
                <div className="cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden ring-1 ring-white">
                        {/* Default User Icon */}
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-[#cfd8dc] bg-[#dfe5e7]">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                    </div>
                </div>
                <div className="flex gap-5 text-[#54656f]">
                    {/* Status Icon */}
                    <button title="Status" className="rounded-full">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12.001 5.5A6.5 6.5 0 1 1 5.501 12a6.508 6.508 0 0 1 6.5-6.501zm5.922 6.5a5.922 5.922 0 1 0-11.845 0 5.922 5.922 0 0 0 11.845 0zM12.001 2a10 10 0 1 1-10 10 10.011 10.011 0 0 1 10-10zm.065 1.545a8.455 8.455 0 1 0 8.39 8.455 8.465 8.465 0 0 0-8.39-8.455zM12.001 0a12 12 0 1 0 12 12 12.013 12.013 0 0 0-12-12z" /></svg>
                    </button>
                    {/* New Chat Icon */}
                    <button title="New Chat" className="rounded-full">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19.005 3.175H4.674C3.642 3.175 3 3.789 3 4.821V21.02l3.544-3.514h12.461c1.033 0 2.064-1.06 2.064-2.093V4.821c-.001-1.032-1.032-1.646-2.064-1.646zm-4.989 9.869H6.666a.664.664 0 0 1 0-1.328h7.35a.664.664 0 0 1 0 1.328zM19 8.649H6.666a.664.664 0 0 1 0-1.328H19a.664.664 0 0 1 0 1.328z" /></svg>
                    </button>
                    {/* Menu Icon */}
                    <button title="Menu" className="rounded-full">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z" /></svg>
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="border-b border-[#f0f2f5] bg-white p-2">
                {/* Reusing existing form logic but styling it */}
                <form onSubmit={startNewChat} className="flex items-center bg-[#f0f2f5] rounded-lg px-3 py-1.5 gap-3">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="text-[#54656f] w-5 h-5">
                        <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.254l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.008zm-4.608 0a3.605 3.605 0 1 1 0-7.21 3.605 3.605 0 0 1 0 7.21z"></path>
                    </svg>
                    <input
                        type="text"
                        placeholder="Search or start new chat"
                        className="flex-1 bg-transparent border-none outline-none text-sm text-[#3b4a54] placeholder:text-[#54656f]"
                        value={newChatUsername}
                        onChange={(e) => setNewChatUsername(e.target.value)}
                    />
                    {/* Hidden submit but accessible via Enter */}
                    <button type="submit" hidden disabled={loading}></button>
                </form>
                {error && <p className="text-red-500 text-xs px-2 mt-1">{error}</p>}
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {conversations.map(conversation => {
                    const otherUser = conversation.otherUser;
                    const isSelected = selectedConversationId === conversation.conversationId;

                    return (
                        <div
                            key={conversation.conversationId}
                            onClick={() => onSelectConversation(conversation)}
                            className={`flex items-center gap-3 p-3 mb-1 rounded-xl cursor-pointer transition-all duration-200 
                                ${isSelected
                                    ? 'bg-emerald-50 border-l-4 border-primary shadow-sm'
                                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                                }`}
                        >
                            {/* Avatar */}
                            <div className={`w-12 h-12 rounded-full flex-shrink-0 overflow-hidden border-2 ${isSelected ? 'border-primary' : 'border-gray-100'}`}>
                                <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-500">
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                    </svg>
                                </div>
                            </div>

                            {/* Text Content */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h3 className={`font-medium text-[16px] truncate ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                                        {otherUser?.username || 'Unknown User'}
                                    </h3>
                                    {/* Placeholder for time */}
                                    {/* <span className="text-xs text-slate-400">10:30 AM</span> */}
                                </div>
                                <p className={`text-[14px] truncate flex items-center gap-1 ${isSelected ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                                    {typeof conversation.lastMessage === 'string' ? conversation.lastMessage : conversation.lastMessage?.content}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ConversationList;
