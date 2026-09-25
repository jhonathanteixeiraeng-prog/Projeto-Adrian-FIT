'use client';

import { useCallback, useMemo } from 'react';
import { useLocalStorageState } from '@/hooks/use-local-storage';

/** Per-browser chat preferences (also editable in Configurações). */
export const CHAT_ENTER_SENDS_KEY = 'personal:chat-enter-sends';
export const CHAT_CONTEXT_PANEL_KEY = 'personal:chat-context-panel';
export const QUICK_REPLIES_KEY = 'personal:chat-quick-replies';

export const DEFAULT_QUICK_REPLIES = [
    'Oi {nome}, tudo bem? 😊',
    'Bom treino hoje, {nome}! 💪',
    'Não esqueça de enviar seu check-in desta semana 📋',
    'Como está a dieta essa semana?',
    'Atualizei seu treino no app, dá uma olhada!',
    'Lembre-se de beber água ao longo do dia 💧',
    'Qualquer dúvida, estou por aqui!',
];

export const MAX_QUICK_REPLIES = 12;

/** Enter sends (Shift+Enter breaks the line). When off, Enter breaks the line and ⌘/Ctrl+Enter sends. */
export function useEnterSends() {
    return useLocalStorageState<boolean>(CHAT_ENTER_SENDS_KEY, true);
}

/** Student panel on the right of the conversation (wide screens). */
export function useContextPanelOpen() {
    return useLocalStorageState<boolean>(CHAT_CONTEXT_PANEL_KEY, true);
}

export function sanitizeQuickReplies(value: unknown): string[] {
    if (!Array.isArray(value)) return DEFAULT_QUICK_REPLIES;
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, MAX_QUICK_REPLIES);
}

export function useQuickReplies(): [string[], (next: string[]) => void] {
    const [stored, setStored] = useLocalStorageState<unknown>(QUICK_REPLIES_KEY, DEFAULT_QUICK_REPLIES);
    const replies = useMemo(() => sanitizeQuickReplies(stored), [stored]);
    const update = useCallback((next: string[]) => setStored(sanitizeQuickReplies(next)), [setStored]);
    return [replies, update];
}

export const firstNameOf = (name: string | null | undefined) => (name || '').trim().split(/\s+/)[0] || '';

/** Replaces {nome} with the student's first name. */
export function fillQuickReply(template: string, studentName: string | null | undefined): string {
    const first = firstNameOf(studentName);
    // Without a name, "Oi {nome}, tudo bem?" becomes "Oi, tudo bem?" instead of "Oi , tudo bem?".
    return template
        .replace(/\{nome\}/gi, first)
        .replace(/[ \t]+([,!?.])/g, '$1')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}
