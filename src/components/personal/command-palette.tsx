'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    User,
    TrendingUp,
    FileText,
    Phone,
    ClipboardList,
    Keyboard,
    History,
    Loader2,
    type LucideIcon,
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import { cn, matchesSearch, normalizeText } from '@/lib/utils';
import { useApi } from '@/hooks/use-api';
import { confirmNavigation } from '@/hooks/use-unsaved-changes';
import { whatsappHref } from '@/components/personal/chat/contact';

interface StudentItem {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
}

interface PaletteItem {
    id: string;
    group: string;
    title: string;
    subtitle?: string;
    icon?: LucideIcon;
    avatarName?: string;
    href?: string;
    externalHref?: string;
    onSelect?: () => void;
    keywords?: string;
    /** Remembered in "Recentes" when chosen. */
    studentId?: string;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

const RECENTS_KEY = 'personal:recent-students';
const MAX_RECENTS = 6;

function readRecents(): string[] {
    try {
        const raw = window.localStorage.getItem(RECENTS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    } catch {
        return [];
    }
}

/** Records a student as recently opened, so it shows first in the ⌘K palette. Safe to call from any page. */
export function rememberRecentStudent(studentId: string) {
    try {
        const next = [studentId, ...readRecents().filter((id) => id !== studentId)].slice(0, MAX_RECENTS);
        window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
        // Storage unavailable: recents are a convenience only.
    }
}

/** Per-student actions; `words` let queries like "treino joao" or "chat ana" jump straight to the action. */
const STUDENT_ACTIONS: {
    key: string;
    words: string[];
    title: (name: string) => string;
    icon: LucideIcon;
    href?: (id: string) => string;
}[] = [
    { key: 'profile', words: ['ficha', 'perfil', 'abrir'], title: (n) => `Abrir ficha de ${n}`, icon: User, href: (id) => `/personal/students/${id}` },
    { key: 'workout', words: ['treino', 'treinos', 'prescrever'], title: (n) => `Treino de ${n}`, icon: Dumbbell, href: (id) => `/personal/students/${id}/workout` },
    { key: 'diet', words: ['dieta', 'dietas', 'plano', 'alimentar', 'nutricao'], title: (n) => `Plano alimentar de ${n}`, icon: Utensils, href: (id) => `/personal/students/${id}/diet` },
    { key: 'chat', words: ['chat', 'mensagem', 'mensagens', 'conversa'], title: (n) => `Conversar com ${n}`, icon: MessageCircle, href: (id) => `/personal/chat/${id}` },
    { key: 'progress', words: ['evolucao', 'progresso', 'checkin', 'check-in', 'fotos'], title: (n) => `Evolução de ${n}`, icon: TrendingUp, href: (id) => `/personal/students/${id}?tab=progress` },
    { key: 'report', words: ['relatorio', 'pdf'], title: (n) => `Relatório de ${n}`, icon: FileText, href: (id) => `/personal/students/${id}/report` },
    { key: 'whatsapp', words: ['whatsapp', 'whats', 'zap'], title: (n) => `WhatsApp de ${n}`, icon: Phone },
];

const ACTION_WORDS = new Set(STUDENT_ACTIONS.flatMap((action) => action.words));

const STATIC_ITEMS: PaletteItem[] = [
    { id: 'new-student', group: 'Ações rápidas', title: 'Cadastrar novo aluno', subtitle: 'Adicionar aluno à consultoria', icon: UserPlus, href: '/personal/students/new', keywords: 'criar' },
    { id: 'new-workout', group: 'Ações rápidas', title: 'Nova ficha de treino', subtitle: 'Do zero ou a partir de um modelo', icon: Dumbbell, href: '/personal/workouts/new', keywords: 'criar prescrever' },
    { id: 'new-diet', group: 'Ações rápidas', title: 'Novo plano alimentar', subtitle: 'Prescrever dieta e calcular macros', icon: Utensils, href: '/personal/diets/new', keywords: 'criar dieta' },
    { id: 'nav-dashboard', group: 'Ir para', title: 'Dashboard', subtitle: 'G depois D', icon: LayoutDashboard, href: '/personal/dashboard', keywords: 'inicio painel' },
    { id: 'nav-students', group: 'Ir para', title: 'Alunos (CRM)', subtitle: 'G depois A', icon: Users, href: '/personal/students', keywords: 'crm cobranca contratos' },
    { id: 'nav-workouts', group: 'Ir para', title: 'Fichas de treino', subtitle: 'G depois T', icon: ClipboardList, href: '/personal/workouts', keywords: 'modelos biblioteca' },
    { id: 'nav-diets', group: 'Ir para', title: 'Planos de dieta', subtitle: 'G depois N', icon: Utensils, href: '/personal/diets', keywords: 'nutricao modelos' },
    { id: 'nav-exercises', group: 'Ir para', title: 'Exercícios', subtitle: 'G depois E', icon: Library, href: '/personal/exercises', keywords: 'biblioteca videos' },
    { id: 'nav-chat', group: 'Ir para', title: 'Chat', subtitle: 'G depois C', icon: MessageCircle, href: '/personal/chat', keywords: 'mensagens conversas' },
    { id: 'nav-notifications', group: 'Ir para', title: 'Notificações', icon: Bell, href: '/personal/notifications', keywords: 'alertas' },
    { id: 'nav-settings', group: 'Ir para', title: 'Configurações', icon: Settings, href: '/personal/settings', keywords: 'perfil conta' },
    {
        id: 'shortcuts',
        group: 'Ir para',
        title: 'Atalhos de teclado',
        subtitle: 'Tecla ?',
        icon: Keyboard,
        onSelect: () => window.dispatchEvent(new Event('personal:open-shortcuts')),
        keywords: 'teclado ajuda',
    },
];

function studentActionItems(student: StudentItem, onlyKeys?: Set<string>): PaletteItem[] {
    return STUDENT_ACTIONS.filter((action) => !onlyKeys || onlyKeys.has(action.key)).flatMap<PaletteItem>((action) => {
        const firstName = student.name.split(' ')[0];
        if (action.key === 'whatsapp') {
            const href = whatsappHref(student.phone);
            if (!href) return [];
            return [{ id: `${student.id}-${action.key}`, group: `Ações · ${student.name}`, title: action.title(firstName), icon: action.icon, externalHref: href, studentId: student.id }];
        }
        return [
            {
                id: `${student.id}-${action.key}`,
                group: `Ações · ${student.name}`,
                title: action.title(firstName),
                icon: action.icon,
                href: action.href?.(student.id),
                studentId: student.id,
            },
        ];
    });
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [recents, setRecents] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Cached: reopening the palette is instant and shares data with the CRM list.
    const { data: rawStudents, isLoading } = useApi<any[]>(isOpen ? '/api/students' : null);

    const students = useMemo<StudentItem[]>(
        () =>
            (Array.isArray(rawStudents) ? rawStudents : []).map((s: any) => ({
                id: s.id,
                name: s.user?.name || 'Aluno',
                email: s.user?.email || '',
                phone: s.user?.phone || null,
                status: s.status,
            })),
        [rawStudents]
    );

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setSelectedIndex(0);
            return;
        }
        setRecents(readRecents());
        const id = window.setTimeout(() => inputRef.current?.focus(), 30);
        return () => window.clearTimeout(id);
    }, [isOpen]);

    const items = useMemo<PaletteItem[]>(() => {
        const toStudentItem = (student: StudentItem, group: string): PaletteItem => ({
            id: `student-${student.id}`,
            group,
            title: student.name,
            subtitle: [student.email, student.status !== 'ACTIVE' ? (student.status === 'PAUSED' ? 'Pausado' : 'Inativo') : null]
                .filter(Boolean)
                .join(' · '),
            avatarName: student.name,
            href: `/personal/students/${student.id}`,
            studentId: student.id,
        });

        const trimmed = query.trim();
        if (!trimmed) {
            const recentStudents = recents
                .map((id) => students.find((student) => student.id === id))
                .filter((student): student is StudentItem => Boolean(student))
                .map((student) => toStudentItem(student, 'Recentes'));
            return [...recentStudents, ...STATIC_ITEMS];
        }

        // Split "treino joao" into an action ("treino") and a name ("joao").
        const terms = normalizeText(trimmed).split(/\s+/).filter(Boolean);
        const actionTerms = terms.filter((term) => ACTION_WORDS.has(term));
        const nameQuery = terms.filter((term) => !ACTION_WORDS.has(term)).join(' ');
        const requestedActions = new Set(
            STUDENT_ACTIONS.filter((action) => action.words.some((word) => actionTerms.includes(word))).map((action) => action.key)
        );

        const matchedStudents = students
            .filter((student) => matchesSearch(trimmed, student.name, student.email, student.phone))
            .concat(
                nameQuery && requestedActions.size > 0
                    ? students.filter(
                          (student) =>
                              matchesSearch(nameQuery, student.name, student.email) &&
                              !matchesSearch(trimmed, student.name, student.email, student.phone)
                      )
                    : []
            );

        const result: PaletteItem[] = [];
        if (requestedActions.size > 0) {
            matchedStudents.slice(0, 3).forEach((student) => result.push(...studentActionItems(student, requestedActions)));
        }
        result.push(...matchedStudents.slice(0, 8).map((student) => toStudentItem(student, 'Alunos')));
        if (requestedActions.size === 0 && matchedStudents.length > 0) {
            result.push(...studentActionItems(matchedStudents[0]).filter((item) => !item.id.endsWith('-profile')));
        }
        result.push(...STATIC_ITEMS.filter((item) => matchesSearch(trimmed, item.title, item.subtitle, item.keywords)));
        return result;
    }, [query, students, recents]);

    useEffect(() => {
        setSelectedIndex((index) => Math.min(index, Math.max(items.length - 1, 0)));
    }, [items.length]);

    useEffect(() => {
        const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
        node?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    const handleSelect = async (item: PaletteItem) => {
        // Close first: the "sair sem salvar?" confirmation must not open underneath the palette overlay.
        onClose();
        if (item.href && !(await confirmNavigation())) return;
        if (item.studentId) rememberRecentStudent(item.studentId);
        if (item.onSelect) item.onSelect();
        else if (item.externalHref) window.open(item.externalHref, '_blank', 'noopener,noreferrer');
        else if (item.href) router.push(item.href);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            return;
        }
        if (items.length === 0) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % items.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const selected = items[selectedIndex];
            if (selected) handleSelect(selected);
        }
    };

    if (!isOpen) return null;

    // Group consecutive items for rendering while keeping a flat index for keyboard navigation.
    const groups: { name: string; entries: { item: PaletteItem; index: number }[] }[] = [];
    items.forEach((item, index) => {
        const last = groups[groups.length - 1];
        if (last && last.name === item.group) last.entries.push({ item, index });
        else groups.push({ name: item.group, entries: [{ item, index }] });
    });

    const activeId = items[selectedIndex] ? `palette-item-${selectedIndex}` : undefined;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Busca e comandos"
                className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Search Bar Input */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-muted/30">
                    <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="palette-list"
                        aria-activedescendant={activeId}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        placeholder='Buscar aluno ou comando — ex.: "treino ana", "chat joão"'
                        className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
                    {query && (
                        <button
                            onClick={() => {
                                setQuery('');
                                setSelectedIndex(0);
                                inputRef.current?.focus();
                            }}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                            aria-label="Limpar busca"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-semibold text-muted-foreground bg-muted rounded-md border border-border shrink-0">
                        Esc
                    </kbd>
                </div>

                {/* Results List */}
                <div ref={listRef} id="palette-list" role="listbox" className="flex-1 overflow-y-auto p-2">
                    {groups.map((group) => (
                        <div key={group.name} className="py-1.5">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-3 mb-1 flex items-center gap-1.5">
                                {group.name === 'Recentes' ? (
                                    <History className="w-3 h-3 text-[#F88022]" />
                                ) : group.name === 'Alunos' ? (
                                    <User className="w-3 h-3 text-[#F88022]" />
                                ) : (
                                    <CommandIcon className="w-3 h-3 text-[#F88022]" />
                                )}
                                {group.name}
                            </p>
                            <div className="space-y-0.5">
                                {group.entries.map(({ item, index }) => {
                                    const isSelected = index === selectedIndex;
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.id}
                                            id={`palette-item-${index}`}
                                            data-index={index}
                                            role="option"
                                            aria-selected={isSelected}
                                            onClick={() => handleSelect(item)}
                                            onMouseMove={() => setSelectedIndex(index)}
                                            className={cn(
                                                'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-colors',
                                                isSelected ? 'bg-[#F88022]/15 text-[#F88022]' : 'text-foreground hover:bg-muted/60'
                                            )}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                {item.avatarName ? (
                                                    <Avatar name={item.avatarName} size="sm" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                        {Icon && <Icon className="w-4 h-4 text-[#F88022]" />}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate leading-tight">{item.title}</p>
                                                    {item.subtitle && (
                                                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                                                    )}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0">
                                                    {item.externalHref ? 'Abrir' : 'Ir'}
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {items.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground">
                            <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm font-semibold text-foreground">Nenhum resultado</p>
                            <p className="text-sm mt-1">Tente outro nome, e-mail ou comando.</p>
                        </div>
                    )}
                </div>

                {/* Footer Tips */}
                <div className="px-4 py-2.5 bg-muted/40 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-sans font-semibold">↑</kbd>
                            <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-sans font-semibold">↓</kbd>
                            navegar
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-sans font-semibold">↵</kbd>
                            abrir
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-sans font-semibold">Esc</kbd>
                            fechar
                        </span>
                    </div>
                    <span className="hidden sm:inline">Busca ignora acentos</span>
                </div>
            </div>
        </div>
    );
}
