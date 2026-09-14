import React, { useMemo } from 'react';

interface AvatarProps {
    name: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const GRADIENTS = [
    'from-red-400 to-orange-400',
    'from-orange-400 to-amber-400',
    'from-amber-400 to-yellow-400',
    'from-lime-400 to-green-400',
    'from-emerald-400 to-teal-400',
    'from-teal-400 to-cyan-400',
    'from-cyan-400 to-sky-400',
    'from-blue-400 to-indigo-400',
    'from-indigo-400 to-violet-400',
    'from-violet-400 to-purple-400',
    'from-purple-400 to-fuchsia-400',
    'from-pink-400 to-rose-400',
];

const SIZES = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
};

export const Avatar: React.FC<AvatarProps> = ({
    name,
    size = 'md',
    className = ''
}) => {
    const initials = useMemo(() => {
        return name
            .split(' ')
            .map(part => part[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }, [name]);

    const gradient = useMemo(() => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % GRADIENTS.length;
        return GRADIENTS[index];
    }, [name]);

    return (
        <div
            className={`
        ${SIZES[size]} 
        rounded-full 
        bg-gradient-to-br ${gradient} 
        flex items-center justify-center 
        text-white font-bold 
        shadow-sm 
        select-none
        ${className}
      `}
        >
            {initials}
        </div>
    );
};
