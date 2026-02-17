'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Send,
    Image,
    Paperclip,
    MoreVertical,
    Phone,
    Video,
    CheckCheck,
    Loader2,
    RefreshCw
} from 'lucide-react';
import { Avatar, Button, Input } from '@/components/ui';

interface Message {
    id: string;
    fromMe: boolean;
    text: string;
    time: string;
    read: boolean;
}

interface PersonalTrainer {
    id: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
}

export default function StudentChatPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [personal, setPersonal] = useState<PersonalTrainer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchPersonal = useCallback(async () => {
        try {
            const response = await fetch('/api/student/personal');
            const result = await response.json();

            if (result.success) {
                setPersonal(result.data);
                setError('');
                return result.data;
            }

            setError(result?.error || 'Não foi possível carregar seu personal.');
        } catch (err) {
            console.error('Error fetching personal:', err);
            setError('Não foi possível carregar seu personal.');
        }
        return null;
    }, []);

    const fetchMessages = useCallback(async (userId: string) => {
        try {
            const response = await fetch(`/api/messages/${userId}`);
            const result = await response.json();

            if (result.success) {
                setMessages(result.data);
            }
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
    }, []);

    useEffect(() => {
        if (session?.user?.role === 'PERSONAL') {
            router.replace('/personal/chat');
            return;
        }

        const init = async () => {
            setLoading(true);
            const personalData = await fetchPersonal();
            if (personalData?.user?.id) {
                await fetchMessages(personalData.user.id);
            }
            setLoading(false);
        };

        init();
    }, [session?.user?.role, fetchPersonal, fetchMessages, router]);

    // Poll for new messages every 5 seconds
    useEffect(() => {
        if (!personal?.user?.id) return;

        const interval = setInterval(() => {
            fetchMessages(personal.user.id);
        }, 5000);

        return () => clearInterval(interval);
    }, [personal?.user?.id, fetchMessages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!newMessage.trim()) return;

        setSending(true);
        const messageText = newMessage;
        setNewMessage('');

        try {
            let targetUserId = personal?.user?.id;
            if (!targetUserId) {
                const refreshedPersonal = await fetchPersonal();
                targetUserId = refreshedPersonal?.user?.id;
            }

            if (!targetUserId) {
                setNewMessage(messageText);
                setError('Não foi possível identificar o personal para enviar a mensagem.');
                return;
            }

            const response = await fetch(`/api/messages/${targetUserId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: messageText }),
            });
            const result = await response.json();

            if (result.success) {
                setMessages(prev => [...prev, result.data]);
                setError('');
            } else {
                setNewMessage(messageText);
                setError(result?.error || 'Erro ao enviar mensagem');
            }
        } catch (err) {
            setNewMessage(messageText);
            console.error('Error sending message:', err);
            setError('Erro ao enviar mensagem');
        } finally {
            setSending(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#F88022]" />
            </div>
        );
    }

    const personalName = personal?.user?.name || 'Seu Personal';

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] -m-4">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
                <Link href="/student/home" className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <Avatar name={personalName} size="md" />
                <div className="flex-1 min-w-0">
                    <h1 className="font-semibold text-foreground truncate">{personalName}</h1>
                    <p className="text-xs text-muted-foreground">Personal Trainer</p>
                </div>
                <button
                    onClick={() => personal?.user?.id && fetchMessages(personal.user.id)}
                    className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors"
                    title="Atualizar mensagens"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
                <button className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors">
                    <MoreVertical className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
                {/* Date Separator */}
                <div className="flex items-center justify-center">
                    <span className="px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground">
                        Hoje
                    </span>
                </div>

                {error && (
                    <div className="mx-auto max-w-md p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm text-center">
                        {error}
                    </div>
                )}

                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <p>Nenhuma mensagem ainda</p>
                        <p className="text-sm">Envie uma mensagem para iniciar a conversa</p>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] px-4 py-2 rounded-2xl ${message.fromMe
                                    ? 'bg-[#F88022] text-white rounded-br-md'
                                    : 'bg-card text-foreground rounded-bl-md border border-border'
                                    }`}
                            >
                                <p className="text-[15px]">{message.text}</p>
                                <div className={`flex items-center justify-end gap-1 mt-1 ${message.fromMe ? 'text-white/70' : 'text-muted-foreground'
                                    }`}>
                                    <span className="text-[10px]">{message.time}</span>
                                    {message.fromMe && (
                                        <CheckCheck className={`w-3.5 h-3.5 ${message.read ? 'text-blue-300' : ''}`} />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card">
                <div className="flex items-center gap-2">
                    <button className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors">
                        <Paperclip className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors">
                        <Image className="w-5 h-5" />
                    </button>
                    <input
                        type="text"
                        placeholder="Digite uma mensagem..."
                        className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={sending}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sending}
                        className="p-2.5 bg-[#F88022] text-white rounded-xl hover:bg-secondary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {sending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
