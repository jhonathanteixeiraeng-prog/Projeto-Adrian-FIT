'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    Bell,
    CheckCheck,
    MessageCircle,
    CalendarCheck2,
    UtensilsCrossed,
    Dumbbell,
    ShieldAlert,
} from 'lucide-react';
import { Card, CardContent, Button } from '@/components/ui';

interface StudentNotification {
    id: string;
    type: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
}

function formatDateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getNotificationIcon(type: string) {
    switch (type) {
        case 'WORKOUT_REMINDER':
            return Dumbbell;
        case 'MEAL_REMINDER':
            return UtensilsCrossed;
        case 'CHECKIN_REMINDER':
            return CalendarCheck2;
        case 'LOW_ADHERENCE':
            return ShieldAlert;
        case 'NEW_MESSAGE':
            return MessageCircle;
        default:
            return Bell;
    }
}

export default function StudentNotificationsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notifications, setNotifications] = useState<StudentNotification[]>([]);
    const [unreadMessages, setUnreadMessages] = useState(0);

    const unreadNotifications = useMemo(
        () => notifications.filter((item) => !item.read).length,
        [notifications]
    );

    const loadNotifications = async () => {
        try {
            const response = await fetch('/api/student/notifications', { cache: 'no-store' });
            const data = await response.json();

            if (!data?.success) {
                setError(data?.error || 'Não foi possível carregar notificações.');
                return;
            }

            setNotifications(data?.data?.notifications || []);
            setUnreadMessages(Number(data?.data?.unreadMessages || 0));
            setError('');
        } catch {
            setError('Não foi possível carregar notificações.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, []);

    const markAllAsRead = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/student/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ readAll: true }),
            });
            const data = await response.json();
            if (!data?.success) {
                setError(data?.error || 'Erro ao marcar notificações como lidas.');
                return;
            }

            setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
            setUnreadMessages(0);
        } catch {
            setError('Erro ao marcar notificações como lidas.');
        } finally {
            setSaving(false);
        }
    };

    const hasAnyNotification = notifications.length > 0 || unreadMessages > 0;

    return (
        <div className="space-y-6 animate-in pb-8">
            <div className="flex items-center gap-3">
                <Link href="/student/home" className="p-2 rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-foreground">Notificações</h1>
                    <p className="text-sm text-muted-foreground">
                        {unreadNotifications + unreadMessages} pendente(s)
                    </p>
                </div>
                {(unreadNotifications > 0 || unreadMessages > 0) && (
                    <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={saving}>
                        <CheckCheck className="w-4 h-4" />
                        {saving ? 'Marcando...' : 'Marcar lidas'}
                    </Button>
                )}
            </div>

            {loading ? (
                <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">Carregando notificações...</CardContent>
                </Card>
            ) : error ? (
                <Card>
                    <CardContent className="p-6 text-center text-red-500">{error}</CardContent>
                </Card>
            ) : !hasAnyNotification ? (
                <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                        Você não possui notificações no momento.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {unreadMessages > 0 && (
                        <Card className="border-[#F88022]/40 bg-[#F88022]/10">
                            <CardContent className="p-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <MessageCircle className="w-5 h-5 text-[#F88022]" />
                                    <div>
                                        <p className="font-semibold text-foreground">Novas mensagens</p>
                                        <p className="text-sm text-muted-foreground">
                                            Você tem {unreadMessages} mensagem(ns) não lida(s).
                                        </p>
                                    </div>
                                </div>
                                <Link href="/student/chat">
                                    <Button size="sm" variant="secondary">Abrir chat</Button>
                                </Link>
                            </CardContent>
                        </Card>
                    )}

                    {notifications.map((notification) => {
                        const Icon = getNotificationIcon(notification.type);

                        return (
                            <Card key={notification.id} className={!notification.read ? 'border-[#F88022]/40' : ''}>
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${notification.read ? 'bg-muted text-muted-foreground' : 'bg-[#F88022]/20 text-[#F88022]'
                                            }`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-foreground">{notification.title}</p>
                                                {!notification.read && (
                                                    <span className="w-2 h-2 rounded-full bg-[#F88022]" />
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">{notification.body}</p>
                                            <p className="text-xs text-muted-foreground mt-2">
                                                {formatDateTime(notification.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
