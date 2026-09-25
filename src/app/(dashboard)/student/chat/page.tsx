'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Send,
    CheckCheck,
    Clock,
    Loader2,
    RefreshCw,
    AlertCircle,
} from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { useChatMessages, type ChatMessage } from '@/components/personal/chat/use-chat-messages';
import { dayKey, formatClock, formatDayLabel } from '@/components/personal/chat/time-format';

interface PersonalTrainer {
    id: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function renderMessageText(text: string, fromMe: boolean) {
    return text.split(URL_PATTERN).map((part, index) =>
        index % 2 === 1 ? (
            <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline underline-offset-2 break-all ${fromMe ? 'text-white' : 'text-[#F88022]'}`}
            >
                {part}
            </a>
        ) : (
            <React.Fragment key={index}>{part}</React.Fragment>
        )
    );
}

function StudentChatConversation({ personal }: { personal: PersonalTrainer }) {
    const personalName = personal.user?.name || 'Seu Personal';
    const { messages, status, error, hasMore, loadingOlder, loadOlder, send, retry, discard, reload } =
        useChatMessages(personal.user.id);

    const [text, setText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const prevHeightRef = useRef<number>(0);
    const isInitialRef = useRef(true);

    const groupedMessages = useMemo(() => {
        const groups: { day: string; label: string; messages: ChatMessage[] }[] = [];
        let currentDay = '';
        for (const msg of messages) {
            const day = dayKey(msg.createdAt);
            if (day !== currentDay) {
                currentDay = day;
                groups.push({
                    day,
                    label: formatDayLabel(msg.createdAt),
                    messages: [msg],
                });
            } else {
                groups[groups.length - 1].messages.push(msg);
            }
        }
        return groups;
    }, [messages]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        if (isInitialRef.current && messages.length > 0) {
            isInitialRef.current = false;
            container.scrollTop = container.scrollHeight;
            prevHeightRef.current = container.scrollHeight;
            return;
        }

        if (loadingOlder) {
            prevHeightRef.current = container.scrollHeight;
        } else if (prevHeightRef.current > 0 && container.scrollHeight > prevHeightRef.current) {
            const heightDiff = container.scrollHeight - prevHeightRef.current;
            container.scrollTop += heightDiff;
            prevHeightRef.current = container.scrollHeight;
        } else {
            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            if (distanceFromBottom < 160) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
            prevHeightRef.current = container.scrollHeight;
        }
    }, [messages, loadingOlder]);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
    }, [text]);

    const handleSubmit = () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        send(trimmed);
        setText('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.focus();
        }
    };

    return (
        <div className="student-chat-shell">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center gap-3 p-4 border-b border-border bg-card/95 backdrop-blur">
                <Link
                    href="/student/home"
                    className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Voltar para o início"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <Avatar name={personalName} size="md" />
                <div className="flex-1 min-w-0">
                    <h1 className="font-semibold text-foreground truncate">{personalName}</h1>
                    <p className="text-xs text-muted-foreground">Personal Trainer</p>
                </div>
                <button
                    onClick={reload}
                    className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors"
                    title="Atualizar mensagens"
                    aria-label="Atualizar mensagens"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <div ref={containerRef} className="student-chat-messages space-y-3">
                {hasMore && (
                    <div className="flex justify-center py-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void loadOlder()}
                            disabled={loadingOlder}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            {loadingOlder ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                    Carregando mensagens anteriores...
                                </>
                            ) : (
                                'Carregar mensagens anteriores'
                            )}
                        </Button>
                    </div>
                )}

                {status === 'loading' && messages.length === 0 && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-7 h-7 animate-spin text-[#F88022]" />
                    </div>
                )}

                {error && (
                    <div className="mx-auto max-w-md p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs text-center flex items-center justify-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {status === 'ready' && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center px-4">
                        <p className="font-medium text-foreground">Nenhuma mensagem ainda</p>
                        <p className="text-xs text-muted-foreground mt-1">Envie uma mensagem para iniciar a conversa com seu personal.</p>
                    </div>
                )}

                {groupedMessages.map((group) => (
                    <div key={group.day} className="space-y-3">
                        <div className="flex items-center justify-center my-3">
                            <span className="px-3 py-1 bg-muted/80 border border-border/50 rounded-full text-xs text-muted-foreground font-medium">
                                {group.label}
                            </span>
                        </div>

                        {group.messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl animate-in ${message.fromMe
                                        ? 'bg-gradient-to-br from-[#F88022] to-[#e06b10] text-white rounded-br-md shadow-sm'
                                        : 'bg-card text-foreground rounded-bl-md border border-border shadow-sm'
                                        }`}
                                >
                                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                        {renderMessageText(message.text, message.fromMe)}
                                    </p>

                                    {message.status === 'failed' ? (
                                        <div className="flex items-center justify-end gap-2 mt-1.5 pt-1 border-t border-white/20 text-xs">
                                            <span className="text-red-200">Falha ao enviar</span>
                                            <button
                                                type="button"
                                                onClick={() => retry(message.id)}
                                                className="underline font-semibold hover:text-white"
                                            >
                                                Tentar de novo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => discard(message.id)}
                                                className="text-white/70 hover:text-white ml-1"
                                                title="Descartar"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : message.status === 'sending' ? (
                                        <div className="flex items-center justify-end gap-1 mt-1 text-white/70">
                                            <Clock className="w-3 h-3 animate-pulse" />
                                            <span className="text-[10px]">Enviando...</span>
                                        </div>
                                    ) : (
                                        <div
                                            className={`flex items-center justify-end gap-1 mt-1 ${message.fromMe ? 'text-white/70' : 'text-muted-foreground'
                                                }`}
                                        >
                                            <span className="text-[10px]">{formatClock(message.createdAt)}</span>
                                            {message.fromMe && (
                                                <CheckCheck className={`w-3.5 h-3.5 ${message.read ? 'text-blue-300' : 'text-white/70'}`} />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="student-chat-composer">
                <div className="student-chat-composer-inner">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        placeholder="Digite uma mensagem..."
                        className="flex-1 max-h-32 min-h-[44px] py-2.5 px-3.5 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#F88022] text-[15px] resize-none leading-normal"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!text.trim()}
                        aria-label="Enviar mensagem"
                        className="p-2.5 bg-gradient-to-br from-[#F88022] to-[#e06b10] text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed touch-bounce shadow-glow-orange flex-shrink-0"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function StudentChatPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [personal, setPersonal] = useState<PersonalTrainer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchPersonal = useCallback(async () => {
        try {
            const response = await fetch('/api/student/personal');
            const result = await response.json();

            if (result.success && result.data) {
                setPersonal(result.data);
                setError('');
                return result.data;
            }

            setError(result?.error || 'Não foi possível carregar seu personal.');
        } catch (err) {
            console.error('Error fetching personal:', err);
            setError('Não foi possível carregar seu personal.');
        } finally {
            setLoading(false);
        }
        return null;
    }, []);

    useEffect(() => {
        if (session?.user?.role === 'PERSONAL') {
            router.replace('/personal/chat');
            return;
        }

        void fetchPersonal();
    }, [session?.user?.role, fetchPersonal, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#F88022]" />
            </div>
        );
    }

    if (!personal?.user?.id) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground/60 mb-3" />
                <h2 className="text-lg font-semibold text-foreground">Personal não vinculado</h2>
                <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                    {error || 'Não encontramos um personal trainer vinculado ao seu perfil.'}
                </p>
                <Button variant="outline" onClick={() => void fetchPersonal()}>
                    Tentar novamente
                </Button>
            </div>
        );
    }

    return <StudentChatConversation personal={personal} />;
}
