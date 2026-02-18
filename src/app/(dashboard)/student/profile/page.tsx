'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import {
    User,
    Calendar,
    Target,
    LogOut,
    ChevronRight,
    Bell,
    Moon,
    Shield,
    HelpCircle,
    Star
} from 'lucide-react';
import { Card, CardContent, Button, Avatar, Badge } from '@/components/ui';
import { useTheme } from '@/components/providers';

interface StudentPersonalData {
    brandName?: string | null;
    user?: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
    };
}

interface StudentProfileData {
    goal?: string | null;
    trainingDays?: number;
    goalProgress?: number | null;
}

export default function StudentProfilePage() {
    const { data: session } = useSession();
    const { theme, setTheme } = useTheme();
    const [notifications, setNotifications] = useState(true);
    const [personal, setPersonal] = useState<StudentPersonalData | null>(null);
    const [studentProfile, setStudentProfile] = useState<StudentProfileData | null>(null);

    useEffect(() => {
        let active = true;

        const fetchProfileData = async () => {
            try {
                const [personalResponse, profileResponse] = await Promise.all([
                    fetch('/api/student/personal'),
                    fetch('/api/student/profile'),
                ]);
                const [personalData, profileData] = await Promise.all([
                    personalResponse.json(),
                    profileResponse.json(),
                ]);

                if (!active) return;

                if (personalData?.success && personalData?.data) {
                    setPersonal(personalData.data);
                }

                if (profileData?.success && profileData?.data) {
                    setStudentProfile(profileData.data);
                }
            } catch (error) {
                console.error('Erro ao carregar personal:', error);
            }
        };

        fetchProfileData();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const storedNotifications = localStorage.getItem('student_notifications_enabled');
        if (storedNotifications !== null) {
            setNotifications(storedNotifications === 'true');
        }
    }, []);

    const handleLogout = () => {
        signOut({ callbackUrl: '/login' });
    };

    const handleNotificationsChange = (enabled: boolean) => {
        setNotifications(enabled);
        localStorage.setItem('student_notifications_enabled', String(enabled));
    };

    const darkMode = theme === 'dark';
    const handleDarkModeChange = (enabled: boolean) => {
        setTheme(enabled ? 'dark' : 'light');
    };

    const personalDisplayName =
        personal?.user?.name ||
        session?.user?.personalTrainerName ||
        session?.user?.name ||
        'Seu Personal';
    const trainingDays = studentProfile?.trainingDays ?? 0;
    const goalText = studentProfile?.goal || 'Sem objetivo';
    const goalProgressText = studentProfile?.goalProgress === null || studentProfile?.goalProgress === undefined
        ? '--'
        : `${Math.round(studentProfile.goalProgress)}%`;

    const menuItems = [
        {
            icon: User,
            label: 'Dados Pessoais',
            href: '/student/profile/edit',
            color: 'text-blue-500',
        },
        {
            icon: Target,
            label: 'Minhas Metas',
            href: '/student/profile/goals',
            color: 'text-secondary',
        },
        {
            icon: Bell,
            label: 'Notificações',
            toggle: true,
            value: notifications,
            onChange: handleNotificationsChange,
            color: 'text-yellow-500',
        },
        {
            icon: Moon,
            label: 'Modo Escuro',
            toggle: true,
            value: darkMode,
            onChange: handleDarkModeChange,
            color: 'text-purple-500',
        },
        {
            icon: Shield,
            label: 'Privacidade',
            href: '/student/profile/privacy',
            color: 'text-accent',
        },
        {
            icon: HelpCircle,
            label: 'Ajuda',
            href: '/student/profile/help',
            color: 'text-orange-500',
        },
    ];

    return (
        <div className="space-y-6 animate-in pb-8">
            {/* Header */}
            <div className="text-center">
                <Avatar name={session?.user?.name || ''} size="xl" className="mx-auto mb-4" />
                <h1 className="text-xl font-bold text-foreground">{session?.user?.name}</h1>
                <p className="text-muted-foreground">{session?.user?.email}</p>
                <Badge variant="success" className="mt-2">Aluno Ativo</Badge>
            </div>

            {/* Personal Info */}
            <Card>
                <CardContent className="p-4">
                    <h2 className="font-semibold text-foreground mb-3">Meu Personal</h2>
                    <div className="flex items-center gap-3">
                        <Avatar name={personalDisplayName} size="md" />
                        <div className="flex-1">
                            <p className="font-medium text-foreground">{personalDisplayName}</p>
                            <p className="text-sm text-muted-foreground">Personal Trainer</p>
                        </div>
                        <Link href="/student/chat">
                            <Button variant="outline" size="sm">Chat</Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <Card>
                <CardContent className="p-4">
                    <h2 className="font-semibold text-foreground mb-3">Meu Progresso</h2>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <Calendar className="w-5 h-5 text-accent mx-auto mb-1" />
                            <p className="text-lg font-bold text-foreground">{trainingDays}</p>
                            <p className="text-xs text-muted-foreground">Dias de treino</p>
                        </div>
                        <div>
                            <Target className="w-5 h-5 text-secondary mx-auto mb-1" />
                            <p className="text-lg font-bold text-foreground">{goalText}</p>
                            <p className="text-xs text-muted-foreground">Objetivo</p>
                        </div>
                        <div>
                            <Star className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                            <p className="text-lg font-bold text-foreground">{goalProgressText}</p>
                            <p className="text-xs text-muted-foreground">Da meta</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Menu */}
            <Card>
                <CardContent className="p-0">
                    {menuItems.map((item, index) => (
                        <div key={index}>
                            {item.toggle ? (
                                <div className="flex items-center gap-3 p-4">
                                    <div className={`w-10 h-10 rounded-xl bg-muted flex items-center justify-center ${item.color}`}>
                                        <item.icon className="w-5 h-5" />
                                    </div>
                                    <span className="flex-1 font-medium text-foreground">{item.label}</span>
                                    <button
                                        onClick={() => item.onChange(!item.value)}
                                        className={`w-12 h-6 rounded-full transition-colors ${item.value ? 'bg-secondary' : 'bg-muted'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${item.value ? 'translate-x-6' : 'translate-x-0.5'
                                            }`} />
                                    </button>
                                </div>
                            ) : (
                                <Link href={item.href || '#'}>
                                    <div className="flex items-center gap-3 p-4 hover:bg-muted transition-colors">
                                        <div className={`w-10 h-10 rounded-xl bg-muted flex items-center justify-center ${item.color}`}>
                                            <item.icon className="w-5 h-5" />
                                        </div>
                                        <span className="flex-1 font-medium text-foreground">{item.label}</span>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                </Link>
                            )}
                            {index < menuItems.length - 1 && <div className="h-px bg-border mx-4" />}
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Logout */}
            <Button
                variant="outline"
                className="w-full text-red-500 border-red-500/20 hover:bg-red-500/10"
                onClick={handleLogout}
            >
                <LogOut className="w-5 h-5" />
                Sair da Conta
            </Button>

            {/* Version */}
            <p className="text-center text-xs text-muted-foreground">
                Enerflux Fit Coach v0.1.0
            </p>
        </div>
    );
}
