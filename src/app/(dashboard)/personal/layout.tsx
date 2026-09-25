'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Dumbbell,
    LayoutDashboard,
    Users,
    MessageCircle,
    Settings,
    LogOut,
    Bell,
    Library,
    ClipboardList,
    Utensils,
    MoreHorizontal,
    X,
    Radio
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { TopHeader } from '@/components/personal/top-header';

interface NavGroup {
    title: string;
    items: {
        href: string;
        label: string;
        icon: any;
    }[];
}

const navGroups: NavGroup[] = [
    {
        title: 'Gestor',
        items: [
            { href: '/personal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/personal/students', label: 'Alunos (CRM)', icon: Users },
        ],
    },
    {
        title: 'Prescrição',
        items: [
            { href: '/personal/workouts', label: 'Fichas de Treino', icon: ClipboardList },
            { href: '/personal/diets', label: 'Planos de Dieta', icon: Utensils },
            { href: '/personal/exercises', label: 'Exercícios', icon: Library },
        ],
    },
    {
        title: 'Comunicação',
        items: [
            { href: '/personal/chat', label: 'Chat & Mensagens', icon: MessageCircle },
            { href: '/personal/notifications', label: 'Notificações', icon: Bell },
        ],
    },
    {
        title: 'Sistema',
        items: [
            { href: '/personal/settings', label: 'Configurações', icon: Settings },
        ],
    },
];

const mobileNavItems = [
    { href: '/personal/dashboard', label: 'Início', icon: LayoutDashboard },
    { href: '/personal/students', label: 'Alunos', icon: Users },
    { href: '/personal/workouts', label: 'Treinos', icon: ClipboardList },
    { href: '/personal/chat', label: 'Chat', icon: MessageCircle },
    { href: '/personal/diets', label: 'Dietas', icon: Utensils },
    { href: '/personal/exercises', label: 'Exercícios', icon: Library },
    { href: '/personal/notifications', label: 'Alertas', icon: Bell },
    { href: '/personal/settings', label: 'Conta', icon: Settings },
];

export default function PersonalLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

    const mobilePrimaryItems = mobileNavItems.slice(0, 4);
    const mobileMoreItems = mobileNavItems.slice(4);

    useEffect(() => {
        let active = true;
        let intervalId: NodeJS.Timeout | null = null;

        const fetchUnreadCount = async () => {
            try {
                const response = await fetch('/api/personal/notifications', { cache: 'no-store' });
                const data = await response.json();

                if (active && data?.success) {
                    setUnreadCount(Number(data?.data?.unreadCount || 0));
                }
            } catch (error) {
                console.error('Erro ao carregar notificações do personal:', error);
            }
        };

        if (session?.user?.role === 'PERSONAL') {
            fetchUnreadCount();
            intervalId = setInterval(fetchUnreadCount, 20000);
        }

        return () => {
            active = false;
            if (intervalId) clearInterval(intervalId);
        };
    }, [session?.user?.role]);

    useEffect(() => {
        setIsMoreMenuOpen(false);
    }, [pathname]);

    return (
        <div className="min-h-dvh bg-background flex overflow-x-hidden">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 bg-card border-r border-border z-40">
                {/* Logo & Brand Header */}
                <div className="h-16 flex items-center gap-3 px-6 border-b border-border bg-card">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#F88022] to-amber-500 flex items-center justify-center shadow-xs">
                        <Dumbbell className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h1 className="font-extrabold text-foreground tracking-tight text-sm">ADRIAN FIT</h1>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[#F88022]/15 text-[#F88022]">
                                PRO
                            </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Consultoria & Treino</p>
                    </div>
                </div>

                {/* Grouped Navigation */}
                <nav className="flex-1 py-5 px-3 space-y-5 overflow-y-auto">
                    {navGroups.map((group) => (
                        <div key={group.title} className="space-y-1">
                            <p className="px-3 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                                {group.title}
                            </p>
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const isActive =
                                        pathname === item.href ||
                                        (item.href !== '/personal/dashboard' && pathname.startsWith(item.href));
                                    const Icon = item.icon;

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150',
                                                isActive
                                                    ? 'bg-[#F88022]/10 text-[#F88022] border-l-2 border-[#F88022]'
                                                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Icon
                                                    className={cn(
                                                        'w-4 h-4 shrink-0',
                                                        isActive ? 'text-[#F88022]' : 'text-muted-foreground'
                                                    )}
                                                />
                                                <span className="truncate">{item.label}</span>
                                            </div>

                                            {item.href === '/personal/notifications' && unreadCount > 0 && (
                                                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#F88022] text-white text-[10px] font-bold flex items-center justify-center">
                                                    {unreadCount > 99 ? '99+' : unreadCount}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Sidebar Footer */}
                <div className="p-3 border-t border-border bg-muted/20">
                    <div className="p-2.5 rounded-xl bg-card border border-border/80 shadow-xs flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="relative flex h-2 w-2 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground truncate">
                                    {session?.user?.name || 'Personal'}
                                </p>
                                <p className="text-[10px] text-muted-foreground">Consultoria Online</p>
                            </div>
                        </div>
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Sair"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 inset-x-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#F88022] to-amber-500 flex items-center justify-center">
                        <Dumbbell className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <span className="font-extrabold text-foreground text-sm tracking-tight">ADRIAN FIT</span>
                        <p className="text-[10px] text-[#F88022] font-semibold">COACH PRO</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/personal/notifications"
                        className="p-2 text-muted-foreground hover:text-foreground relative rounded-xl hover:bg-muted transition-colors"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F88022] text-white text-[10px] font-bold flex items-center justify-center">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </Link>
                    <Avatar name={session?.user?.name || ''} size="sm" />
                </div>
            </header>

            {/* Main Area with Desktop TopHeader */}
            <div className="flex-1 lg:ml-64 flex flex-col min-h-dvh overflow-x-hidden">
                <TopHeader />
                <main className="flex-1 pt-16 lg:pt-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-12 overflow-x-hidden">
                    <div className="p-4 lg:p-8 w-full max-w-7xl mx-auto overflow-x-hidden">
                        {children}
                    </div>
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <nav className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-card border-t border-border flex items-center justify-around px-4 z-50">
                {mobilePrimaryItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/personal/dashboard' && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex flex-col items-center gap-1 p-2 transition-colors',
                                isActive ? 'text-[#F88022]' : 'text-muted-foreground'
                            )}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="text-[11px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
                <button
                    onClick={() => setIsMoreMenuOpen(true)}
                    className={cn(
                        'flex flex-col items-center gap-1 p-2 transition-colors',
                        isMoreMenuOpen || mobileMoreItems.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
                            ? 'text-[#F88022]'
                            : 'text-muted-foreground'
                    )}
                >
                    <MoreHorizontal className="w-5 h-5" />
                    <span className="text-[11px] font-medium">Mais</span>
                </button>
            </nav>

            {/* Mobile More Menu */}
            {isMoreMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs"
                    onClick={() => setIsMoreMenuOpen(false)}
                >
                    <div
                        className="absolute inset-x-0 bottom-16 bg-card border-t border-border rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-foreground text-sm">Mais opções</h3>
                            <button
                                onClick={() => setIsMoreMenuOpen(false)}
                                className="p-2 rounded-lg hover:bg-muted transition-colors"
                            >
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {mobileMoreItems.map((item) => {
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors',
                                            isActive
                                                ? 'bg-[#F88022]/15 text-[#F88022]'
                                                : 'bg-muted text-muted-foreground hover:text-foreground'
                                        )}
                                        onClick={() => setIsMoreMenuOpen(false)}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="text-[11px] text-center font-medium leading-tight">
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
