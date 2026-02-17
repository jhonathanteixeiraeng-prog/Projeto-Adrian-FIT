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
        <div className="min-h-screen bg-background">
            {/* Mobile Header */}
            <header className="fixed top-0 inset-x-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F88022] flex items-center justify-center">
                        <Dumbbell className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <span className="font-bold text-foreground">
                            {trainerDisplayName}
                        </span>
                        <p className="text-xs text-[#F88022]">Personal Trainer</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/student/notifications" className="p-2 text-muted-foreground hover:text-foreground relative rounded-xl hover:bg-muted transition-colors">
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

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 inset-x-0 h-20 bg-card border-t border-border flex items-center justify-around px-4 z-50 pb-safe">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex flex-col items-center gap-1 p-2 transition-colors min-w-[60px]',
                                isActive ? 'text-[#F88022]' : 'text-muted-foreground'
                            )}
                        >
                            <item.icon className={cn('w-6 h-6', isActive && 'text-[#F88022]')} />
                            <span className="text-xs font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Main Content */}
            <main className="pt-16 pb-24">
                <div className="p-4">
                    {children}
                </div>
            </main>
        </div>
    );
}
