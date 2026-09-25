'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search,
    UserPlus,
    Dumbbell,
    Utensils,
    Library,
    MessageCircle,
    LayoutDashboard,
    Users,
    Settings,
    Bell,
    ArrowRight,
    Command as CommandIcon,
    X,
    User
} from 'lucide-react';
import { Avatar } from '@/components/ui';

interface StudentItem {
    id: string;
    name: string;
    email: string;
    status: string;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [students, setStudents] = useState<StudentItem[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch students when palette opens
    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setSelectedIndex(0);
            return;
        }

        const fetchStudents = async () => {
            try {
                setLoadingStudents(true);
                const res = await fetch('/api/students');
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    setStudents(
                        data.data.map((s: any) => ({
                            id: s.id,
                            name: s.user?.name || 'Aluno',
                            email: s.user?.email || '',
                            status: s.status,
                        }))
                    );
                }
            } catch (err) {
                console.error('Erro ao buscar alunos para command palette:', err);
            } finally {
                setLoadingStudents(false);
            }
        };

        fetchStudents();
        setTimeout(() => inputRef.current?.focus(), 50);
    }, [isOpen]);

    // Handle global Cmd+K shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (isOpen) {
                    onClose();
                }
            } else if (e.key === 'Escape' && isOpen) {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const staticActions = useMemo(
        () => [
            {
                id: 'new-student',
                category: 'Ações Rápidas',
                title: 'Cadastrar Novo Aluno',
                subtitle: 'Adicionar aluno à consultoria',
                icon: UserPlus,
                href: '/personal/students/new',
            },
            {
                id: 'new-workout',
                category: 'Ações Rápidas',
                title: 'Prescrever Nova Ficha de Treino',
                subtitle: 'Criar rotina do zero ou modelo',
                icon: Dumbbell,
                href: '/personal/workouts/new',
            },
            {
                id: 'new-diet',
                category: 'Ações Rápidas',
                title: 'Criar Novo Plano Alimentar',
                subtitle: 'Prescrever dieta ou calcular macros',
                icon: Utensils,
                href: '/personal/diets/new',
            },
            {
                id: 'exercises-library',
                category: 'Ações Rápidas',
                title: 'Biblioteca de Exercícios',
                subtitle: 'Gerenciar exercícios e vídeos',
                icon: Library,
                href: '/personal/exercises',
            },
            {
                id: 'nav-dashboard',
                category: 'Navegação',
                title: 'Dashboard Geral',
                subtitle: 'Métricas, retenção e feed ao vivo',
                icon: LayoutDashboard,
                href: '/personal/dashboard',
            },
            {
                id: 'nav-students',
                category: 'Navegação',
                title: 'CRM de Alunos',
                subtitle: 'Gestão de planos, contratos e churn',
                icon: Users,
                href: '/personal/students',
            },
            {
                id: 'nav-chat',
                category: 'Navegação',
                title: 'Mensagens & Chat',
                subtitle: 'Conversas com alunos',
                icon: MessageCircle,
                href: '/personal/chat',
            },
            {
                id: 'nav-notifications',
                category: 'Navegação',
                title: 'Notificações',
                subtitle: 'Alertas e atividades do sistema',
                icon: Bell,
                href: '/personal/notifications',
            },
            {
                id: 'nav-settings',
                category: 'Navegação',
                title: 'Configurações',
                subtitle: 'Dados profissionais e perfil',
                icon: Settings,
                href: '/personal/settings',
            },
        ],
        []
    );

    const filteredStudents = useMemo(() => {
        if (!query.trim()) return students.slice(0, 5);
        const q = query.toLowerCase().trim();
        return students.filter(
            (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
        );
    }, [students, query]);

    const filteredActions = useMemo(() => {
        if (!query.trim()) return staticActions;
        const q = query.toLowerCase().trim();
        return staticActions.filter(
            (a) => a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
        );
    }, [staticActions, query]);

    // Flattened list for keyboard navigation
    const allItems = useMemo(() => {
        const studentItems = filteredStudents.map((s) => ({
            type: 'student' as const,
            id: s.id,
            title: s.name,
            subtitle: s.email,
            href: `/personal/students/${s.id}`,
            data: s,
        }));

        const actionItems = filteredActions.map((a) => ({
            type: 'action' as const,
            id: a.id,
            title: a.title,
            subtitle: a.subtitle,
            href: a.href,
            icon: a.icon,
        }));

        return [...studentItems, ...actionItems];
    }, [filteredStudents, filteredActions]);

    const handleSelect = (href: string) => {
        onClose();
        router.push(href);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (allItems.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % allItems.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + allItems.length) % allItems.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selected = allItems[selectedIndex];
            if (selected) {
                handleSelect(selected.href);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-card border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Search Bar Input */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-muted/30">
                    <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        placeholder="Buscar aluno, prescrição, ferramenta ou tela..."
                        className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    {query && (
                        <button
                            onClick={() => {
                                setQuery('');
                                setSelectedIndex(0);
                            }}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground bg-muted rounded-md border border-border shrink-0">
                        ESC
                    </kbd>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-2 divide-y divide-border/50">
                    {/* Alunos Section */}
                    {filteredStudents.length > 0 && (
                        <div className="py-2 first:pt-0">
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-3 mb-1.5 flex items-center gap-1.5">
                                <User className="w-3 h-3 text-[#F88022]" />
                                Alunos
                            </p>
                            <div className="space-y-0.5">
                                {filteredStudents.map((student) => {
                                    const itemIndex = allItems.findIndex(
                                        (i) => i.type === 'student' && i.id === student.id
                                    );
                                    const isSelected = itemIndex === selectedIndex;

                                    return (
                                        <button
                                            key={student.id}
                                            onClick={() => handleSelect(`/personal/students/${student.id}`)}
                                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                                                isSelected
                                                    ? 'bg-[#F88022]/15 text-[#F88022]'
                                                    : 'hover:bg-muted/60 text-foreground'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Avatar name={student.name} size="sm" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate leading-tight">
                                                        {student.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {student.email}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-[11px] font-medium text-muted-foreground">
                                                    Abrir Ficha
                                                </span>
                                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Ações e Navegação */}
                    {filteredActions.length > 0 && (
                        <div className="py-2">
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-3 mb-1.5 flex items-center gap-1.5">
                                <CommandIcon className="w-3 h-3 text-[#F88022]" />
                                Ações & Telas
                            </p>
                            <div className="space-y-0.5">
                                {filteredActions.map((action) => {
                                    const itemIndex = allItems.findIndex(
                                        (i) => i.type === 'action' && i.id === action.id
                                    );
                                    const isSelected = itemIndex === selectedIndex;
                                    const IconComponent = action.icon;

                                    return (
                                        <button
                                            key={action.id}
                                            onClick={() => handleSelect(action.href)}
                                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                                                isSelected
                                                    ? 'bg-[#F88022]/15 text-[#F88022]'
                                                    : 'hover:bg-muted/60 text-foreground'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-foreground shrink-0">
                                                    <IconComponent className="w-4 h-4 text-[#F88022]" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate leading-tight">
                                                        {action.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {action.subtitle}
                                                    </p>
                                                </div>
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {allItems.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground">
                            <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm font-semibold text-foreground">Nenhum resultado encontrado</p>
                            <p className="text-xs mt-1">Tente buscar por outro termo ou nome de aluno.</p>
                        </div>
                    )}
                </div>

                {/* Footer Tips */}
                <div className="px-4 py-2.5 bg-muted/40 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-sans font-semibold">↑</kbd>
                            <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-sans font-semibold">↓</kbd>
                            navegar
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-sans font-semibold">↵</kbd>
                            selecionar
                        </span>
                    </div>
                    <span className="flex items-center gap-1 text-[#F88022] font-semibold">
                        <CommandIcon className="w-3 h-3" />
                        ADRIAN FIT PRO
                    </span>
                </div>
            </div>
        </div>
    );
}
