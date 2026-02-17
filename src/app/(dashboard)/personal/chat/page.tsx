'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, MessageCircle, Loader2, Users } from 'lucide-react';
import { Card, CardContent, Avatar, Badge, Input, Button } from '@/components/ui';

interface Conversation {
    id: string;
    name: string;
    email: string;
    lastMessage: string | null;
    lastMessageTime: string | null;
    unreadCount: number;
}

export default function PersonalChatPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchConversations();
    }, []);

    const fetchConversations = async () => {
        try {
            setLoading(true);
            setError('');

            // Fetch students to create conversation list
            const response = await fetch('/api/students');
            const result = await response.json();

            if (result.success) {
                const students = result.data || [];
                // Transform students into conversations
                const convs = students.map((student: any) => ({
                    id: student.id,
                    name: student.user?.name || 'Aluno',
                    email: student.user?.email || '',
                    lastMessage: null, // TODO: Fetch from messages API when implemented
                    lastMessageTime: null,
                    unreadCount: 0,
                }));
                setConversations(convs);
            } else {
                setError(result.error || 'Erro ao carregar conversas');
            }
        } catch (err) {
            setError('Erro ao conectar com o servidor');
        } finally {
            setLoading(false);
        }
    };

    const filteredConversations = conversations.filter(conv =>
        conv.name.toLowerCase().includes(search.toLowerCase()) ||
        conv.email.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#F88022]" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Chat</h1>
                <p className="text-muted-foreground mt-1">
                    Converse com seus alunos
                </p>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Empty State */}
            {conversations.length === 0 && !loading && (
                <Card>
                    <CardContent className="p-12 text-center">
                        <div className="w-20 h-20 rounded-full bg-[#F88022]/10 flex items-center justify-center mx-auto mb-4">
                            <MessageCircle className="w-10 h-10 text-[#F88022]" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2">
                            Nenhuma conversa
                        </h3>
                        <p className="text-muted-foreground mb-6">
                            Cadastre alunos para iniciar conversas com eles
                        </p>
                        <Link href="/personal/students/new">
                            <Button className="bg-[#F88022] hover:bg-[#F88022]/90 text-white">
                                <Users className="w-5 h-5" />
                                Cadastrar Aluno
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            )}

            {conversations.length > 0 && (
                <>
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Buscar conversa..."
                            className="pl-12"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Conversations List */}
                    <div className="space-y-2">
                        {filteredConversations.map((conv) => (
                            <Link key={conv.id} href={`/personal/chat/${conv.id}`}>
                                <Card hover className="mb-2">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <Avatar name={conv.name} size="lg" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h3 className="font-semibold text-foreground truncate">
                                                        {conv.name}
                                                    </h3>
                                                    {conv.lastMessageTime && (
                                                        <span className={`text-xs ${conv.unreadCount > 0 ? 'text-[#F88022] font-medium' : 'text-muted-foreground'}`}>
                                                            {conv.lastMessageTime}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm text-muted-foreground truncate">
                                                        {conv.lastMessage || conv.email}
                                                    </p>
                                                    {conv.unreadCount > 0 && (
                                                        <Badge variant="success" className="ml-2">
                                                            {conv.unreadCount}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}

                        {filteredConversations.length === 0 && search && (
                            <Card>
                                <CardContent className="p-12 text-center">
                                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                                        <MessageCircle className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground mb-2">
                                        Nenhuma conversa encontrada
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Tente buscar com outros termos
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
