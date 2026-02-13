import React from 'react';
import type { Message } from '../../types';

interface PinnedMessagesBarProps {
    pinnedMessages: Message[];
    onUnpin: (messageId: string, isPinned: boolean) => void;
    currentUserId?: string;
    otherUsername?: string;
}

const PinnedMessagesBar: React.FC<PinnedMessagesBarProps> = ({
    pinnedMessages
}) => {
    if (pinnedMessages.length === 0) return null;

    return (
        <div className="bg-accent-emerald/5 border-b border-accent-emerald/20">
            {pinnedMessages.map((message) => (
                <div
                    key={message._id}
                    className="flex items-center gap-3 px-5 py-2 hover:bg-accent-emerald/10 transition-colors"
                >
                    {/* Pin Icon */}
                    <span className="text-accent-emerald text-sm flex-shrink-0">📌</span>

                    {/* Message Content - Left aligned */}
                    <p className="flex-1 text-sm text-gray-200 truncate text-left">
                        {message.content}
                    </p>

                    {/* Timestamp - Right aligned */}
                    <span className="text-xs text-gray-500 flex-shrink-0">
                        {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                </div>
            ))}
        </div>
    );
};

export default PinnedMessagesBar;
