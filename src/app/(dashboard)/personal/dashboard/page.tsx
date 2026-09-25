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
    Bell,
    Check,
    Activity,
    Calendar,
    Flame,
    ArrowUpRight,
    Sparkles,
    ShieldAlert,
    ShieldCheck
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Avatar, Button, useToast } from '@/components/ui';

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
    const { toast } = useToast();

    const [stats, setStats] = useState<DashboardData>(defaultStats);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [activities, setActivities] = useState<ActivityEvent[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [activityFilter, setActivityFilter] = useState<'ALL' | 'WORKOUT' | 'CHECKIN' | 'DIET'>('ALL');
    const [radarFilter, setRadarFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');

    // Reminder state
    const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
    const [sentReminders, setSentReminders] = useState<Record<string, boolean>>({});

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

    const fetchDashboardStats = async (isManual = false) => {
        try {
            if (isManual) setIsRefreshing(true);
            else setLoading(true);
            setError('');

            const response = await fetch('/api/dashboard');
            const result = await response.json();

            if (result.success) {
                setStats(result.data);
                if (isManual) {
                    toast.success('Dados atualizados!', 'Métricas e atividades sincronizadas.');
                }
            } else {
                setError(result.error || 'Erro ao carregar dados');
            }
        } catch {
            setError('Erro ao conectar com o servidor');
            if (isManual) {
                toast.error('Erro ao sincronizar dados');
            }
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleRefreshAll = () => {
        fetchDashboardStats(true);
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

    const radar = stats.retentionRadar || {
        criticalCount: 0,
        warningCount: 0,
        totalAtRisk: 0,
        students: [],
    };

    const filteredRadarStudents = (radar.students || []).filter((s) => {
        if (radarFilter === 'CRITICAL') return s.riskLevel === 'CRITICAL';
        if (radarFilter === 'WARNING') return s.riskLevel === 'WARNING';
        return true;
    });

    const handleSendReminder = async (
        studentId: string,
        type: 'WORKOUT_REMINDER' | 'CHECKIN_REMINDER' = 'WORKOUT_REMINDER'
    ) => {
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
                    (radar.students || []).forEach((s) => {
                        allMap[s.id] = true;
                    });
                    setSentReminders((prev) => ({ ...prev, ...allMap }));
                    toast.success('Lembretes em lote enviados!', 'Todos os alunos em risco foram notificados no app.');
                } else {
                    setSentReminders((prev) => ({ ...prev, [studentId]: true }));
                    toast.success('Lembrete enviado!', 'O aluno foi notificado com sucesso.');
                }
            } else {
                toast.error(data.error || 'Erro ao enviar lembrete');
            }
        } catch {
            toast.error('Erro ao conectar com o servidor');
        } finally {
            setSendingReminderId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#F88022]" />
            </div>
        );
    }

    return (
        <div className="space-y-7 animate-in">
            {/* Header Executivo */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
                            Olá, {session?.user?.name?.split(' ')[0] || 'Personal'}! 👋
                        </h1>
                        <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F88022]/10 text-[#F88022] border border-[#F88022]/20">
                            Dashboard Executivo
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Acompanhe o engajamento, retenção e a evolução dos seus alunos em tempo real
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefreshAll}
                        disabled={isRefreshing}
                        className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border"
                        title="Atualizar dados"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#F88022]' : ''}`} />
                    </button>
                    <Link
                        href="/personal/students/new"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F88022] text-white rounded-xl text-sm font-semibold hover:bg-[#F88022]/90 transition-all shadow-sm shadow-[#F88022]/20"
                    >
                        <UserPlus className="w-4 h-4" />
                        Novo Aluno
                    </Link>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* SaaS Stat Cards (KPIs Executivos) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total de Alunos */}
                <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm relative overflow-hidden group hover:border-[#F88022]/50 transition-colors">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alunos Ativos</span>
                            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <Users className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-extrabold text-foreground">{stats.activeStudents}</p>
                            <span className="text-xs text-muted-foreground">de {stats.totalStudents} total</span>
                        </div>
                        <div className="mt-3 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                                style={{
                                    width: `${stats.totalStudents > 0 ? (stats.activeStudents / stats.totalStudents) * 100 : 0}%`,
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Adesão Treino */}
                <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm relative overflow-hidden group hover:border-[#F88022]/50 transition-colors">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adesão Treinos</span>
                            <div className="w-9 h-9 rounded-xl bg-[#F88022]/10 flex items-center justify-center text-[#F88022]">
                                <Dumbbell className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-extrabold text-foreground">{stats.averageWorkoutAdherence}%</p>
                            <span className="text-xs text-muted-foreground">média 7 dias</span>
                        </div>
                        <div className="mt-3 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-[#F88022] h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, stats.averageWorkoutAdherence))}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Adesão Dieta */}
                <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm relative overflow-hidden group hover:border-[#F88022]/50 transition-colors">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adesão Dieta</span>
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <Utensils className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-extrabold text-foreground">{stats.averageDietAdherence}%</p>
                            <span className="text-xs text-muted-foreground">média 7 dias</span>
                        </div>
                        <div className="mt-3 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, stats.averageDietAdherence))}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Radar de Retenção */}
                <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm relative overflow-hidden group hover:border-[#F88022]/50 transition-colors">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Radar Churn</span>
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                radar.totalAtRisk > 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                            }`}>
                                {radar.totalAtRisk > 0 ? (
                                    <ShieldAlert className="w-4 h-4" />
                                ) : (
                                    <ShieldCheck className="w-4 h-4" />
                                )}
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className={`text-3xl font-extrabold ${radar.totalAtRisk > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {radar.totalAtRisk}
                            </p>
                            <span className="text-xs text-muted-foreground">
                                {radar.totalAtRisk === 0 ? 'Alunos 100% seguros' : `${radar.criticalCount} críticos / ${radar.warningCount} alertas`}
                            </span>
                        </div>
                        <div className="mt-3 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-1.5 rounded-full transition-all duration-500 ${
                                    radar.totalAtRisk > 0 ? 'bg-red-500' : 'bg-emerald-500'
                                }`}
                                style={{
                                    width: `${stats.totalStudents > 0 ? Math.min(100, (radar.totalAtRisk / stats.totalStudents) * 100) : 0}%`,
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Radar de Retenção & Alunos em Risco (Churn Alert) */}
            {stats.totalStudents > 0 && (
                <Card className="border border-border/80 shadow-sm bg-card/80 backdrop-blur-sm">
                    <CardHeader className="border-b border-border/70 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                    radar.totalAtRisk > 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                                }`}>
                                    <Radio className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-lg font-bold">Radar de Retenção & Churn</CardTitle>
                                        {radar.totalAtRisk > 0 && (
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/20">
                                                {radar.totalAtRisk} {radar.totalAtRisk === 1 ? 'aluno em risco' : 'alunos em risco'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Detecção precoce de inatividade e baixa adesão para prevenir cancelamentos antes do vencimento
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                {radar.totalAtRisk > 0 && (
                                    <>
                                        {/* Filter chips */}
                                        <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border text-xs">
                                            <button
                                                type="button"
                                                onClick={() => setRadarFilter('ALL')}
                                                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                                                    radarFilter === 'ALL'
                                                        ? 'bg-card text-foreground shadow-sm font-semibold'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                Todos ({radar.totalAtRisk})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRadarFilter('CRITICAL')}
                                                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                                                    radarFilter === 'CRITICAL'
                                                        ? 'bg-card text-red-500 shadow-sm font-semibold'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                Críticos ({radar.criticalCount})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRadarFilter('WARNING')}
                                                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                                                    radarFilter === 'WARNING'
                                                        ? 'bg-card text-yellow-600 dark:text-yellow-400 shadow-sm font-semibold'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                Alertas ({radar.warningCount})
                                            </button>
                                        </div>

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
                                    </>
                                )}
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-4">
                        {radar.students.length === 0 ? (
                            <div className="py-8 text-center space-y-2">
                                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <h3 className="text-base font-semibold text-foreground">
                                    Retenção exemplar! 100% dos alunos engajados
                                </h3>
                                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                                    Nenhum aluno ativo apresenta inatividade prolongada ou queda crítica de adesão esta semana.
                                </p>
                            </div>
                        ) : filteredRadarStudents.length === 0 ? (
                            <p className="text-center py-6 text-xs text-muted-foreground">
                                Nenhum aluno nesta categoria de risco.
                            </p>
                        ) : (
                            <div className="divide-y divide-border/60">
                                {filteredRadarStudents.map((student) => {
                                    const isCritical = student.riskLevel === 'CRITICAL';
                                    return (
                                        <div
                                            key={student.id}
                                            className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-muted/30 px-2 rounded-xl transition-colors"
                                        >
                                            <div className="flex items-start sm:items-center gap-3 min-w-0">
                                                <Avatar name={student.name} size="md" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Link
                                                            href={`/personal/students/${student.id}`}
                                                            className="font-semibold text-sm text-foreground hover:text-[#F88022] transition-colors truncate"
                                                        >
                                                            {student.name}
                                                        </Link>
                                                        <span
                                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                                isCritical
                                                                    ? 'bg-red-500/15 text-red-500 border border-red-500/30'
                                                                    : 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30'
                                                            }`}
                                                        >
                                                            {isCritical ? 'Crítico' : 'Alerta'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                                                    {/* Motivos */}
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
                                            <div className="flex items-center gap-2 self-end md:self-center flex-wrap shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSendReminder(
                                                            student.id,
                                                            student.reasons.some((r) => r.toLowerCase().includes('check-in'))
                                                                ? 'CHECKIN_REMINDER'
                                                                : 'WORKOUT_REMINDER'
                                                        )
                                                    }
                                                    disabled={sentReminders[student.id] || sendingReminderId === student.id}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                                                        sentReminders[student.id]
                                                            ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                                            : 'bg-muted hover:bg-muted/80 text-foreground border-border'
                                                    }`}
                                                    title="Enviar notificação push no app do aluno"
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
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-colors text-xs font-semibold border border-emerald-500/30"
                                                        title="Abrir conversa no WhatsApp"
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
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F88022]/10 hover:bg-[#F88022]/20 text-[#F88022] transition-colors text-xs font-semibold"
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

            {/* Pulse Live Feed */}
            {stats.totalStudents > 0 && (
                <Card className="border border-border/80 shadow-sm bg-card/80 backdrop-blur-sm">
                    <CardHeader className="border-b border-border/70 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#F88022]/15 text-[#F88022] flex items-center justify-center">
                                    <Activity className="w-5 h-5 animate-pulse" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-lg font-bold">Feed de Atividades ao Vivo</CardTitle>
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                            Pulse
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Treinos concluídos, check-ins e trocas de alimentos em tempo real
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
                                <h3 className="text-sm font-semibold text-foreground">Nenhuma atividade recente</h3>
                                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                    As notificações de treinos concluídos e check-ins aparecerão aqui automaticamente.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/60">
                                {filteredActivities.slice(0, 10).map((activity) => {
                                    const iconConfig = getActivityIcon(activity.type);
                                    const IconComponent = iconConfig.icon;

                                    return (
                                        <div
                                            key={activity.id}
                                            className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 group hover:bg-muted/40 px-2 rounded-xl transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconConfig.bg} ${iconConfig.color}`}
                                                >
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

                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
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

            {/* Dual Grid: Baixa Adesão vs Inativos 72h+ */}
            {stats.totalStudents > 0 && (
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Alunos com Baixa Adesão */}
                    <Card className="border border-border/80 shadow-sm bg-card/80 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                Alunos com Baixa Adesão
                            </CardTitle>
                            <Badge variant={stats.lowAdherenceStudents.length > 0 ? 'warning' : 'default'} className="text-xs">
                                {stats.lowAdherenceStudents.length}
                            </Badge>
                        </CardHeader>
                        <CardContent className="pt-3 space-y-2.5">
                            {stats.lowAdherenceStudents.map((student) => (
                                <Link
                                    key={student.id}
                                    href={`/personal/students/${student.id}`}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                                >
                                    <Avatar name={student.name || ''} size="md" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-foreground truncate">{student.name}</p>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                            <span className="flex items-center gap-1 font-medium text-foreground">
                                                <Dumbbell className="w-3.5 h-3.5 text-[#F88022]" />
                                                Treino: {student.workoutAdherence}%
                                            </span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1 font-medium text-foreground">
                                                <Utensils className="w-3.5 h-3.5 text-emerald-500" />
                                                Dieta: {student.dietAdherence}%
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </Link>
                            ))}
                            {stats.lowAdherenceStudents.length === 0 && (
                                <div className="text-center py-6 text-muted-foreground">
                                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                                    <p className="text-xs font-medium">Todos os alunos estão com boa adesão!</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Sem Treinar há 72h+ */}
                    <Card className="border border-border/80 shadow-sm bg-card/80 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Clock className="w-4 h-4 text-purple-500" />
                                Sem Treinar há 72h+
                            </CardTitle>
                            <Badge variant={stats.studentsWithoutWorkout72h > 0 ? 'warning' : 'default'} className="text-xs">
                                {stats.studentsWithoutWorkout72h}
                            </Badge>
                        </CardHeader>
                        <CardContent className="pt-3">
                            <div className="space-y-2.5">
                                {stats.studentsWithoutWorkout72hList?.map((student) => (
                                    <Link
                                        key={student.id}
                                        href={`/personal/students/${student.id}`}
                                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                                    >
                                        <Avatar name={student.name} size="md" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-foreground truncate">{student.name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {student.daysInactive != null
                                                    ? `Último treino concluído há ${student.daysInactive} dias`
                                                    : 'Nenhum treino registrado ainda'}
                                            </p>
                                        </div>
                                        <Badge variant="warning" className="text-[11px] shrink-0">
                                            Inativo
                                        </Badge>
                                    </Link>
                                ))}
                                {stats.studentsWithoutWorkout72h === 0 && (
                                    <div className="text-center py-6 text-muted-foreground">
                                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                                        <p className="text-xs font-medium">Todos os alunos estão treinando regularmente!</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Ações Rápidas SaaS */}
            <Card className="border border-border/80 shadow-sm bg-card/60 backdrop-blur-sm">
                <CardHeader className="pb-3 border-b border-border/60">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#F88022]" />
                        Central de Ações Rápidas
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Link
                            href="/personal/students/new"
                            className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-muted/50 hover:bg-muted hover:border-[#F88022]/40 border border-border/60 transition-all duration-200 group text-center"
                        >
                            <div className="w-11 h-11 rounded-xl bg-[#F88022]/10 text-[#F88022] flex items-center justify-center group-hover:scale-105 transition-transform">
                                <UserPlus className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-sm font-semibold text-foreground block">Novo Aluno</span>
                                <span className="text-[11px] text-muted-foreground">Cadastrar no CRM</span>
                            </div>
                        </Link>

                        <Link
                            href="/personal/workouts/new"
                            className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-muted/50 hover:bg-muted hover:border-[#F88022]/40 border border-border/60 transition-all duration-200 group text-center"
                        >
                            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <Dumbbell className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-sm font-semibold text-foreground block">Novo Treino</span>
                                <span className="text-[11px] text-muted-foreground">Prescrever ou modelo</span>
                            </div>
                        </Link>

                        <Link
                            href="/personal/diets/new"
                            className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-muted/50 hover:bg-muted hover:border-[#F88022]/40 border border-border/60 transition-all duration-200 group text-center"
                        >
                            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <Utensils className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-sm font-semibold text-foreground block">Nova Dieta</span>
                                <span className="text-[11px] text-muted-foreground">Plano ou cálculo</span>
                            </div>
                        </Link>

                        <Link
                            href="/personal/chat"
                            className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-muted/50 hover:bg-muted hover:border-[#F88022]/40 border border-border/60 transition-all duration-200 group text-center"
                        >
                            <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <MessageCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-sm font-semibold text-foreground block">Mensagens</span>
                                <span className="text-[11px] text-muted-foreground">Chat com alunos</span>
                            </div>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
