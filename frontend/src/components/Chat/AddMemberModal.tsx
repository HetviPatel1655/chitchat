import { useState, useEffect } from 'react';
import api from '../../services/api';
import Avatar from '../UI/Avatar';
import type { User, Conversation } from '../../types';

interface AddMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversation: Conversation;
    onAddMember: (userId: string) => void;
}

const AddMemberModal = ({ isOpen, onClose, conversation, onAddMember }: AddMemberModalProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchTerm.trim()) {
                handleSearch();
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/users/search?term=${searchTerm}`);
            // Filter out existing members
            const existingMemberIds = conversation.participants || [];
            const results = (response.data.data || []).filter((u: User) => !existingMemberIds.includes(u._id));
            setSearchResults(results);
        } catch (error) {
            console.error("Failed to search users", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = (userId: string) => {
        onAddMember(userId);
        onClose();
        setSearchTerm('');
        setSearchResults([]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
            <div className="bg-surface-dark border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Add Member to "{conversation.name}"</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-400 mb-2">Search User</label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full px-4 py-2.5 bg-surface-light border border-white/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-white placeholder-gray-500 transition-all"
                                placeholder="Search by username..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                            {loading && (
                                <div className="absolute right-3 top-2.5">
                                    <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                                </div>
                            )}
                        </div>

                        {/* Search Results */}
                        <div className="mt-4 max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                            {searchResults.length > 0 ? (
                                searchResults.map(user => (
                                    <div
                                        key={user._id}
                                        className="flex items-center justify-between px-4 py-3 hover:bg-white/5 rounded-xl transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar src={user.profilePicture} alt={user.username} size="sm" />
                                            <div>
                                                <p className="text-sm font-semibold text-gray-200">{user.username}</p>
                                                <p className="text-[11px] text-gray-500">{user.email}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleAdd(user._id)}
                                            className="px-3 py-1.5 bg-primary-600/10 text-primary-400 text-xs font-bold rounded-lg border border-primary-500/20 hover:bg-primary-600 hover:text-white transition-all"
                                        >
                                            Add
                                        </button>
                                    </div>
                                ))
                            ) : searchTerm.trim() && !loading ? (
                                <p className="text-center py-4 text-gray-500 text-sm">No new users found</p>
                            ) : (
                                <p className="text-center py-4 text-gray-500 text-sm">Search for a user to add</p>
                            )}
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={onClose}
                            className="w-full py-2.5 rounded-xl border border-white/5 text-gray-400 font-semibold hover:bg-white/5 hover:text-white transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddMemberModal;
