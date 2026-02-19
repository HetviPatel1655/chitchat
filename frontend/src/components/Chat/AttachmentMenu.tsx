import React from 'react';

interface AttachmentMenuProps {
    isOpen: boolean;
    onOptionSelect: (type: 'document' | 'photos' | 'videos' | 'audio') => void;
    onClose: () => void;
}

const AttachmentMenu: React.FC<AttachmentMenuProps> = ({ isOpen, onOptionSelect, onClose }) => {
    if (!isOpen) return null;

    const options = [
        {
            id: 'document',
            label: 'Document',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
            color: 'bg-indigo-500',
            // WhatsApp uses purple/indigo for documents
        },
        {
            id: 'photos',
            label: 'Photos',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
            color: 'bg-purple-500',
            // Purple for Photos/Gallery
        },
        {
            id: 'videos',
            label: 'Videos',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            ),
            color: 'bg-pink-500',
            // Pink for Videos
        },
        {
            id: 'audio',
            label: 'Audio',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            ),
            color: 'bg-orange-500',
            // Orange for audio
        }
    ];

    return (
        <>
            {/* Backdrop to close menu */}
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
            ></div>

            {/* Menu Popover */}
            <div className="absolute bottom-16 left-4 z-50 transform transition-all duration-300 ease-out origin-bottom-left animate-scale-in">
                <div className="flex flex-col gap-4 mb-4">
                    {/* Vertical layout for icons */}
                    <div className="flex flex-col gap-6 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
                        {options.map((opt) => (
                            <div key={opt.id} className="flex items-center gap-4 group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-xl transition-colors"
                                onClick={() => onOptionSelect(opt.id as any)}>
                                <div className={`w-12 h-12 rounded-full ${opt.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
                                    {opt.icon}
                                </div>
                                <span className="text-base font-medium text-gray-700 dark:text-gray-200">
                                    {opt.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default AttachmentMenu;
