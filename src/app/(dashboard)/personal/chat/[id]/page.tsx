'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Send,
    Image,
    Paperclip,
    MoreVertical,
    CheckCheck,
    User,
    Loader2,
    RefreshCw
} from 'lucide-react';
import { Avatar, Button } from '@/components/ui';

interface Message {
    id: string;
    fromMe: boolean;
    text: string;
    time: string;
    read: boolean;
}

interface Student {
    id: string;
    userId: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
}

export default function PersonalChatDetailPage() {
    const params = useParams();
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchStudent = useCallback(async () => {
        try {
            const response = await fetch(`/api/students/${params.id}`);
            const result = await response.json();

            if (result.success) {
                setStudent(result.data);
                return result.data;
            }
        } catch (err) {
            console.error('Error fetching student:', err);
        }
        return null;
    }, [params.id]);

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
        const init = async () => {
            setLoading(true);
            const studentData = await fetchStudent();
            if (studentData?.user?.id) {
                await fetchMessages(studentData.user.id);
            }
            setLoading(false);
        };

        if (params.id) {
            init();
        }
    }, [params.id, fetchStudent, fetchMessages]);

    // Poll for new messages every 5 seconds
    useEffect(() => {
        if (!student?.user?.id) return;

        const interval = setInterval(() => {
            fetchMessages(student.user.id);
        }, 5000);

        return () => clearInterval(interval);
    }, [student?.user?.id, fetchMessages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!newMessage.trim() || !student?.user?.id) return;

        setSending(true);
        const messageText = newMessage;
        setNewMessage('');

        try {
            const response = await fetch(`/api/messages/${student.user.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: messageText }),
            });
            const result = await response.json();

            if (result.success) {
                setMessages(prev => [...prev, result.data]);
            } else {
                setNewMessage(messageText);
                alert('Erro ao enviar mensagem');
            }
        } catch (err) {
            setNewMessage(messageText);
            console.error('Error sending message:', err);
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

    if (!student) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <p className="text-muted-foreground">Aluno não encontrado</p>
                <Link href="/personal/chat" className="mt-4">
                    <Button variant="outline">Voltar</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] -m-4 lg:-m-8">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
                <Link href="/personal/chat" className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors lg:hidden">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <Avatar name={student.user.name} size="md" />
                <div className="flex-1 min-w-0">
                    <h1 className="font-semibold text-foreground truncate">{student.user.name}</h1>
                    <p className="text-xs text-muted-foreground">{student.user.email}</p>
                </div>
                <button
                    onClick={() => fetchMessages(student.user.id)}
                    className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors"
                    title="Atualizar mensagens"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
                <Link
                    href={`/personal/students/${student.id}`}
                    className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors"
                >
                    <User className="w-5 h-5" />
                </Link>
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

            {/* Quick Actions */}
            <div className="px-4 py-2 border-t border-border bg-card/50">
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {[
                        'Bom treino hoje! 💪',
                        'Não esqueça do check-in',
                        'Como está a dieta?',
                        'Lembre-se de beber água',
                    ].map((quick, i) => (
                        <button
                            key={i}
                            onClick={() => setNewMessage(quick)}
                            className="px-3 py-1.5 bg-muted rounded-full text-xs text-muted-foreground hover:text-foreground whitespace-nowrap transition-colors"
                        >
                            {quick}
                        </button>
                    ))}
                </div>
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
