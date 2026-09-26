'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
    duration?: number;
}

interface ToastContextType {
    toasts: ToastItem[];
    addToast: (toast: Omit<ToastItem, 'id'>) => string;
    removeToast: (id: string) => void;
    toast: {
        success: (title: string, description?: string) => string;
        error: (title: string, description?: string) => string;
        warning: (title: string, description?: string) => string;
        info: (title: string, description?: string) => string;
    };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((toastData: Omit<ToastItem, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast: ToastItem = {
            id,
            duration: toastData.duration ?? 4500,
            ...toastData,
        };

        setToasts((prev) => [...prev, newToast]);
        return id;
    }, []);

    const toast = {
        success: (title: string, description?: string) =>
            addToast({ type: 'success', title, description }),
        error: (title: string, description?: string) =>
            addToast({ type: 'error', title, description }),
        warning: (title: string, description?: string) =>
            addToast({ type: 'warning', title, description }),
        info: (title: string, description?: string) =>
            addToast({ type: 'info', title, description }),
    };

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, toast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

function ToastContainer({
    toasts,
    onRemove,
}: {
    toasts: ToastItem[];
    onRemove: (id: string) => void;
}) {
    if (toasts.length === 0) return null;

    return (
        <div
            aria-live="polite"
            className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-2 sm:p-0"
        >
            {toasts.map((item) => (
                <ToastCard key={item.id} item={item} onRemove={onRemove} />
            ))}
        </div>
    );
}

function ToastCard({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
    useEffect(() => {
        if (!item.duration) return;
        const timer = setTimeout(() => {
            onRemove(item.id);
        }, item.duration);
        return () => clearTimeout(timer);
    }, [item, onRemove]);

    const getIcon = () => {
        switch (item.type) {
            case 'success':
                return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
            case 'info':
            default:
                return <Info className="w-5 h-5 text-primary shrink-0" />;
        }
    };

    const getBorderColor = () => {
        switch (item.type) {
            case 'success':
                return 'border-emerald-500/30 bg-emerald-500/5';
            case 'error':
                return 'border-red-500/30 bg-red-500/5';
            case 'warning':
                return 'border-amber-500/30 bg-amber-500/5';
            case 'info':
            default:
                return 'border-primary/30 bg-primary/5';
        }
    };

    return (
        <div
            className={cn(
                'pointer-events-auto flex items-start gap-3 p-4 rounded-2xl bg-card/95 backdrop-blur-md border shadow-xl transition-all duration-300 animate-in slide-in-from-bottom-3 fade-in',
                getBorderColor()
            )}
            role="status"
        >
            <div className="mt-0.5">{getIcon()}</div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">{item.title}</p>
                {item.description && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {item.description}
                    </p>
                )}
            </div>
            <button
                onClick={() => onRemove(item.id)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors -mr-1 -mt-1"
                aria-label="Fechar notificação"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
