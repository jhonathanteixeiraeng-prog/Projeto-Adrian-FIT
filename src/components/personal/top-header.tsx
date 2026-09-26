'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
    Search,
    Plus,
    UserPlus,
    Dumbbell,
    Utensils,
    Library,
    Bell,
    ChevronDown,
    ChevronRight,
    Sun,
    Moon,
    Settings,
    LogOut,
    Keyboard,
    MessageCircle,
    CheckCheck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, Button } from '@/components/ui';
import { useTheme } from '@/components/providers';
import { cn } from '@/lib/utils';
import { useHotkey, modKeyLabel } from '@/hooks/use-hotkey';
import { CommandPalette } from './command-palette';
import { useNotifications } from './notifications-provider';
import { Crumb, useCurrentPageMeta } from './page-meta';
import { confirmNavigation } from '@/hooks/use-unsaved-changes';

const APP_NAME = 'Adrian Fit';

/** Breadcrumbs derived from the URL, used when the page doesn't provide its own via usePageMeta. */
function getDefaultBreadcrumbs(pathname: string): Crumb[] {
    if (pathname === '/personal/dashboard') return [{ label: 'Dashboard' }];
    if (pathname === '/personal/students') return [{ label: 'CRM de Alunos' }];
    if (pathname === '/personal/students/new') {
        return [{ label: 'Alunos', href: '/personal/students' }, { label: 'Novo Cadastro' }];
    }
    const studentMatch = pathname.match(/^\/personal\/students\/([^/]+)(?:\/(workout|diet|report))?/);
    if (studentMatch) {
        const [, id, section] = studentMatch;
        const crumbs: Crumb[] = [{ label: 'Alunos', href: '/personal/students' }];
        if (!section) return [...crumbs, { label: 'Ficha do Aluno' }];
        crumbs.push({ label: 'Ficha do Aluno', href: `/personal/students/${id}` });
        const sectionLabel = { workout: 'Treino', diet: 'Plano Alimentar', report: 'Relatório' }[section];
        return [...crumbs, { label: sectionLabel || 'Detalhes' }];
    }
    if (pathname === '/personal/workouts') return [{ label: 'Fichas de Treino' }];
    if (pathname === '/personal/workouts/new') {
        return [{ label: 'Fichas de Treino', href: '/personal/workouts' }, { label: 'Nova Ficha' }];
    }
    if (pathname.startsWith('/personal/workouts/')) {
        return [{ label: 'Fichas de Treino', href: '/personal/workouts' }, { label: 'Editar Ficha' }];
    }
    if (pathname === '/personal/diets') return [{ label: 'Planos de Dieta' }];
    if (pathname === '/personal/diets/new') {
        return [{ label: 'Planos de Dieta', href: '/personal/diets' }, { label: 'Novo Plano' }];
    }
    if (pathname.startsWith('/personal/diets/')) {
        return [{ label: 'Planos de Dieta', href: '/personal/diets' }, { label: 'Editar Plano' }];
    }
    if (pathname === '/personal/exercises') return [{ label: 'Exercícios' }];
    if (pathname === '/personal/chat') return [{ label: 'Chat' }];
    if (pathname.startsWith('/personal/chat/')) {
        return [{ label: 'Chat', href: '/personal/chat' }, { label: 'Conversa' }];
    }
    if (pathname === '/personal/notifications') return [{ label: 'Notificações' }];
    if (pathname === '/personal/settings') return [{ label: 'Configurações' }];
    return [];
}

export function TopHeader() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const meta = useCurrentPageMeta();
    const { notifications, unreadNotifications, unreadMessages, markRead, markAllRead } = useNotifications();

    const [isCommandOpen, setIsCommandOpen] = useState(false);
    const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [modLabel, setModLabel] = useState('⌘');

    const quickActionRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const breadcrumbs = meta?.breadcrumbs?.length ? meta.breadcrumbs : getDefaultBreadcrumbs(pathname);
    const pageTitle = meta?.title || breadcrumbs[breadcrumbs.length - 1]?.label;
    const recentNotifications = notifications.slice(0, 6);

    useEffect(() => setModLabel(modKeyLabel()), []);

    // Distinct browser-tab titles, so several open tabs (one per student) can be told apart.
    // Next re-applies the root metadata title on some renders, so keep ours in place.
    useEffect(() => {
        const desired = pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME;
        const apply = () => {
            if (document.title !== desired) document.title = desired;
        };
        apply();
        const observer = new MutationObserver(apply);
        observer.observe(document.head, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
    }, [pageTitle]);

    useHotkey('mod+k', () => setIsCommandOpen((open) => !open), { allowInInputs: true });

    // Close dropdowns on outside click / Esc
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (quickActionRef.current && !quickActionRef.current.contains(target)) setIsQuickActionOpen(false);
            if (notificationsRef.current && !notificationsRef.current.contains(target)) setIsNotificationsOpen(false);
            if (userMenuRef.current && !userMenuRef.current.contains(target)) setIsUserMenuOpen(false);
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsQuickActionOpen(false);
            setIsNotificationsOpen(false);
            setIsUserMenuOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    // Close dropdowns on route change
    useEffect(() => {
        setIsQuickActionOpen(false);
        setIsNotificationsOpen(false);
        setIsUserMenuOpen(false);
    }, [pathname]);

    const openNotification = (id: string, link: string | null) => {
        if (!link) {
            markRead(id);
            setIsNotificationsOpen(false);
            return;
        }
        confirmNavigation().then((ok) => {
            if (ok) {
                markRead(id);
                setIsNotificationsOpen(false);
                router.push(link);
            }
        });
    };

    return (
        <>
            <header className="hidden lg:flex sticky top-0 inset-x-0 h-16 bg-card/85 backdrop-blur-md border-b border-border z-30 items-center justify-between gap-4 px-6 transition-colors">
                {/* Breadcrumbs */}
                <nav aria-label="Você está em" className="flex min-w-0 items-center gap-2 text-sm">
                    <Link
                        href="/personal/dashboard"
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors font-medium"
                    >
                        Painel
                    </Link>
                    {breadcrumbs.map((crumb, idx) => (
                        <React.Fragment key={`${crumb.label}-${idx}`}>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                            {idx === breadcrumbs.length - 1 || !crumb.href ? (
                                <span
                                    className={cn(
                                        'truncate max-w-[260px]',
                                        idx === breadcrumbs.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'
                                    )}
                                >
                                    {crumb.label}
                                </span>
                            ) : (
                                <Link
                                    href={crumb.href}
                                    className="truncate max-w-[220px] text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {crumb.label}
                                </Link>
                            )}
                        </React.Fragment>
                    ))}
                </nav>

                {/* Right Controls */}
                <div className="flex shrink-0 items-center gap-3">
                    {/* Command Palette Trigger */}
                    <button
                        type="button"
                        onClick={() => setIsCommandOpen(true)}
                        className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80 transition-all w-64 xl:w-72 text-left group shadow-xs"
                    >
                        <Search className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm flex-1">Buscar aluno ou ação...</span>
                        <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground bg-card rounded border border-border">
                            {modLabel} K
                        </kbd>
                    </button>

                    {/* Quick Create Dropdown */}
                    <div className="relative" ref={quickActionRef}>
                        <Button
                            size="sm"
                            onClick={() => setIsQuickActionOpen(!isQuickActionOpen)}
                            aria-expanded={isQuickActionOpen}
                            // Neutral: it's on every page, the page's own main action keeps the orange fill.
                            className="border border-border bg-card hover:bg-muted text-foreground font-semibold text-sm h-9 px-3 gap-1.5 rounded-lg"
                        >
                            <Plus className="w-4 h-4 text-primary" />
                            <span>Criar</span>
                            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                        </Button>

                        {isQuickActionOpen && (
                            <div className="absolute right-0 mt-2 w-60 bg-card border border-border rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                                <div className="px-3 py-1.5 border-b border-border/60">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Novo Cadastro
                                    </p>
                                </div>
                                {[
                                    { href: '/personal/students/new', label: 'Novo Aluno', icon: UserPlus },
                                    { href: '/personal/workouts/new', label: 'Nova Ficha de Treino', icon: Dumbbell },
                                    { href: '/personal/diets/new', label: 'Novo Plano de Dieta', icon: Utensils },
                                ].map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                                        onClick={() => setIsQuickActionOpen(false)}
                                    >
                                        <item.icon className="w-4 h-4 text-primary" />
                                        <span>{item.label}</span>
                                    </Link>
                                ))}
                                <div className="my-1 border-t border-border/60" />
                                <Link
                                    href="/personal/exercises"
                                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                                    onClick={() => setIsQuickActionOpen(false)}
                                >
                                    <Library className="w-4 h-4 text-muted-foreground" />
                                    <span>Banco de Exercícios</span>
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Dark/Light Mode Toggle */}
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition-colors"
                        title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                        aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>

                    {/* Notifications Dropdown */}
                    <div className="relative" ref={notificationsRef}>
                        <button
                            type="button"
                            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition-colors relative"
                            title="Notificações"
                            aria-label={`Notificações${unreadNotifications ? ` (${unreadNotifications} não lidas)` : ''}`}
                            aria-expanded={isNotificationsOpen}
                        >
                            <Bell className="w-4 h-4" />
                            {unreadNotifications > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                                </span>
                            )}
                        </button>

                        {isNotificationsOpen && (
                            <div className="absolute right-0 mt-2 w-96 bg-card border border-border rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                                <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
                                    <div className="flex items-center gap-1.5">
                                        <Bell className="w-4 h-4 text-primary" />
                                        <h4 className="text-sm font-bold text-foreground">Notificações</h4>
                                        {unreadNotifications > 0 && (
                                            <span className="text-xs px-1.5 rounded-full bg-primary/15 text-primary font-semibold">
                                                {unreadNotifications} nova{unreadNotifications > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                    {unreadNotifications > 0 && (
                                        <button
                                            onClick={markAllRead}
                                            className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                                        >
                                            <CheckCheck className="w-3.5 h-3.5" />
                                            Marcar todas como lidas
                                        </button>
                                    )}
                                </div>

                                {unreadMessages > 0 && (
                                    <Link
                                        href="/personal/chat"
                                        onClick={() => setIsNotificationsOpen(false)}
                                        className="mx-2 mt-2 flex items-center gap-3 rounded-xl bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/15 transition-colors"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                        {unreadMessages} mensage{unreadMessages > 1 ? 'ns' : 'm'} não lida{unreadMessages > 1 ? 's' : ''} no chat
                                        <ChevronRight className="ml-auto w-4 h-4" />
                                    </Link>
                                )}

                                <div className="max-h-80 overflow-y-auto divide-y divide-border/40 mt-1">
                                    {recentNotifications.length === 0 ? (
                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                            Nenhuma notificação recente
                                        </div>
                                    ) : (
                                        recentNotifications.map((notif) => (
                                            <button
                                                key={notif.id}
                                                type="button"
                                                onClick={() => openNotification(notif.id, notif.link)}
                                                className={cn(
                                                    'w-full text-left px-4 py-2.5 hover:bg-muted/60 transition-colors flex gap-3',
                                                    !notif.read && 'bg-primary/5'
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                                                        notif.read ? 'bg-transparent' : 'bg-primary'
                                                    )}
                                                    aria-hidden
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-semibold text-foreground">{notif.title}</span>
                                                    <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                        {notif.body}
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground/80 mt-1">
                                                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: ptBR })}
                                                    </span>
                                                </span>
                                                {notif.link && <ChevronRight className="mt-1 w-4 h-4 shrink-0 text-muted-foreground" />}
                                            </button>
                                        ))
                                    )}
                                </div>

                                <div className="pt-2 px-3 border-t border-border/60">
                                    <Link
                                        href="/personal/notifications"
                                        className="block text-center text-sm font-semibold text-primary hover:bg-primary/10 py-1.5 rounded-xl transition-colors"
                                        onClick={() => setIsNotificationsOpen(false)}
                                    >
                                        Ver todas as notificações
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User Menu Dropdown */}
                    <div className="relative" ref={userMenuRef}>
                        <button
                            type="button"
                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            aria-expanded={isUserMenuOpen}
                            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-muted border border-transparent hover:border-border transition-colors"
                        >
                            <Avatar name={session?.user?.name || ''} size="sm" />
                            <div className="text-left hidden xl:block">
                                <p className="text-sm font-bold text-foreground leading-tight truncate max-w-[120px]">
                                    {session?.user?.name?.split(' ')[0]}
                                </p>
                                <p className="text-xs text-muted-foreground">Personal Pro</p>
                            </div>
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>

                        {isUserMenuOpen && (
                            <div className="absolute right-0 mt-2 w-60 bg-card border border-border rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                                <div className="px-3 py-2 border-b border-border/60">
                                    <p className="text-sm font-bold text-foreground truncate">{session?.user?.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                                </div>

                                <Link
                                    href="/personal/settings"
                                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                                    onClick={() => setIsUserMenuOpen(false)}
                                >
                                    <Settings className="w-4 h-4 text-muted-foreground" />
                                    <span>Configurações</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsUserMenuOpen(false);
                                        window.dispatchEvent(new Event('personal:open-shortcuts'));
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors text-left"
                                >
                                    <Keyboard className="w-4 h-4 text-muted-foreground" />
                                    <span className="flex-1">Atalhos de teclado</span>
                                    <kbd className="px-1.5 py-0.5 text-xs font-semibold text-muted-foreground bg-muted rounded border border-border">?</kbd>
                                </button>

                                <div className="my-1 border-t border-border/60" />

                                <button
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors text-left"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Sair da Conta</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Command Palette Modal */}
            <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
        </>
    );
}
