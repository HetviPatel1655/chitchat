import { useState, useEffect } from 'react';
import api from '../../services/api';
import Avatar from '../UI/Avatar';
import type { User } from '../../types';

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateGroup: (name: string, members: string[]) => void;
}

const CreateGroupModal = ({ isOpen, onClose, onCreateGroup }: CreateGroupModalProps) => {
    const [groupName, setGroupName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
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
            setSearchResults(response.data.data || []);
        } catch (error) {
            console.error("Failed to search users", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleMember = (user: User) => {
        if (selectedMembers.find(m => m._id === user._id)) {
            setSelectedMembers(selectedMembers.filter(m => m._id !== user._id));
        } else {
            setSelectedMembers([...selectedMembers, user]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupName.trim() || selectedMembers.length === 0) return;
        onCreateGroup(groupName, selectedMembers.map(m => m._id));
        resetAndClose();
    };

    const resetAndClose = () => {
        setGroupName('');
        setSearchTerm('');
        setSelectedMembers([]);
        setSearchResults([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
            <div className="bg-surface-dark border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Create New Group</h2>
                    <button onClick={resetAndClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Group Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-400 mb-2">Group Name</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-2.5 bg-surface-light border border-white/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-white placeholder-gray-500 transition-all"
                            placeholder="Enter group name..."
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                        />
                    </div>

                    {/* Member Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-400 mb-2">Add Members</label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full px-4 py-2.5 bg-surface-light border border-white/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-white placeholder-gray-500 transition-all"
                                placeholder="Search by username..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {loading && (
                                <div className="absolute right-3 top-2.5">
                                    <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                                </div>
                            )}
                        </div>

                        {/* Search Results */}
                        {searchResults.length > 0 && (
                            <div className="mt-2 max-h-40 overflow-y-auto bg-surface-light/50 rounded-xl border border-white/5 custom-scrollbar">
                                {searchResults.map(user => (
                                    <div
                                        key={user._id}
                                        onClick={() => toggleMember(user)}
                                        className="flex items-center justify-between px-4 py-2 hover:bg-white/5 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar src={user.profilePicture} alt={user.username} size="sm" />
                                            <span className="text-sm text-gray-200">{user.username}</span>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedMembers.find(m => m._id === user._id) ? 'bg-primary-500 border-primary-500' : 'border-gray-600'}`}>
                                            {selectedMembers.find(m => m._id === user._id) && (
                                                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Selected Members Chips */}
                    {selectedMembers.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1 text-left">
                            {selectedMembers.map(member => (
                                <div key={member._id} className="flex items-center gap-1.5 px-3 py-1 bg-primary-500/10 border border-primary-500/20 rounded-full text-xs text-primary-400">
                                    <span>{member.username}</span>
                                    <button
                                        type="button"
                                        onClick={() => toggleMember(member)}
                                        className="hover:text-white transition-colors"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Footer Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={resetAndClose}
                            className="flex-1 py-2.5 rounded-xl border border-white/5 text-gray-400 font-semibold hover:bg-white/5 hover:text-white transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!groupName.trim() || selectedMembers.length === 0}
                            className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-glow"
                        >
                            Create Group
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateGroupModal;
