import React, { useRef, useEffect } from 'react';

interface MediaModalProps {
    isOpen: boolean;
    mediaUrl: string | null;
    mediaType: 'image' | 'video' | null;
    onClose: () => void;
}

const MediaModal: React.FC<MediaModalProps> = ({ isOpen, mediaUrl, mediaType, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Initial play or focus handling
    useEffect(() => {
        if (isOpen && mediaType === 'video' && videoRef.current) {
            videoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
        }
    }, [isOpen, mediaType]);

    if (!isOpen || !mediaUrl) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in"
            onClick={onClose}
        >
            <div
                className="relative w-full h-full flex items-center justify-center p-4 md:p-8"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content area
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 md:top-6 md:right-6 p-2 text-white/70 hover:text-white bg-black/20 hover:bg-white/10 rounded-full transition-all z-50"
                >
                    <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Content */}
                <div
                    className="relative max-w-7xl max-h-[90vh] w-full flex items-center justify-center"
                    onClick={(e) => {
                        // Close if clicking outside the actual media (on the padding area)
                        if (e.target === e.currentTarget) onClose();
                    }}
                >
                    {mediaType === 'video' ? (
                        <video
                            ref={videoRef}
                            src={mediaUrl}
                            controls
                            autoPlay
                            playsInline
                            className="w-full h-auto max-w-full max-h-[85vh] rounded-lg shadow-2xl outline-none bg-black"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <source src={mediaUrl} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    ) : (
                        <img
                            src={mediaUrl}
                            alt="Preview"
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl select-none"
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MediaModal;
