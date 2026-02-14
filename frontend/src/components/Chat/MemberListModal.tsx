import { useState, useEffect } from 'react';
import api from '../../services/api';
import Avatar from '../UI/Avatar';
import type { User, Conversation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../UI/ConfirmModal';

interface MemberListModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversation: Conversation;
    onRemoveMember: (userId: string) => void;
}

const MemberListModal = ({ isOpen, onClose, conversation, onRemoveMember }: MemberListModalProps) => {
    const [members, setMembers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const { user: currentUser } = useAuth();
    const isOwner = conversation.ownerId === currentUser?._id;
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, userId: string }>({ isOpen: false, userId: '' });

    useEffect(() => {
        if (isOpen && conversation.participants) {
            fetchMemberDetails();
        }
    }, [isOpen, conversation.participants]);

    const fetchMemberDetails = async () => {
        setLoading(true);
        try {
            // Fetch users by IDs (the participants array in conversation)
            const response = await api.get(`/users/search?ids=${conversation.participants?.join(',')}`);
            setMembers(response.data.data || []);
        } catch (error) {
            console.error("Failed to fetch members", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = (userId: string) => {
        setConfirmModal({ isOpen: true, userId });
    };

    const confirmRemove = () => {
        const userId = confirmModal.userId;
        onRemoveMember(userId);
        setMembers(prev => prev.filter(m => m._id !== userId));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
            <div className="bg-surface-dark border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Group Members</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="max-h-80 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin h-8 w-8 border-3 border-primary-500 border-t-transparent rounded-full"></div>
                            </div>
                        ) : members.length > 0 ? (
                            members.map(member => (
                                <div
                                    key={member._id}
                                    className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5"
                                >
                                    <div className="flex items-center gap-3">
                                        <Avatar src={member.profilePicture} alt={member.username} size="sm" />
                                        <div>
                                            <p className="text-sm font-semibold text-gray-200">
                                                {member.username} {member._id === conversation.ownerId && <span className="ml-2 text-[10px] bg-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Owner</span>}
                                            </p>
                                        </div>
                                    </div>

                                    {isOwner && member._id !== currentUser?._id && (
                                        <button
                                            onClick={() => handleRemove(member._id)}
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                            title="Remove from group"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-500 py-4 italic">No members found</p>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 text-right">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmRemove}
                title="Remove Member?"
                message="Are you sure you want to remove this member from the group? They will no longer be able to see or send messages."
                confirmText="Remove"
                cancelText="Cancel"
                type="danger"
            />
        </div >
    );
};

export default MemberListModal;
