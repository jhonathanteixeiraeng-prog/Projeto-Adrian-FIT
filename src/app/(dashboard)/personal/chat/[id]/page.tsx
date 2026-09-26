'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Dumbbell, Loader2, PanelRightClose, PanelRightOpen, Phone, RefreshCw, Utensils } from 'lucide-react';
import { Avatar, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { personalLinks } from '@/lib/notifications';
import { usePageMeta } from '@/components/personal/page-meta';
import { rememberRecentStudent } from '@/components/personal/command-palette';
import { useNotifications } from '@/components/personal/notifications-provider';
import { useChat, type ConversationItem } from '@/components/personal/chat/chat-context';
import { useChatMessages } from '@/components/personal/chat/use-chat-messages';
import { MessageList } from '@/components/personal/chat/message-list';
import { Composer } from '@/components/personal/chat/composer';
import { StudentContextPanel } from '@/components/personal/chat/student-context-panel';
import { firstNameOf, useContextPanelOpen } from '@/components/personal/chat/preferences';
import { studentPaths, whatsappHref } from '@/components/personal/chat/contact';

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Aluno ativo', PAUSED: 'Aluno pausado', INACTIVE: 'Aluno inativo' };

const iconButtonClass =
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:min-h-0 lg:min-w-0';

function Conversation({ conversation }: { conversation: ConversationItem }) {
    const { toast } = useToast();
    const { refresh: refreshNotifications } = useNotifications();
    const { updateConversation } = useChat();
    const [isPanelOpen, setIsPanelOpen] = useContextPanelOpen();
    const { studentId, userId, name, avatar, phone, email, status } = conversation;
    const whatsapp = whatsappHref(phone);

    const chat = useChatMessages(userId, {
        onOpened: () => {
            // Loading the conversation marked it as read: update the inbox and the sidebar badge now.
            updateConversation(studentId, (item) => ({ ...item, unreadCount: 0 }));
            void refreshNotifications();
        },
        onIncoming: (incoming) => {
            const latest = incoming[incoming.length - 1];
            updateConversation(studentId, (item) => ({
                ...item,
                unreadCount: 0,
                lastMessage:
                    !item.lastMessage || latest.createdAt >= item.lastMessage.createdAt
                        ? { text: latest.text, createdAt: latest.createdAt, fromMe: false }
                        : item.lastMessage,
            }));
            void refreshNotifications();
        },
        onSent: (saved) => {
            updateConversation(studentId, (item) => ({
                ...item,
                lastMessage:
                    !item.lastMessage || saved.createdAt >= item.lastMessage.createdAt
                        ? { text: saved.text, createdAt: saved.createdAt, fromMe: true }
                        : item.lastMessage,
            }));
        },
    });

    return (
        <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center gap-1.5 border-b border-border px-2 py-2 sm:px-3">
                    <Link href="/personal/chat" className={cn(iconButtonClass, 'lg:hidden')} aria-label="Voltar para as conversas">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <Link
                        href={personalLinks.student(studentId)}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-1 transition-colors hover:bg-muted"
                        title="Abrir ficha do aluno"
                    >
                        <Avatar src={avatar ?? undefined} name={name} size="md" className="shrink-0" />
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                                {STATUS_LABELS[status] ?? status}
                                {email ? ` · ${email}` : ''}
                            </p>
                        </div>
                    </Link>
                    <nav className="flex shrink-0 items-center gap-0.5" aria-label="Atalhos do aluno">
                        <Link href={studentPaths.workoutEditor(studentId)} className={iconButtonClass} title="Editar treino" aria-label="Editar treino">
                            <Dumbbell className="h-4 w-4" />
                        </Link>
                        <Link href={studentPaths.dietEditor(studentId)} className={iconButtonClass} title="Editar dieta" aria-label="Editar dieta">
                            <Utensils className="h-4 w-4" />
                        </Link>
                        {whatsapp && (
                            <a
                                href={whatsapp}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(iconButtonClass, 'hover:text-emerald-600')}
                                title="Abrir conversa no WhatsApp"
                                aria-label="WhatsApp"
                            >
                                <Phone className="h-4 w-4" />
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsPanelOpen((open) => !open)}
                            className={cn(iconButtonClass, 'hidden xl:inline-flex', isPanelOpen && 'text-primary')}
                            aria-pressed={isPanelOpen}
                            title={isPanelOpen ? 'Ocultar painel do aluno' : 'Mostrar painel do aluno'}
                            aria-label={isPanelOpen ? 'Ocultar painel do aluno' : 'Mostrar painel do aluno'}
                        >
                            {isPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                        </button>
                    </nav>
                </header>

                <MessageList
                    messages={chat.messages}
                    status={chat.status}
                    error={chat.error}
                    hasMore={chat.hasMore}
                    loadingOlder={chat.loadingOlder}
                    onLoadOlder={chat.loadOlder}
                    onLoadOlderError={(message) => toast.error('Erro ao carregar mensagens anteriores', message)}
                    onReload={chat.reload}
                    onRetry={chat.retry}
                    onDiscard={chat.discard}
                    studentFirstName={firstNameOf(name)}
                />

                <Composer conversationKey={studentId} studentName={name} onSend={chat.send} />
            </div>

            {isPanelOpen && (
                <aside className="hidden w-[300px] shrink-0 border-l border-border xl:block">
                    <StudentContextPanel
                        studentId={studentId}
                        name={name}
                        avatar={avatar}
                        phone={phone}
                        onClose={() => setIsPanelOpen(false)}
                    />
                </aside>
            )}
        </div>
    );
}

export default function PersonalChatConversationPage() {
    const params = useParams<{ id: string }>();
    const studentId = typeof params?.id === 'string' ? decodeURIComponent(params.id) : '';
    const { conversations, error, reload } = useChat();
    const conversation = conversations.find((item) => item.studentId === studentId);

    usePageMeta({
        title: conversation ? `${conversation.name} · Chat` : 'Chat',
        breadcrumbs: [{ label: 'Chat', href: '/personal/chat' }, { label: conversation?.name ?? 'Conversa' }],
    });

    useEffect(() => {
        if (studentId) rememberRecentStudent(studentId);
    }, [studentId]);

    // A student missing from the (possibly cached) inbox may have just been created: refetch once and only
    // then say the conversation doesn't exist. Later background polls don't bring the spinner back.
    const [checkedFor, setCheckedFor] = useState<string | null>(null);
    useEffect(() => {
        if (conversation || checkedFor === studentId) return;
        let cancelled = false;
        reload().finally(() => {
            if (!cancelled) setCheckedFor(studentId);
        });
        return () => {
            cancelled = true;
        };
    }, [conversation, checkedFor, studentId, reload]);

    if (conversation) {
        // Keyed by student so switching conversations starts from a clean state.
        return <Conversation key={studentId} conversation={conversation} />;
    }

    if (checkedFor !== studentId && !error) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertCircle className={cn('h-8 w-8', error ? 'text-red-500' : 'text-muted-foreground')} />
            <p className="text-sm font-semibold text-foreground">
                {error ? 'Não foi possível carregar a conversa' : 'Conversa não encontrada'}
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
                {error ? error.message : 'Este aluno não está na sua lista. Ele pode ter sido removido.'}
            </p>
            <div className="flex items-center gap-2">
                {error && (
                    <button
                        type="button"
                        onClick={() => void reload()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Tentar novamente
                    </button>
                )}
                <Link href="/personal/chat" className="rounded-xl px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10">
                    Voltar para as conversas
                </Link>
            </div>
        </div>
    );
}
