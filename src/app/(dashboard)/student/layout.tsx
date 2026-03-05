'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Dumbbell,
    Home,
    TrendingUp,
    MessageCircle,
    User,
    LogOut,
    Bell
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';

const navItems = [
    { href: '/student/home', label: 'Início', icon: Home },
    { href: '/student/progress', label: 'Evolução', icon: TrendingUp },
    { href: '/student/chat', label: 'Chat', icon: MessageCircle },
    { href: '/student/profile', label: 'Perfil', icon: User },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [personalName, setPersonalName] = useState<string>('');
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        let active = true;

        const fetchPersonal = async () => {
            try {
                const response = await fetch('/api/student/personal');
                const data = await response.json();

                const apiName = data?.success ? data?.data?.user?.name : null;
                if (active && typeof apiName === 'string' && apiName.trim()) {
                    setPersonalName(apiName);
                }
            } catch (error) {
                console.error('Erro ao carregar personal no header:', error);
            }
        };

        if (session?.user?.role === 'STUDENT') {
            fetchPersonal();
        }

        return () => {
            active = false;
        };
    }, [session?.user?.role]);

    useEffect(() => {
        let active = true;
        let intervalId: NodeJS.Timeout | null = null;

        const fetchUnreadCount = async () => {
            try {
                const response = await fetch('/api/student/notifications', { cache: 'no-store' });
                const data = await response.json();

                if (active && data?.success) {
                    setUnreadCount(Number(data?.data?.unreadCount || 0));
                }
            } catch (error) {
                console.error('Erro ao carregar notificações:', error);
            }
        };

        if (session?.user?.role === 'STUDENT') {
            fetchUnreadCount();
            intervalId = setInterval(fetchUnreadCount, 15000);
        }

        return () => {
            active = false;
            if (intervalId) clearInterval(intervalId);
        };
    }, [session?.user?.role]);

    const trainerDisplayName =
        personalName ||
        session?.user?.personalTrainerName ||
        session?.user?.name ||
        'Seu Personal';

    return (
        <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
            {/* Mobile Header — glassmorphism */}
            <header className="shrink-0 bg-card/90 backdrop-blur-lg border-b border-border/60 flex items-center justify-between px-4 z-40 pt-[env(safe-area-inset-top)] h-[calc(4rem+env(safe-area-inset-top))]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F88022] to-[#e06b10] flex items-center justify-center shadow-glow-orange">
                        <Dumbbell className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <span className="font-bold text-foreground text-[15px] leading-tight">
                            {trainerDisplayName}
                        </span>
                        <p className="text-[11px] text-[#F88022] font-medium tracking-wide uppercase">Personal Trainer</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Link
                        href="/student/notifications"
                        className="p-2.5 text-muted-foreground hover:text-foreground relative rounded-xl hover:bg-muted/80 transition-all touch-bounce"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 rounded-full bg-[#F88022] text-white text-[10px] font-bold flex items-center justify-center shadow-glow-orange animate-in">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </Link>
                    <Avatar name={session?.user?.name || ''} size="sm" />
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto overscroll-y-contain scroll-smooth">
                <div className="p-4 pb-6">
                    {children}
                </div>
            </main>

            {/* Bottom Navigation — premium */}
            <nav className="shrink-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-xl supports-[backdrop-filter]:bg-card/80 h-[calc(4.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] flex items-center justify-around px-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-2xl transition-all duration-200 min-w-[64px] touch-bounce relative',
                                isActive
                                    ? 'text-[#F88022]'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {/* Active pill background */}
                            {isActive && (
                                <span className="absolute inset-0 bg-[#F88022]/10 rounded-2xl animate-in" />
                            )}
                            <item.icon
                                className={cn(
                                    'w-6 h-6 relative z-10 transition-transform duration-200',
                                    isActive && 'text-[#F88022] scale-110'
                                )}
                            />
                            <span className={cn(
                                'text-[10px] font-semibold relative z-10 tracking-wide',
                                isActive && 'text-[#F88022]'
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
