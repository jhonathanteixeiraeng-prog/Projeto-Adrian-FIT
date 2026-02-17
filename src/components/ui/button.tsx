'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl';

        const variants = {
            primary: 'bg-[#F88022] text-white hover:bg-[#F88022]/90 focus:ring-[#F88022]',
            secondary: 'bg-[#F88022] text-white hover:bg-[#F88022]/90 focus:ring-[#F88022]',
            accent: 'bg-[#F88022] text-white hover:bg-[#F88022]/90 focus:ring-[#F88022]',
            outline: 'border-2 border-border bg-transparent text-foreground hover:bg-muted focus:ring-[#F88022]',
            ghost: 'bg-transparent text-foreground hover:bg-muted focus:ring-[#F88022]',
            danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
        };

        const sizes = {
            sm: 'px-3 py-1.5 text-sm',
            md: 'px-4 py-2.5 text-base',
            lg: 'px-6 py-3 text-lg',
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={disabled || loading}
                {...props}
            >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button };
