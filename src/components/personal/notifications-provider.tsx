'use client';

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useApi } from '@/hooks/use-api';

export interface PersonalNotification {
    id: string;
    type: string;
    title: string;
    body: string;
    link: string | null;
    read: boolean;
    createdAt: string;
}

interface NotificationsPayload {
    notifications: PersonalNotification[];
    unreadMessages: number;
    unreadNotifications: number;
    unreadCount: number;
}

interface NotificationsContextValue {
    /** Latest 50 notifications except chat messages (those are counted in unreadMessages and live in the chat). */
    notifications: PersonalNotification[];
    unreadNotifications: number;
    unreadMessages: number;
    isLoading: boolean;
    error: Error | undefined;
    refresh: () => Promise<void>;
    markRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const PERSONAL_NOTIFICATIONS_KEY = '/api/personal/notifications';
// Chat messages have their own inbox and badge, so they don't take slots in the notification list.
const NOTIFICATIONS_LIST_KEY = `${PERSONAL_NOTIFICATIONS_KEY}?exclude=NEW_MESSAGE`;
const POLL_INTERVAL_MS = 30000;

/**
 * Single source of notification/unread-message counts for the whole personal area.
 * Polls every 30s only while the tab is visible and refreshes on focus.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const enabled = session?.user?.role === 'PERSONAL';
    const { data, error, isLoading, mutate } = useApi<NotificationsPayload>(
        enabled ? NOTIFICATIONS_LIST_KEY : null,
        { refreshInterval: POLL_INTERVAL_MS }
    );

    const refresh = useCallback(async () => {
        await mutate();
    }, [mutate]);

    const markRead = useCallback(
        async (id: string) => {
            const target = data?.notifications.find((item) => item.id === id);
            if (!target || target.read) return;
            await mutate(
                (current) =>
                    current && {
                        ...current,
                        notifications: current.notifications.map((item) =>
                            item.id === id ? { ...item, read: true } : item
                        ),
                        unreadNotifications:
                            target.type === 'NEW_MESSAGE'
                                ? current.unreadNotifications
                                : Math.max(0, current.unreadNotifications - 1),
                    },
                { revalidate: false }
            );
            try {
                await fetch(PERSONAL_NOTIFICATIONS_KEY, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id }),
                });
            } finally {
                await mutate();
            }
        },
        [data, mutate]
    );

    const markAllRead = useCallback(async () => {
        await mutate(
            (current) =>
                current && {
                    ...current,
                    notifications: current.notifications.map((item) => ({ ...item, read: true })),
                    unreadNotifications: 0,
                },
            { revalidate: false }
        );
        try {
            await fetch(PERSONAL_NOTIFICATIONS_KEY, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ readAll: true }),
            });
        } finally {
            await mutate();
        }
    }, [mutate]);

    const value = useMemo<NotificationsContextValue>(
        () => ({
            notifications: (data?.notifications ?? []).filter((item) => item.type !== 'NEW_MESSAGE'),
            unreadNotifications: data?.unreadNotifications ?? 0,
            unreadMessages: data?.unreadMessages ?? 0,
            isLoading,
            error,
            refresh,
            markRead,
            markAllRead,
        }),
        [data, isLoading, error, refresh, markRead, markAllRead]
    );

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
    const context = useContext(NotificationsContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationsProvider');
    }
    return context;
}
