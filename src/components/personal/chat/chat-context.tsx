'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { setApiData, useApi } from '@/hooks/use-api';
import { useNotifications } from '@/components/personal/notifications-provider';

export interface ConversationItem {
    studentId: string;
    /** The student's USER id: the messages API is keyed by it. */
    userId: string;
    name: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    status: string;
    lastMessage: { text: string; createdAt: string; fromMe: boolean } | null;
    unreadCount: number;
}

interface ChatContextValue {
    conversations: ConversationItem[];
    isLoading: boolean;
    isValidating: boolean;
    error: Error | undefined;
    reload: () => Promise<unknown>;
    /** Optimistic update of one inbox entry (keeps the most recent conversation first). */
    updateConversation: (studentId: string, updater: (item: ConversationItem) => ConversationItem) => void;
}

export const CONVERSATIONS_KEY = '/api/personal/conversations';
const INBOX_REFRESH_MS = 15000;

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function sortConversations(items: ConversationItem[]): ConversationItem[] {
    return [...items].sort((a, b) => {
        if (a.lastMessage && b.lastMessage) return b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt);
        if (a.lastMessage) return -1;
        if (b.lastMessage) return 1;
        return a.name.localeCompare(b.name, 'pt-BR');
    });
}

/** Owns the inbox poll for the chat layout; the list and the open conversation read from it. */
export function ChatProvider({ children }: { children: React.ReactNode }) {
    const { data, error, isLoading, isValidating, mutate } = useApi<ConversationItem[]>(CONVERSATIONS_KEY, {
        refreshInterval: INBOX_REFRESH_MS,
    });
    const { refresh: refreshNotifications } = useNotifications();
    const conversations = useMemo(() => (Array.isArray(data) ? data : []), [data]);

    // When the inbox poll finds new unread messages, update the sidebar badge right away
    // instead of waiting for the global 30s poll.
    const totalUnread = conversations.reduce((sum, item) => sum + item.unreadCount, 0);
    const previousUnreadRef = useRef<number | null>(null);
    useEffect(() => {
        if (!data) return;
        if (previousUnreadRef.current !== null && totalUnread > previousUnreadRef.current) {
            void refreshNotifications();
        }
        previousUnreadRef.current = totalUnread;
    }, [data, totalUnread, refreshNotifications]);

    const updateConversation = useCallback<ChatContextValue['updateConversation']>((studentId, updater) => {
        setApiData<ConversationItem[]>(CONVERSATIONS_KEY, (current) =>
            current ? sortConversations(current.map((item) => (item.studentId === studentId ? updater(item) : item))) : current
        );
    }, []);

    const reload = useCallback(() => mutate(), [mutate]);

    const value = useMemo<ChatContextValue>(
        () => ({ conversations, isLoading, isValidating, error, reload, updateConversation }),
        [conversations, isLoading, isValidating, error, reload, updateConversation]
    );

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
    const context = useContext(ChatContext);
    if (!context) throw new Error('useChat must be used within the chat layout (ChatProvider)');
    return context;
}
