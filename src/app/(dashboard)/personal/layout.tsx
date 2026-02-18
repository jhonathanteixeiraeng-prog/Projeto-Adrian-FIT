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
    X
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';

const navItems = [
    { href: '/personal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/personal/students', label: 'Alunos', icon: Users },
    { href: '/personal/workouts', label: 'Treinos', icon: ClipboardList },
    { href: '/personal/diets', label: 'Dietas', icon: Utensils },
    { href: '/personal/exercises', label: 'Exercícios', icon: Library },
    { href: '/personal/chat', label: 'Chat', icon: MessageCircle },
    { href: '/personal/settings', label: 'Configurações', icon: Settings },
];

export default function PersonalLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

    const mobilePrimaryItems = navItems.slice(0, 4);
    const mobileMoreItems = navItems.slice(4);

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
            intervalId = setInterval(fetchUnreadCount, 15000);
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
            {/* Sidebar */}
            <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 bg-card border-r border-border">
                {/* Logo */}
                <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
                    <div className="w-10 h-10 rounded-xl bg-[#F88022] flex items-center justify-center">
                        <Dumbbell className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-foreground">Adrian Santos</h1>
                        <p className="text-xs text-[#F88022]">Personal Trainer</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-6 px-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                                    isActive
                                        ? 'bg-[#F88022] text-white'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Section */}
                <div className="p-4 border-t border-border">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                        <Avatar name={session?.user?.name || ''} size="md" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                                {session?.user?.name}
                            </p>
                            <p className="text-xs text-muted-foreground">Personal Trainer</p>
                        </div>
                        <Link
                            href="/personal/notifications"
                            className="p-2 text-muted-foreground hover:text-foreground transition-colors relative rounded-lg hover:bg-background"
                            title="Notificações"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <>
                                    <span className="absolute top-1 right-1 w-2 h-2 bg-[#F88022] rounded-full" />
                                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F88022] text-white text-[10px] font-bold flex items-center justify-center">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                </>
                            )}
                        </Link>
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                            title="Sair"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 inset-x-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#F88022] flex items-center justify-center">
                        <Dumbbell className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-bold text-foreground truncate">Adrian Santos</span>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/personal/notifications" className="p-2 text-muted-foreground hover:text-foreground relative rounded-xl hover:bg-muted transition-colors">
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <>
                                <span className="absolute top-1 right-1 w-2 h-2 bg-[#F88022] rounded-full" />
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F88022] text-white text-[10px] font-bold flex items-center justify-center">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            </>
                        )}
                    </Link>
                    <Avatar name={session?.user?.name || ''} size="sm" />
                </div>
            </header>

            {/* Mobile Bottom Navigation */}
            <nav className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-card border-t border-border flex items-center justify-around px-4 z-50">
                {mobilePrimaryItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex flex-col items-center gap-1 p-2 transition-colors',
                                isActive ? 'text-[#F88022]' : 'text-muted-foreground'
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="text-xs">{item.label}</span>
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
                    <span className="text-xs">Mais</span>
                </button>
            </nav>

            {/* Mobile More Menu */}
            {isMoreMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-[60] bg-black/60"
                    onClick={() => setIsMoreMenuOpen(false)}
                >
                    <div
                        className="absolute inset-x-0 bottom-16 bg-card border-t border-border rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-foreground">Mais opções</h3>
                            <button
                                onClick={() => setIsMoreMenuOpen(false)}
                                className="p-2 rounded-lg hover:bg-muted transition-colors"
                            >
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {mobileMoreItems.map((item) => {
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'flex flex-col items-center gap-2 p-3 rounded-xl transition-colors',
                                            isActive
                                                ? 'bg-[#F88022]/15 text-[#F88022]'
                                                : 'bg-muted text-muted-foreground hover:text-foreground'
                                        )}
                                        onClick={() => setIsMoreMenuOpen(false)}
                                    >
                                        <item.icon className="w-5 h-5" />
                                        <span className="text-xs text-center leading-tight">{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 overflow-x-hidden">
                <div className="p-4 lg:p-8 w-full max-w-full overflow-x-hidden">
                    {children}
                </div>
            </main>
        </div>
    );
}
