'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
    Users,
    TrendingUp,
    AlertTriangle,
    AlertOctagon,
    CheckCircle2,
    Clock,
    ChevronRight,
    UserPlus,
    Dumbbell,
    Utensils,
    Loader2,
    RefreshCw,
    Radio,
    MessageCircle,
    ExternalLink,
    Sparkles,
    Bell,
    Check,
    Activity
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Avatar, Button } from '@/components/ui';

interface ActivityEvent {
    id: string;
    type: 'WORKOUT_COMPLETED' | 'CHECKIN_SUBMITTED' | 'FOOD_SUBSTITUTED' | 'MESSAGE_RECEIVED';
    title: string;
    description: string;
    timestamp: string;
    studentId: string;
    studentName: string;
    studentAvatar?: string | null;
    meta?: Record<string, any>;
}

interface RadarStudent {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    riskLevel: 'CRITICAL' | 'WARNING';
    daysSinceLastWorkout: number | null;
    lastWorkoutDate: string | null;
    workoutAdherence: number | null;
    dietAdherence: number | null;
    daysSinceLastCheckin: number | null;
    reasons: string[];
    whatsappUrl: string | null;
}

interface DashboardData {
    totalStudents: number;
    activeStudents: number;
    studentsWithoutWorkout72h: number;
    averageWorkoutAdherence: number;
    averageDietAdherence: number;
    pendingCheckins: number;
    lowAdherenceStudents: Array<{
        id: string;
        name: string;
        email: string;
        workoutAdherence: number;
        dietAdherence: number;
    }>;
    studentsWithoutWorkout72hList: Array<{
        id: string;
        name: string;
        daysInactive?: number | null;
    }>;
    retentionRadar?: {
        criticalCount: number;
        warningCount: number;
        totalAtRisk: number;
        students: RadarStudent[];
    };
}

const defaultStats: DashboardData = {
    totalStudents: 0,
    activeStudents: 0,
    studentsWithoutWorkout72h: 0,
    averageWorkoutAdherence: 0,
    averageDietAdherence: 0,
    pendingCheckins: 0,
    lowAdherenceStudents: [],
    studentsWithoutWorkout72hList: [],
    retentionRadar: {
        criticalCount: 0,
        warningCount: 0,
        totalAtRisk: 0,
        students: [],
    },
};

export default function PersonalDashboard() {
    const { data: session } = useSession();
    const [stats, setStats] = useState<DashboardData>(defaultStats);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activities, setActivities] = useState<ActivityEvent[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [activityFilter, setActivityFilter] = useState<'ALL' | 'WORKOUT' | 'CHECKIN' | 'DIET'>('ALL');

    useEffect(() => {
        fetchDashboardStats();
        fetchLiveFeed();
    }, []);

    const fetchLiveFeed = async () => {
        try {
            setLoadingActivities(true);
            const res = await fetch('/api/personal/feed');
            const json = await res.json();
            if (json.success) {
                setActivities(json.data || []);
            }
        } catch (err) {
            console.error('Erro ao carregar feed:', err);
        } finally {
            setLoadingActivities(false);
        }
    };

    const handleRefreshAll = () => {
        fetchDashboardStats();
        fetchLiveFeed();
    };

    const formatRelativeTime = (dateString: string) => {
        try {
            const now = new Date();
            const date = new Date(dateString);
            const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
            if (diffInMinutes < 1) return 'Agora mesmo';
            if (diffInMinutes < 60) return `Há ${diffInMinutes} min`;
            const diffInHours = Math.floor(diffInMinutes / 60);
            if (diffInHours < 24) return `Há ${diffInHours}h`;
            const diffInDays = Math.floor(diffInHours / 24);
            if (diffInDays === 1) return 'Ontem';
            return `Há ${diffInDays} dias`;
        } catch {
            return '';
        }
    };

    const getActivityIcon = (type: ActivityEvent['type']) => {
        switch (type) {
            case 'WORKOUT_COMPLETED':
                return { icon: Dumbbell, color: 'text-[#F88022]', bg: 'bg-[#F88022]/15' };
            case 'CHECKIN_SUBMITTED':
                return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/15' };
            case 'FOOD_SUBSTITUTED':
                return { icon: Utensils, color: 'text-blue-500', bg: 'bg-blue-500/15' };
            case 'MESSAGE_RECEIVED':
                return { icon: MessageCircle, color: 'text-purple-500', bg: 'bg-purple-500/15' };
            default:
                return { icon: Activity, color: 'text-[#F88022]', bg: 'bg-[#F88022]/15' };
        }
    };

    const filteredActivities = activities.filter((act) => {
        if (activityFilter === 'ALL') return true;
        if (activityFilter === 'WORKOUT') return act.type === 'WORKOUT_COMPLETED';
        if (activityFilter === 'CHECKIN') return act.type === 'CHECKIN_SUBMITTED';
        if (activityFilter === 'DIET') return act.type === 'FOOD_SUBSTITUTED';
        return true;
    });

    const fetchDashboardStats = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await fetch('/api/dashboard');
            const result = await response.json();

            if (result.success) {
                setStats(result.data);
            } else {
                setError(result.error || 'Erro ao carregar dados');
            }
        } catch (err) {
            setError('Erro ao conectar com o servidor');
        } finally {
            setLoading(false);
        }
    };

    const radar = stats.retentionRadar || {
        criticalCount: 0,
        warningCount: 0,
        totalAtRisk: 0,
        students: [],
    };

    const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
    const [sentReminders, setSentReminders] = useState<Record<string, boolean>>({});
    const [reminderFeedback, setReminderFeedback] = useState<string | null>(null);

    const handleSendReminder = async (studentId: string, type: 'WORKOUT_REMINDER' | 'CHECKIN_REMINDER' = 'WORKOUT_REMINDER') => {
        try {
            setSendingReminderId(studentId);
            const res = await fetch('/api/personal/reminders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, type }),
            });
            const data = await res.json();
            if (data.success) {
                if (studentId === 'ALL_AT_RISK') {
                    const allMap: Record<string, boolean> = {};
                    (radar.students || []).forEach(s => { allMap[s.id] = true; });
                    setSentReminders(prev => ({ ...prev, ...allMap }));
                } else {
                    setSentReminders(prev => ({ ...prev, [studentId]: true }));
                }
                setReminderFeedback(data.message || 'Lembrete enviado com sucesso!');
                setTimeout(() => setReminderFeedback(null), 4000);
            } else {
                alert(data.error || 'Erro ao enviar lembrete');
            }
        } catch {
            alert('Erro ao conectar com o servidor');
        } finally {
            setSendingReminderId(null);
        }
    };

    const statCards = [
        {
            title: 'Total de Alunos',
            value: stats.totalStudents,
            subtitle: `${stats.activeStudents} ativos`,
            icon: Users,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
        },
        {
            title: 'Adesão Treino',
            value: `${stats.averageWorkoutAdherence}%`,
            subtitle: 'Média últimos 7 dias',
            icon: Dumbbell,
            color: 'text-[#F88022]',
            bgColor: 'bg-[#F88022]/10',
        },
        {
            title: 'Adesão Dieta',
            value: `${stats.averageDietAdherence}%`,
            subtitle: 'Média últimos 7 dias',
            icon: Utensils,
            color: 'text-green-500',
            bgColor: 'bg-green-500/10',
        },
        {
            title: 'Radar de Retenção',
            value: radar.totalAtRisk,
            subtitle: radar.totalAtRisk > 0 ? `${radar.criticalCount} críticos / ${radar.warningCount} alertas` : 'Nenhum aluno em risco',
            icon: Radio,
            color: radar.criticalCount > 0 ? 'text-red-500' : radar.warningCount > 0 ? 'text-yellow-500' : 'text-emerald-500',
            bgColor: radar.criticalCount > 0 ? 'bg-red-500/10' : radar.warningCount > 0 ? 'bg-yellow-500/10' : 'bg-emerald-500/10',
        },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#F88022]" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                        Olá, {session?.user?.name?.split(' ')[0] || 'Personal'}! 👋
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Acompanhe o engajamento e a evolução dos seus alunos em tempo real
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefreshAll}
                        className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border"
                        title="Atualizar dados"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                    <Link
                        href="/personal/students/new"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F88022] text-white rounded-xl font-medium hover:bg-[#F88022]/90 transition-colors shadow-sm"
                    >
                        <UserPlus className="w-5 h-5" />
                        Novo Aluno
                    </Link>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat, index) => (
                    <Card key={index} className="relative overflow-hidden">
                        <CardContent className="p-4 lg:p-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                                </div>
                                {stat.title === 'Radar de Retenção' && radar.totalAtRisk > 0 && (
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                    </span>
                                )}
                            </div>
                            <p className="text-2xl lg:text-3xl font-bold text-foreground">{stat.value}</p>
                            <p className="text-sm font-medium text-foreground mt-1">{stat.title}</p>
                            <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Radar de Retenção & Alunos em Risco (Churn Alert) */}
            {stats.totalStudents > 0 && (
                <Card className="border-border">
                    <CardHeader className="border-b border-border pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${radar.totalAtRisk > 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                    <Radio className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        Radar de Retenção & Alerta de Churn
                                        {radar.totalAtRisk > 0 && (
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                                                {radar.totalAtRisk} {radar.totalAtRisk === 1 ? 'aluno em risco' : 'alunos em risco'}
                                            </span>
                                        )}
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Detecção proativa de inatividade, baixa adesão e check-ins pendentes para evitar cancelamentos
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {radar.totalAtRisk > 0 && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-8 border-border text-foreground hover:bg-muted"
                                        onClick={() => handleSendReminder('ALL_AT_RISK')}
                                        disabled={sendingReminderId === 'ALL_AT_RISK'}
                                    >
                                        {sendingReminderId === 'ALL_AT_RISK' ? (
                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                        ) : (
                                            <Bell className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                                        )}
                                        Lembrar Todos
                                    </Button>
                                )}
                                {radar.criticalCount > 0 && (
                                    <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-500/15 text-red-500 border border-red-500/30 flex items-center gap-1.5">
                                        <AlertOctagon className="w-3.5 h-3.5" />
                                        {radar.criticalCount} Crítico
                                    </span>
                                )}
                                {radar.warningCount > 0 && (
                                    <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30 flex items-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        {radar.warningCount} Alerta
                                    </span>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {reminderFeedback && (
                            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 animate-in">
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                <span>{reminderFeedback}</span>
                            </div>
                        )}
                        {radar.students.length === 0 ? (
                            <div className="py-8 text-center space-y-2">
                                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <h3 className="text-base font-semibold text-foreground">
                                    Parabéns! Sua retenção está em 100%
                                </h3>
                                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                    Nenhum aluno ativo apresenta inatividade prolongada ou queda crítica de adesão esta semana.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {radar.students.map((student) => {
                                    const isCritical = student.riskLevel === 'CRITICAL';
                                    return (
                                        <div
                                            key={student.id}
                                            className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4"
                                        >
                                            <div className="flex items-start sm:items-center gap-3 min-w-0">
                                                <Avatar name={student.name} size="md" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Link
                                                            href={`/personal/students/${student.id}`}
                                                            className="font-semibold text-foreground hover:text-[#F88022] transition-colors truncate"
                                                        >
                                                            {student.name}
                                                        </Link>
                                                        <span
                                                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                                isCritical
                                                                    ? 'bg-red-500/15 text-red-500 border border-red-500/30'
                                                                    : 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30'
                                                            }`}
                                                        >
                                                            {isCritical ? 'Risco Alto' : 'Alerta'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                                                    {/* Reasons Chips */}
                                                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                                        {student.reasons.map((reason, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-foreground/90 font-medium"
                                                            >
                                                                • {reason}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSendReminder(
                                                        student.id,
                                                        student.reasons.some(r => r.toLowerCase().includes('check-in')) ? 'CHECKIN_REMINDER' : 'WORKOUT_REMINDER'
                                                    )}
                                                    disabled={sentReminders[student.id] || sendingReminderId === student.id}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                                                        sentReminders[student.id]
                                                            ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                                            : 'bg-muted hover:bg-muted/80 text-foreground border-border'
                                                    }`}
                                                    title="Enviar notificação no app do aluno"
                                                >
                                                    {sendingReminderId === student.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : sentReminders[student.id] ? (
                                                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                    ) : (
                                                        <Bell className="w-3.5 h-3.5 text-amber-500" />
                                                    )}
                                                    {sentReminders[student.id] ? 'Notificado' : 'Notificar'}
                                                </button>
                                                {student.whatsappUrl && (
                                                    <a
                                                        href={student.whatsappUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-colors text-xs font-medium border border-emerald-500/30"
                                                        title="Enviar mensagem no WhatsApp"
                                                    >
                                                        <MessageCircle className="w-3.5 h-3.5" />
                                                        WhatsApp
                                                    </a>
                                                )}
                                                <Link
                                                    href={`/personal/chat/${student.id}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-colors text-xs font-medium border border-border"
                                                >
                                                    <MessageCircle className="w-3.5 h-3.5 text-[#F88022]" />
                                                    Chat
                                                </Link>
                                                <Link
                                                    href={`/personal/students/${student.id}`}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F88022]/10 hover:bg-[#F88022]/20 text-[#F88022] transition-colors text-xs font-medium"
                                                >
                                                    Ficha
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Live Activity Feed (Pulse em Tempo Real) */}
            {stats.totalStudents > 0 && (
                <Card className="border-border">
                    <CardHeader className="border-b border-border pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#F88022]/15 text-[#F88022] flex items-center justify-center">
                                    <Activity className="w-5 h-5 animate-pulse" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-lg">Feed de Atividades ao Vivo</CardTitle>
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                            Pulse
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Acompanhe treinos concluídos, check-ins, substituições de dieta e mensagens em tempo real
                                    </p>
                                </div>
                            </div>

                            {/* Filter tabs */}
                            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border">
                                <button
                                    type="button"
                                    onClick={() => setActivityFilter('ALL')}
                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                                        activityFilter === 'ALL'
                                            ? 'bg-card text-foreground shadow-sm font-semibold'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Todos
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActivityFilter('WORKOUT')}
                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                                        activityFilter === 'WORKOUT'
                                            ? 'bg-card text-foreground shadow-sm font-semibold'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Treinos
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActivityFilter('CHECKIN')}
                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                                        activityFilter === 'CHECKIN'
                                            ? 'bg-card text-foreground shadow-sm font-semibold'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Check-ins
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActivityFilter('DIET')}
                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                                        activityFilter === 'DIET'
                                            ? 'bg-card text-foreground shadow-sm font-semibold'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Dietas
                                </button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {loadingActivities ? (
                            <div className="py-12 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-[#F88022]" />
                            </div>
                        ) : filteredActivities.length === 0 ? (
                            <div className="py-8 text-center space-y-2">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                                    <Activity className="w-6 h-6" />
                                </div>
                                <h3 className="text-sm font-semibold text-foreground">
                                    Nenhuma atividade encontrada
                                </h3>
                                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                    Quando seus alunos completarem treinos, enviarem check-ins ou realizarem trocas de alimentos, as notificações aparecerão aqui.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {filteredActivities.slice(0, 10).map((activity) => {
                                    const iconConfig = getActivityIcon(activity.type);
                                    const IconComponent = iconConfig.icon;

                                    return (
                                        <div
                                            key={activity.id}
                                            className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 group hover:bg-muted/40 px-2 rounded-xl transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconConfig.bg} ${iconConfig.color}`}>
                                                    <IconComponent className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <Link
                                                            href={`/personal/students/${activity.studentId}`}
                                                            className="text-xs font-bold text-foreground hover:text-[#F88022] transition-colors truncate"
                                                        >
                                                            {activity.studentName}
                                                        </Link>
                                                        <span className="text-[11px] text-muted-foreground truncate">
                                                            • {activity.title}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                        {activity.description}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatRelativeTime(activity.timestamp)}
                                                </span>
                                                <Link
                                                    href={`/personal/students/${activity.studentId}`}
                                                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                    title="Ver Aluno"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {stats.totalStudents === 0 && (
                <Card>
                    <CardContent className="p-12 text-center">
                        <div className="w-20 h-20 rounded-full bg-[#F88022]/10 flex items-center justify-center mx-auto mb-4">
                            <Users className="w-10 h-10 text-[#F88022]" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2">
                            Nenhum aluno cadastrado
                        </h3>
                        <p className="text-muted-foreground mb-6">
                            Comece adicionando seu primeiro aluno para ver as estatísticas aqui
                        </p>
                        <Link href="/personal/students/new">
                            <Button className="bg-[#F88022] hover:bg-[#F88022]/90 text-white">
                                <UserPlus className="w-5 h-5" />
                                Cadastrar Primeiro Aluno
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            )}

            {stats.totalStudents > 0 && (
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Low Adherence Students */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                Alunos com Baixa Adesão
                            </CardTitle>
                            <Badge variant="warning">{stats.lowAdherenceStudents.length}</Badge>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {stats.lowAdherenceStudents.map((student) => (
                                <Link
                                    key={student.id}
                                    href={`/personal/students/${student.id}`}
                                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors"
                                >
                                    <Avatar name={student.name || ''} size="md" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-foreground truncate">
                                            {student.name}
                                        </p>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Dumbbell className="w-3 h-3" />
                                                {student.workoutAdherence}%
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Utensils className="w-3 h-3" />
                                                {student.dietAdherence}%
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                </Link>
                            ))}
                            {stats.lowAdherenceStudents.length === 0 && (
                                <div className="text-center py-6 text-muted-foreground">
                                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
                                    <p>Todos os alunos estão com boa adesão!</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pending Check-ins / Students without workout */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-purple-500" />
                                Sem Treinar há 72h+
                            </CardTitle>
                            <Badge variant="info">{stats.studentsWithoutWorkout72h}</Badge>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {stats.studentsWithoutWorkout72hList?.map((student) => (
                                    <Link
                                        key={student.id}
                                        href={`/personal/students/${student.id}`}
                                        className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors"
                                    >
                                        <Avatar name={student.name} size="md" />
                                        <div className="flex-1">
                                            <p className="font-medium text-foreground">{student.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {student.daysInactive != null
                                                    ? `Último treino há ${student.daysInactive} dias`
                                                    : 'Nenhum treino registrado'}
                                            </p>
                                        </div>
                                        <Badge variant="warning">Inativo</Badge>
                                    </Link>
                                ))}
                                {stats.studentsWithoutWorkout72h === 0 && (
                                    <div className="text-center py-6 text-muted-foreground">
                                        <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
                                        <p>Todos os alunos estão treinando regularmente!</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Link
                            href="/personal/students/new"
                            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted hover:bg-muted/70 transition-colors"
                        >
                            <div className="w-12 h-12 rounded-xl bg-[#F88022]/10 flex items-center justify-center">
                                <UserPlus className="w-6 h-6 text-[#F88022]" />
                            </div>
                            <span className="text-sm font-medium text-foreground text-center">Novo Aluno</span>
                        </Link>
                        <Link
                            href="/personal/exercises"
                            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted hover:bg-muted/70 transition-colors"
                        >
                            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                                <Dumbbell className="w-6 h-6 text-green-500" />
                            </div>
                            <span className="text-sm font-medium text-foreground text-center">Exercícios</span>
                        </Link>
                        <Link
                            href="/personal/students"
                            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted hover:bg-muted/70 transition-colors"
                        >
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <Users className="w-6 h-6 text-blue-500" />
                            </div>
                            <span className="text-sm font-medium text-foreground text-center">Ver Alunos</span>
                        </Link>
                        <Link
                            href="/personal/chat"
                            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted hover:bg-muted/70 transition-colors"
                        >
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-purple-500" />
                            </div>
                            <span className="text-sm font-medium text-foreground text-center">Chat</span>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
