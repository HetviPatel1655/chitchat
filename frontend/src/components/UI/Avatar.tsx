import React from 'react';

interface AvatarProps {
    src?: string;
    alt?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    isOnline?: boolean;
    className?: string;
}

const Avatar: React.FC<AvatarProps> = ({
    src,
    alt = 'User',
    size = 'md',
    isOnline = false,
    className = ''
}) => {
    const sizeClasses = {
        xs: 'w-7 h-7',
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
        xl: 'w-16 h-16'
    };

    const fontSizeClasses = {
        xs: 'text-[10px]',
        sm: 'text-[12px]',
        md: 'text-[14px]',
        lg: 'text-[18px]',
        xl: 'text-[24px]'
    };

    const statusSizeClasses = {
        xs: 'w-1.5 h-1.5',
        sm: 'w-2 h-2',
        md: 'w-2.5 h-2.5',
        lg: 'w-3 h-3',
        xl: 'w-4 h-4'
    };

    return (
        <div className={`relative inline-block ${className}`}>
            <div className={`${sizeClasses[size]} rounded-full overflow-hidden ring-1 ring-white/10 bg-surface-light flex items-center justify-center`}>
                {src ? (
                    <img src={src} alt={alt} className="w-full h-full object-cover" />
                ) : (
                    <span className={`font-semibold text-gray-400 uppercase ${fontSizeClasses[size]}`}>
                        {alt.charAt(0)}
                    </span>
                )}
            </div>
            {isOnline && (
                <span className={`absolute bottom-0 right-0 block ${statusSizeClasses[size]} rounded-full ring-1 ring-background bg-accent-emerald`} />
            )}
        </div>
    );
};

export default Avatar;
