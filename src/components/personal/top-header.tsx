'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
    CheckCircle2,
    Command as CommandIcon,
    Sparkles
} from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { useTheme } from '@/components/providers';
import { CommandPalette } from './command-palette';

interface NotificationItem {
    id: string;
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
}

export function TopHeader() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();

    const [isCommandOpen, setIsCommandOpen] = useState(false);
    const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    const [unreadCount, setUnreadCount] = useState(0);
    const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
    const [loadingNotifications, setLoadingNotifications] = useState(false);

    const quickActionRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    // Fetch unread notifications count and recent items
    const fetchNotifications = async () => {
        try {
            setLoadingNotifications(true);
            const res = await fetch('/api/personal/notifications', { cache: 'no-store' });
            const data = await res.json();
            if (data.success && data.data) {
                setUnreadCount(Number(data.data.unreadCount || 0));
                setRecentNotifications(data.data.notifications?.slice(0, 5) || []);
            }
        } catch (err) {
            console.error('Erro ao carregar notificações no header:', err);
        } finally {
            setLoadingNotifications(false);
        }
    };

    useEffect(() => {
        if (session?.user?.role === 'PERSONAL') {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 20000);
            return () => clearInterval(interval);
        }
    }, [session?.user?.role]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (quickActionRef.current && !quickActionRef.current.contains(target)) {
                setIsQuickActionOpen(false);
            }
            if (notificationsRef.current && !notificationsRef.current.contains(target)) {
                setIsNotificationsOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(target)) {
                setIsUserMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close dropdowns on route change
    useEffect(() => {
        setIsQuickActionOpen(false);
        setIsNotificationsOpen(false);
        setIsUserMenuOpen(false);
    }, [pathname]);

    // Generate Contextual Breadcrumbs
    const getBreadcrumbs = () => {
        if (pathname === '/personal/dashboard') {
            return [{ label: 'Dashboard', href: '/personal/dashboard' }];
        }
        if (pathname === '/personal/students') {
            return [{ label: 'CRM de Alunos', href: '/personal/students' }];
        }
        if (pathname === '/personal/students/new') {
            return [
                { label: 'Alunos', href: '/personal/students' },
                { label: 'Novo Cadastro', href: pathname },
            ];
        }
        if (pathname.startsWith('/personal/students/') && pathname.endsWith('/workout')) {
            return [
                { label: 'Alunos', href: '/personal/students' },
                { label: 'Ficha', href: pathname.replace('/workout', '') },
                { label: 'Prescrição de Treino', href: pathname },
            ];
        }
        if (pathname.startsWith('/personal/students/') && pathname.endsWith('/diet')) {
            return [
                { label: 'Alunos', href: '/personal/students' },
                { label: 'Ficha', href: pathname.replace('/diet', '') },
                { label: 'Plano Alimentar', href: pathname },
            ];
        }
        if (pathname.startsWith('/personal/students/')) {
            return [
                { label: 'Alunos', href: '/personal/students' },
                { label: 'Ficha do Aluno', href: pathname },
            ];
        }
        if (pathname === '/personal/workouts') {
            return [{ label: 'Prescrição', href: '/personal/workouts' }, { label: 'Banco de Treinos', href: pathname }];
        }
        if (pathname === '/personal/workouts/new') {
            return [{ label: 'Treinos', href: '/personal/workouts' }, { label: 'Nova Ficha', href: pathname }];
        }
        if (pathname === '/personal/diets') {
            return [{ label: 'Nutrição', href: '/personal/diets' }, { label: 'Modelos de Dieta', href: pathname }];
        }
        if (pathname === '/personal/diets/new') {
            return [{ label: 'Nutrição', href: '/personal/diets' }, { label: 'Novo Plano', href: pathname }];
        }
        if (pathname === '/personal/exercises') {
            return [{ label: 'Biblioteca', href: '/personal/exercises' }, { label: 'Exercícios', href: pathname }];
        }
        if (pathname.startsWith('/personal/chat')) {
            return [{ label: 'Comunicação', href: '/personal/chat' }, { label: 'Chat com Alunos', href: pathname }];
        }
        if (pathname === '/personal/notifications') {
            return [{ label: 'Sistema', href: '/personal/notifications' }, { label: 'Central de Notificações', href: pathname }];
        }
        if (pathname === '/personal/settings') {
            return [{ label: 'Conta', href: '/personal/settings' }, { label: 'Configurações', href: pathname }];
        }
        return [{ label: 'Adrian Fit', href: '/personal/dashboard' }];
    };

    const breadcrumbs = getBreadcrumbs();

    const markAllAsRead = async () => {
        try {
            await fetch('/api/personal/notifications', { method: 'PUT' });
            setUnreadCount(0);
            setRecentNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch (err) {
            console.error('Erro ao marcar notificações como lidas:', err);
        }
    };

    return (
        <>
            <header className="hidden lg:flex sticky top-0 inset-x-0 h-16 bg-card/85 backdrop-blur-md border-b border-border z-30 items-center justify-between px-6 transition-colors">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm">
                    <Link
                        href="/personal/dashboard"
                        className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                    >
                        Painel
                    </Link>
                    {breadcrumbs.map((crumb, idx) => (
                        <React.Fragment key={crumb.href + idx}>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                            {idx === breadcrumbs.length - 1 ? (
                                <span className="font-semibold text-foreground truncate max-w-[200px]">
                                    {crumb.label}
                                </span>
                            ) : (
                                <Link
                                    href={crumb.href}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {crumb.label}
                                </Link>
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-3">
                    {/* Command Palette Trigger */}
                    <button
                        type="button"
                        onClick={() => setIsCommandOpen(true)}
                        className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80 transition-all w-64 text-left group shadow-xs"
                    >
                        <Search className="w-4 h-4 text-muted-foreground group-hover:text-[#F88022] transition-colors" />
                        <span className="text-xs font-medium flex-1">Buscar alunos ou ações...</span>
                        <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground bg-card rounded border border-border">
                            ⌘K
                        </kbd>
                    </button>

                    {/* Quick Create Dropdown */}
                    <div className="relative" ref={quickActionRef}>
                        <Button
                            size="sm"
                            onClick={() => setIsQuickActionOpen(!isQuickActionOpen)}
                            className="bg-[#F88022] hover:bg-[#F88022]/90 text-white font-semibold text-xs h-9 px-3 gap-1.5 rounded-xl shadow-xs"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Criar</span>
                            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                        </Button>

                        {isQuickActionOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                                <div className="px-3 py-1.5 border-b border-border/60">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                        Novo Cadastro
                                    </p>
                                </div>
                                <Link
                                    href="/personal/students/new"
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-[#F88022]/10 hover:text-[#F88022] transition-colors"
                                    onClick={() => setIsQuickActionOpen(false)}
                                >
                                    <UserPlus className="w-4 h-4 text-[#F88022]" />
                                    <span>Novo Aluno</span>
                                </Link>
                                <Link
                                    href="/personal/workouts/new"
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-[#F88022]/10 hover:text-[#F88022] transition-colors"
                                    onClick={() => setIsQuickActionOpen(false)}
                                >
                                    <Dumbbell className="w-4 h-4 text-[#F88022]" />
                                    <span>Prescrever Treino</span>
                                </Link>
                                <Link
                                    href="/personal/diets/new"
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-[#F88022]/10 hover:text-[#F88022] transition-colors"
                                    onClick={() => setIsQuickActionOpen(false)}
                                >
                                    <Utensils className="w-4 h-4 text-[#F88022]" />
                                    <span>Novo Plano de Dieta</span>
                                </Link>
                                <div className="my-1 border-t border-border/60" />
                                <Link
                                    href="/personal/exercises"
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-[#F88022]/10 hover:text-[#F88022] transition-colors"
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
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
                    </button>

                    {/* Notifications Dropdown */}
                    <div className="relative" ref={notificationsRef}>
                        <button
                            type="button"
                            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition-colors relative"
                            title="Notificações"
                        >
                            <Bell className="w-4 h-4" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#F88022] text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {isNotificationsOpen && (
                            <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                                <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
                                    <div className="flex items-center gap-1.5">
                                        <Bell className="w-4 h-4 text-[#F88022]" />
                                        <h4 className="text-xs font-bold text-foreground">Notificações</h4>
                                        {unreadCount > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#F88022]/15 text-[#F88022] font-semibold">
                                                {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllAsRead}
                                            className="text-[11px] text-[#F88022] hover:underline font-medium"
                                        >
                                            Marcar lidas
                                        </button>
                                    )}
                                </div>

                                <div className="max-h-72 overflow-y-auto divide-y divide-border/40">
                                    {recentNotifications.length === 0 ? (
                                        <div className="py-6 text-center text-xs text-muted-foreground">
                                            Nenhuma notificação recente
                                        </div>
                                    ) : (
                                        recentNotifications.map((notif) => (
                                            <div
                                                key={notif.id}
                                                className={`px-4 py-2.5 hover:bg-muted/50 transition-colors ${
                                                    !notif.read ? 'bg-[#F88022]/5' : ''
                                                }`}
                                            >
                                                <p className="text-xs font-semibold text-foreground">
                                                    {notif.title}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                                    {notif.message}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="pt-2 px-3 border-t border-border/60">
                                    <Link
                                        href="/personal/notifications"
                                        className="block text-center text-xs font-semibold text-[#F88022] hover:bg-[#F88022]/10 py-1.5 rounded-xl transition-colors"
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
                            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-muted border border-transparent hover:border-border transition-colors"
                        >
                            <Avatar name={session?.user?.name || ''} size="sm" />
                            <div className="text-left hidden xl:block">
                                <p className="text-xs font-bold text-foreground leading-tight truncate max-w-[120px]">
                                    {session?.user?.name?.split(' ')[0]}
                                </p>
                                <p className="text-[10px] text-muted-foreground">Personal Pro</p>
                            </div>
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>

                        {isUserMenuOpen && (
                            <div className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                                <div className="px-3 py-2 border-b border-border/60">
                                    <p className="text-xs font-bold text-foreground truncate">
                                        {session?.user?.name}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                        {session?.user?.email}
                                    </p>
                                </div>

                                <Link
                                    href="/personal/settings"
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                                    onClick={() => setIsUserMenuOpen(false)}
                                >
                                    <Settings className="w-4 h-4 text-muted-foreground" />
                                    <span>Configurações</span>
                                </Link>

                                <div className="my-1 border-t border-border/60" />

                                <button
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors text-left"
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
            <CommandPalette
                isOpen={isCommandOpen}
                onClose={() => setIsCommandOpen(false)}
            />
        </>
    );
}
