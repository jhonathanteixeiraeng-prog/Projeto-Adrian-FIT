'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
    children: ReactNode;
    className?: string;
    hover?: boolean;
    onClick?: () => void;
}

export function Card({ children, className, hover = false, onClick }: CardProps) {
    return (
        <div
            className={cn(
                'bg-card text-card-foreground rounded-2xl border border-border shadow-soft p-6',
                hover && 'cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
                className
            )}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

interface CardHeaderProps {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
}

export function CardHeader({ children, className, onClick }: CardHeaderProps) {
    return (
        <div
            className={cn('mb-4', className)}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

interface CardTitleProps {
    children: ReactNode;
    className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
    return (
        <h3 className={cn('text-lg font-semibold text-foreground', className)}>
            {children}
        </h3>
    );
}

interface CardDescriptionProps {
    children: ReactNode;
    className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
    return (
        <p className={cn('text-sm text-muted-foreground mt-1', className)}>
            {children}
        </p>
    );
}

interface CardContentProps {
    children: ReactNode;
    className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
    return (
        <div className={className}>
            {children}
        </div>
    );
}

interface CardFooterProps {
    children: ReactNode;
    className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
    return (
        <div className={cn('mt-4 pt-4 border-t border-border', className)}>
            {children}
        </div>
    );
}
