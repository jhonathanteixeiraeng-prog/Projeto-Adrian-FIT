'use client';

import { cn } from '@/lib/utils';

interface AvatarProps {
    src?: string;
    alt?: string;
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export function Avatar({ src, alt, name, size = 'md', className }: AvatarProps) {
    const sizes = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-16 h-16 text-lg',
    };

    const getInitials = (name?: string) => {
        if (!name) return '?';
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    if (src) {
        return (
            <img
                src={src}
                alt={alt || name || 'Avatar'}
                className={cn(
                    'rounded-full object-cover',
                    sizes[size],
                    className
                )}
            />
        );
    }

    return (
        <div
            className={cn(
                'rounded-full flex items-center justify-center font-semibold bg-gradient-to-br from-secondary to-accent text-white',
                sizes[size],
                className
            )}
        >
            {getInitials(name)}
        </div>
    );
}
