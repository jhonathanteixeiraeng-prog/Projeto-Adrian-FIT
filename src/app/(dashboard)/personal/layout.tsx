'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
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
    Loader2,
    PanelLeftClose,
    PanelLeftOpen,
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { TopHeader } from '@/components/personal/top-header';
import { NotificationsProvider, useNotifications } from '@/components/personal/notifications-provider';
import { PageMetaProvider } from '@/components/personal/page-meta';
import { GO_TO_SHORTCUTS, ShortcutsHelpDialog } from '@/components/personal/shortcuts-help';
import { useHotkey, isTypingTarget, isModalOpen } from '@/hooks/use-hotkey';
import { useLocalStorageState } from '@/hooks/use-local-storage';
import { confirmNavigation } from '@/hooks/use-unsaved-changes';

type BadgeSource = 'messages' | 'notifications';

interface NavItem {
    href: string;
    label: string;
    icon: any;
    badge?: BadgeSource;
}

interface NavGroup {
    title: string;
    items: NavItem[];
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
            { href: '/personal/chat', label: 'Chat & Mensagens', icon: MessageCircle, badge: 'messages' },
            { href: '/personal/notifications', label: 'Notificações', icon: Bell, badge: 'notifications' },
        ],
    },
    {
        title: 'Sistema',
        items: [
            { href: '/personal/settings', label: 'Configurações', icon: Settings },
        ],
    },
];

const mobileNavItems: NavItem[] = [
    { href: '/personal/dashboard', label: 'Início', icon: LayoutDashboard },
    { href: '/personal/students', label: 'Alunos', icon: Users },
    { href: '/personal/workouts', label: 'Treinos', icon: ClipboardList },
    { href: '/personal/chat', label: 'Chat', icon: MessageCircle, badge: 'messages' },
    { href: '/personal/diets', label: 'Dietas', icon: Utensils },
    { href: '/personal/exercises', label: 'Exercícios', icon: Library },
    { href: '/personal/notifications', label: 'Alertas', icon: Bell, badge: 'notifications' },
    { href: '/personal/settings', label: 'Conta', icon: Settings },
];

const isItemActive = (pathname: string, href: string) =>
    pathname === href || (href !== '/personal/dashboard' && pathname.startsWith(href));

const formatBadge = (count: number) => (count > 99 ? '99+' : String(count));

function PageFallback() {
    return (
        <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
    );
}

/** "G then <key>" navigation, e.g. G A opens the students CRM. */
function useGoToShortcuts() {
    const router = useRouter();
    const pendingRef = useRef<number>(0);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
            if (isTypingTarget(event.target) || isModalOpen()) return;
            const key = event.key.toLowerCase();

            if (pendingRef.current && Date.now() - pendingRef.current < 1200) {
                pendingRef.current = 0;
                const target = GO_TO_SHORTCUTS.find((item) => item.key === key);
                if (target) {
                    event.preventDefault();
                    confirmNavigation().then((ok) => {
                        if (ok) router.push(target.href);
                    });
                }
                return;
            }
            if (key === 'g' && !event.shiftKey) pendingRef.current = Date.now();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [router]);
}

function PersonalShell({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const { unreadMessages, unreadNotifications } = useNotifications();
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
    const [collapsed, setCollapsed] = useLocalStorageState('personal:sidebar-collapsed', false);

    const badgeCount = (source?: BadgeSource) =>
        source === 'messages' ? unreadMessages : source === 'notifications' ? unreadNotifications : 0;

    const mobilePrimaryItems = mobileNavItems.slice(0, 4);
    const mobileMoreItems = mobileNavItems.slice(4);

    useGoToShortcuts();
    useHotkey('?', () => setIsShortcutsOpen(true));
    useHotkey('[', () => setCollapsed((current) => !current));

    useEffect(() => {
        const open = () => setIsShortcutsOpen(true);
        window.addEventListener('personal:open-shortcuts', open);
        return () => window.removeEventListener('personal:open-shortcuts', open);
    }, []);

    useEffect(() => {
        setIsMoreMenuOpen(false);
    }, [pathname]);

    return (
        <div className="min-h-dvh bg-background flex overflow-x-clip">
            {/* Desktop Sidebar */}
            <aside
                className={cn(
                    'hidden lg:flex flex-col fixed inset-y-0 left-0 bg-card border-r border-border z-40 transition-[width] duration-200',
                    collapsed ? 'w-[72px]' : 'w-64'
                )}
            >
                {/* Logo & Brand Header */}
                <div className={cn('h-16 flex items-center gap-3 border-b border-border bg-card', collapsed ? 'justify-center px-2' : 'px-6')}>
                    <div className="w-9 h-9 shrink-0 rounded-lg bg-brand flex items-center justify-center">
                        <Dumbbell className="w-5 h-5 text-brand-foreground" />
                    </div>
                    {!collapsed && (
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h1 className="font-brand font-extrabold text-foreground tracking-tight text-sm">ADRIAN FIT</h1>
                                <span className="text-xs font-semibold px-1.5 rounded-md bg-muted text-muted-foreground">PRO</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Consultoria & Treino</p>
                        </div>
                    )}
                </div>

                {/* Grouped Navigation */}
                <nav className={cn('flex-1 py-5 space-y-5 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}>
                    {navGroups.map((group) => (
                        <div key={group.title} className="space-y-1">
                            {collapsed ? (
                                <div className="mx-auto mb-2 h-px w-8 bg-border" aria-hidden />
                            ) : (
                                <p className="px-3 text-xs font-medium text-muted-foreground/80">
                                    {group.title}
                                </p>
                            )}
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const isActive = isItemActive(pathname, item.href);
                                    const Icon = item.icon;
                                    const count = badgeCount(item.badge);

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            title={collapsed ? item.label : undefined}
                                            aria-label={collapsed ? item.label : undefined}
                                            className={cn(
                                                'relative flex items-center rounded-lg text-sm font-medium transition-all duration-150',
                                                collapsed ? 'h-10 justify-center' : 'justify-between px-3 py-2',
                                                isActive
                                                    ? 'bg-muted text-foreground'
                                                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                                            )}
                                        >
                                            {isActive && !collapsed && (
                                                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" aria-hidden />
                                            )}
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Icon
                                                    className={cn(
                                                        'w-4 h-4 shrink-0',
                                                        isActive ? 'text-primary' : 'text-muted-foreground'
                                                    )}
                                                />
                                                {!collapsed && <span className="truncate">{item.label}</span>}
                                            </div>

                                            {count > 0 &&
                                                (collapsed ? (
                                                    <span className="absolute top-1.5 right-2.5 h-2 w-2 rounded-full bg-primary" aria-hidden />
                                                ) : (
                                                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                                                        {formatBadge(count)}
                                                    </span>
                                                ))}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Sidebar Footer */}
                <div className={cn('border-t border-border bg-muted/20', collapsed ? 'p-2 space-y-2' : 'p-3 space-y-2')}>
                    {collapsed ? (
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="w-full h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Sair"
                            aria-label="Sair"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    ) : (
                        <div className="p-2.5 rounded-xl bg-card border border-border/80 shadow-xs flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="relative flex h-2 w-2 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate">
                                        {session?.user?.name || 'Personal'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Consultoria Online</p>
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
                    )}
                    <button
                        type="button"
                        onClick={() => setCollapsed((current) => !current)}
                        className={cn(
                            'w-full flex items-center gap-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
                            collapsed ? 'h-9 justify-center' : 'px-3 py-2'
                        )}
                        title={collapsed ? 'Expandir menu ( [ )' : 'Recolher menu ( [ )'}
                        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
                    >
                        {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                        {!collapsed && <span>Recolher menu</span>}
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 inset-x-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
                        <Dumbbell className="w-5 h-5 text-brand-foreground" />
                    </div>
                    <div>
                        <span className="font-brand font-extrabold text-foreground text-sm tracking-tight">ADRIAN FIT</span>
                        <p className="text-xs text-muted-foreground font-medium">Coach PRO</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/personal/notifications"
                        className="p-2 text-muted-foreground hover:text-foreground relative rounded-xl hover:bg-muted transition-colors"
                        aria-label="Notificações"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadNotifications > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                                {formatBadge(unreadNotifications)}
                            </span>
                        )}
                    </Link>
                    <Avatar name={session?.user?.name || ''} size="sm" />
                </div>
            </header>

            {/* Main Area with Desktop TopHeader */}
            <div
                className={cn(
                    // min-w-0: with overflow-x-clip (needed for sticky) the column must still be allowed to shrink
                    'flex-1 min-w-0 flex flex-col min-h-dvh overflow-x-clip transition-[margin] duration-200',
                    collapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
                )}
            >
                <TopHeader />
                <main className="flex-1 pt-16 lg:pt-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-12 overflow-x-clip">
                    <div className="p-4 lg:p-8 w-full max-w-[1600px] mx-auto overflow-x-clip">
                        <Suspense fallback={<PageFallback />}>{children}</Suspense>
                    </div>
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <nav className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-card border-t border-border flex items-center justify-around px-4 z-50">
                {mobilePrimaryItems.map((item) => {
                    const isActive = isItemActive(pathname, item.href);
                    const Icon = item.icon;
                    const count = badgeCount(item.badge);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'relative flex flex-col items-center gap-1 p-2 transition-colors',
                                isActive ? 'text-primary' : 'text-muted-foreground'
                            )}
                        >
                            <Icon className="w-5 h-5" />
                            {count > 0 && <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-primary" aria-hidden />}
                            <span className="text-[11px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
                <button
                    onClick={() => setIsMoreMenuOpen(true)}
                    className={cn(
                        'flex flex-col items-center gap-1 p-2 transition-colors',
                        isMoreMenuOpen || mobileMoreItems.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
                            ? 'text-primary'
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
                            <h3 className="font-semibold text-foreground text-sm">Mais opções</h3>
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
                                                ? 'bg-primary/15 text-primary'
                                                : 'bg-muted text-muted-foreground hover:text-foreground'
                                        )}
                                        onClick={() => setIsMoreMenuOpen(false)}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="text-xs text-center font-medium leading-tight">
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <ShortcutsHelpDialog open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
        </div>
    );
}

export default function PersonalLayout({ children }: { children: React.ReactNode }) {
    return (
        <NotificationsProvider>
            <PageMetaProvider>
                <PersonalShell>{children}</PersonalShell>
            </PageMetaProvider>
        </NotificationsProvider>
    );
}
