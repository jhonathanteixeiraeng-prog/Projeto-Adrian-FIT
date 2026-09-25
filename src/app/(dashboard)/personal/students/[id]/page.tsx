'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowLeft,
    Camera,
    ChevronLeft,
    ChevronRight,
    Clock,
    Copy,
    Dumbbell,
    History,
    Library,
    Loader2,
    Pencil,
    RefreshCw,
    Ruler,
    Scale,
    Sparkles,
    TrendingUp,
    User,
    Utensils,
} from 'lucide-react';
import { Avatar, useDialogs, useToast } from '@/components/ui';
import { rememberRecentStudent } from '@/components/personal/command-palette';
import { usePageMeta } from '@/components/personal/page-meta';
import { ContractDialog } from '@/components/personal/students/contract-form';
import {
    GENDER_LABELS,
    STUDENTS_KEY,
    ageFrom,
    calendarDate,
    crmHref,
    errorMessage,
    formatDate,
    formatDelta,
    formatNumber,
    formatShortDate,
    isOtherDialogOpen,
    planEndInfo,
    profileKey,
    readNavNames,
    readNavOrder,
    relativeDaysLabel,
    removeStudentFromCaches,
    requestJson,
    saveNavOrder,
    toneText,
    updateStudent,
} from '@/components/personal/students/lib';
import { AssignDietTemplateDialog, AssignWorkoutTemplateDialog, CloneWorkoutDialog } from '@/components/personal/students/plan-dialogs';
import { DietPlanView, EmptyPlan, WorkoutPlanView } from '@/components/personal/students/plan-views';
import { AnamnesisDialog, PersonalInfoDialog, ResetPasswordDialog } from '@/components/personal/students/profile-dialogs';
import { AnamnesisCard, ContactCard, ContractCard, QuickActionsCard, StatusCard } from '@/components/personal/students/profile-sidebar';
import { CheckinsTable, MeasurementsSummary, PhotoGallery } from '@/components/personal/students/progress-section';
import { ReminderDialog } from '@/components/personal/students/reminder-dialog';
import { StudentSwitcher } from '@/components/personal/students/student-switcher';
import type { StudentListItem, StudentProfile } from '@/components/personal/students/types';
import { BillingBadge, InfoRow, Kbd, SectionCard, StudentStatusBadge, primarySmallButtonClass, smallButtonClass } from '@/components/personal/students/ui';
import { useInstantUrlValue } from '@/components/personal/students/use-instant-url-value';
import { useStickySupported } from '@/components/personal/students/use-sticky-supported';
import { useApi } from '@/hooks/use-api';
import { useHotkey } from '@/hooks/use-hotkey';
import { useUrlState } from '@/hooks/use-url-state';
import { CHECKIN_EXPECTED_DAYS, INACTIVITY_ALERT_DAYS, daysSince, getBillingInfo } from '@/lib/student-status';
import { cn } from '@/lib/utils';

const TABS = [
    { id: 'overview', label: 'Visão geral', icon: User },
    { id: 'workout', label: 'Treino', icon: Dumbbell },
    { id: 'diet', label: 'Dieta', icon: Utensils },
    { id: 'progress', label: 'Evolução', icon: TrendingUp },
] as const;
type ProfileTab = (typeof TABS)[number]['id'];

type DialogName = 'contract' | 'info' | 'anamnesis' | 'password' | 'reminder' | 'assignWorkout' | 'cloneWorkout' | 'assignDiet';

function KpiCard({
    label,
    icon,
    value,
    detail,
    tone = 'muted',
}: {
    label: string;
    icon: React.ReactNode;
    value: React.ReactNode;
    detail: React.ReactNode;
    tone?: 'ok' | 'warn' | 'danger' | 'muted';
}) {
    return (
        <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {icon}
                {label}
            </p>
            <p className={cn('mt-1 text-lg font-bold leading-tight', tone === 'muted' ? 'text-foreground' : toneText[tone])}>{value}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
        </div>
    );
}

function ProfileSkeleton() {
    return (
        <div className="space-y-4" aria-busy="true" aria-label="Carregando ficha do aluno">
            <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
                <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
                <div className="space-y-2">
                    <div className="h-6 w-56 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-72 animate-pulse rounded bg-muted/70" />
                </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted" />
                        ))}
                    </div>
                    <div className="h-80 animate-pulse rounded-2xl bg-muted/70" />
                </div>
                <div className="space-y-3">
                    <div className="h-40 animate-pulse rounded-2xl bg-muted" />
                    <div className="h-56 animate-pulse rounded-2xl bg-muted" />
                </div>
            </div>
        </div>
    );
}

const formatDuration = (seconds: number) => {
    if (!seconds) return '—';
    const minutes = Math.round(seconds / 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
};

export default function StudentProfilePage() {
    const params = useParams();
    const id = String(params?.id ?? '');
    const router = useRouter();
    const { toast } = useToast();
    const { confirm, prompt } = useDialogs();

    const { data: student, error, isLoading, isValidating, mutate } = useApi<StudentProfile>(id ? profileKey(id) : null);

    const [urlTab, setUrlTab] = useUrlState('tab', 'overview');
    const [tabValue, setTab] = useInstantUrlValue(urlTab, setUrlTab);
    const tab: ProfileTab = TABS.some((item) => item.id === tabValue) ? (tabValue as ProfileTab) : 'overview';
    const [dialog, setDialog] = useState<DialogName | null>(null);
    const asideRef = useRef<HTMLElement>(null);
    const stickyAside = useStickySupported(asideRef);
    const [savingTemplate, setSavingTemplate] = useState<'workout' | 'diet' | null>(null);

    const [backHref, setBackHref] = useState('/personal/students');
    useEffect(() => setBackHref(crmHref()), []);

    const name = student?.user.name ?? 'Aluno';
    usePageMeta({
        title: student ? student.user.name : 'Aluno',
        breadcrumbs: [{ label: 'Alunos', href: backHref }, { label: name }],
    });

    useEffect(() => {
        if (student?.id) rememberRecentStudent(student.id);
    }, [student?.id]);

    // ------------------------------------------------------------ prev / next (order of the CRM list)
    const [navOrder, setNavOrder] = useState<string[] | null | undefined>(undefined);
    const [navNames, setNavNames] = useState<Record<string, string>>({});
    useEffect(() => {
        setNavOrder(readNavOrder());
        setNavNames(readNavNames());
    }, [id]);
    const needsFallback = navOrder !== undefined && !(navOrder ?? []).includes(id);
    // Only when the CRM order is unknown (opened from ⌘K, a notification or a bookmark).
    const { data: fallbackList } = useApi<StudentListItem[]>(needsFallback ? STUDENTS_KEY : null);
    const fallbackOrder = useMemo(
        () =>
            Array.isArray(fallbackList)
                ? [...fallbackList]
                      .sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || '', 'pt-BR'))
                      .map((item) => ({ id: item.id, name: item.user?.name || 'Aluno' }))
                : null,
        [fallbackList]
    );
    useEffect(() => {
        if (needsFallback && fallbackOrder && fallbackOrder.length > 0) {
            saveNavOrder(fallbackOrder);
            setNavOrder(fallbackOrder.map((item) => item.id));
            setNavNames(Object.fromEntries(fallbackOrder.map((item) => [item.id, item.name])));
        }
    }, [needsFallback, fallbackOrder]);

    const order = navOrder && navOrder.includes(id) ? navOrder : null;
    const index = order ? order.indexOf(id) : -1;
    const prevId = order && index > 0 ? order[index - 1] : null;
    const nextId = order && index >= 0 && index < order.length - 1 ? order[index + 1] : null;

    const goToStudent = (targetId: string) => {
        router.push(`/personal/students/${targetId}${tab !== 'overview' ? `?tab=${tab}` : ''}`);
    };

    useHotkey(
        'j',
        (event) => {
            if (!nextId || isOtherDialogOpen()) return;
            event.preventDefault();
            goToStudent(nextId);
        },
        { preventDefault: false }
    );
    useHotkey(
        'k',
        (event) => {
            if (!prevId || isOtherDialogOpen()) return;
            event.preventDefault();
            goToStudent(prevId);
        },
        { preventDefault: false }
    );

    // ------------------------------------------------------------ derived data
    const derived = useMemo(() => {
        if (!student) return null;
        const lastSession = student.workoutSessions[0] ?? null;
        const lastCheckin = student.checkins[0] ?? null;
        const weightNow = lastCheckin?.weight ?? student.weight ?? null;
        const firstWeight = student.firstCheckin?.weight ?? null;
        return {
            lastSession,
            lastWorkoutDays: daysSince(lastSession?.completedAt),
            lastCheckin,
            lastCheckinDays: daysSince(lastCheckin?.date),
            weightNow,
            weightDelta: student.firstCheckin && lastCheckin && student.firstCheckin.id !== lastCheckin.id ? formatDelta(weightNow, firstWeight, ' kg') : null,
            activeWorkoutCount: student.workoutPlans.filter((plan) => plan.active).length,
            activeDietCount: student.dietPlans.filter((plan) => plan.active).length,
            billing: getBillingInfo(student),
        };
    }, [student]);

    // ------------------------------------------------------------ actions
    const saveWorkoutAsTemplate = async () => {
        const plan = student?.activeWorkoutPlan;
        if (!plan) return;
        const title = await prompt({
            title: 'Salvar treino como modelo',
            description: 'O modelo fica na biblioteca para atribuir a outros alunos.',
            label: 'Nome do modelo',
            defaultValue: `${plan.title} (modelo)`,
            confirmText: 'Salvar modelo',
        });
        if (title === null) return;
        try {
            setSavingTemplate('workout');
            await requestJson('/api/workout-templates/from-plan', { method: 'POST', body: { planId: plan.id, title } });
            toast.success('Modelo salvo na biblioteca', title);
        } catch (templateError) {
            toast.error('Não foi possível salvar o modelo', errorMessage(templateError));
        } finally {
            setSavingTemplate(null);
        }
    };

    const saveDietAsTemplate = async () => {
        const plan = student?.activeDietPlan;
        if (!plan) return;
        const title = await prompt({
            title: 'Salvar dieta como modelo',
            description: 'O modelo fica na biblioteca para atribuir a outros alunos.',
            label: 'Nome do modelo',
            defaultValue: `${plan.title} (modelo)`,
            confirmText: 'Salvar modelo',
        });
        if (title === null) return;
        try {
            setSavingTemplate('diet');
            await requestJson('/api/diet-templates/from-plan', { method: 'POST', body: { planId: plan.id, title } });
            toast.success('Modelo salvo na biblioteca', title);
        } catch (templateError) {
            toast.error('Não foi possível salvar o modelo', errorMessage(templateError));
        } finally {
            setSavingTemplate(null);
        }
    };

    const deleteStudent = async () => {
        if (!student) return;
        const ok = await confirm({
            title: `Excluir ${student.user.name}?`,
            description:
                'Remove o aluno com treinos, dietas, check-ins e fotos. Esta ação não pode ser desfeita. Para apenas interromper o acompanhamento, altere o status para "Inativo".',
            confirmText: 'Excluir aluno',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            await requestJson(`/api/students/${student.id}`, { method: 'DELETE' });
            removeStudentFromCaches(student.id);
            toast.success('Aluno excluído', student.user.name);
            router.push(backHref);
        } catch (deleteError) {
            toast.error('Não foi possível excluir', errorMessage(deleteError));
        }
    };

    // ------------------------------------------------------------ states
    if (isLoading) return <ProfileSkeleton />;

    if (!student || !derived) {
        return (
            <div className="space-y-4">
                <Link href={backHref} className={smallButtonClass}>
                    <ArrowLeft className="h-4 w-4" />
                    Alunos
                </Link>
                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-10 text-center" role="alert">
                    <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
                    <h1 className="mt-3 text-lg font-bold text-foreground">Não foi possível abrir a ficha</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{error?.message ?? 'Aluno não encontrado.'}</p>
                    <div className="mt-4 flex justify-center gap-2">
                        <button type="button" onClick={() => mutate()} className={smallButtonClass}>
                            <RefreshCw className={cn('h-3.5 w-3.5', isValidating && 'animate-spin')} />
                            Tentar de novo
                        </button>
                        <Link href={backHref} className={primarySmallButtonClass}>
                            Voltar para alunos
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const { lastSession, lastWorkoutDays, lastCheckin, lastCheckinDays, weightNow, weightDelta, billing } = derived;
    const workout = student.activeWorkoutPlan;
    const diet = student.activeDietPlan;
    const workoutEnd = planEndInfo(workout?.endDate);
    const age = ageFrom(student.birthDate);
    const imc = student.height && weightNow ? weightNow / (student.height / 100) ** 2 : null;
    const workoutHistory = student.workoutPlans.filter((plan) => plan.id !== workout?.id);
    const dietHistory = student.dietPlans.filter((plan) => plan.id !== diet?.id);
    const counts = student._count;
    const prevName = prevId ? navNames[prevId] : null;
    const nextName = nextId ? navNames[nextId] : null;

    const workoutActions = (
        <>
            <Link href={`/personal/students/${student.id}/workout`} className={primarySmallButtonClass}>
                <Pencil className="h-3.5 w-3.5" />
                {workout ? 'Editar treino' : 'Criar treino'}
            </Link>
            <button type="button" onClick={() => setDialog('assignWorkout')} className={smallButtonClass}>
                <Library className="h-3.5 w-3.5" />
                Atribuir modelo
            </button>
            <button type="button" onClick={() => setDialog('cloneWorkout')} className={smallButtonClass}>
                <Sparkles className="h-3.5 w-3.5 text-[#F88022]" />
                Clonar de aluno
            </button>
        </>
    );

    const dietActions = (
        <>
            <Link href={`/personal/students/${student.id}/diet`} className={primarySmallButtonClass}>
                <Pencil className="h-3.5 w-3.5" />
                {diet ? 'Editar dieta' : 'Criar dieta'}
            </Link>
            <button type="button" onClick={() => setDialog('assignDiet')} className={smallButtonClass}>
                <Library className="h-3.5 w-3.5" />
                Atribuir modelo
            </button>
        </>
    );

    return (
        <div className="space-y-4 pb-12">
            {/* Navigation bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={backHref} className={cn(smallButtonClass, 'border-transparent bg-transparent')}>
                    <ArrowLeft className="h-4 w-4" />
                    Alunos
                </Link>
                <div className="flex items-center gap-1.5">
                    {order && index >= 0 && (
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                            {index + 1} de {order.length}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => prevId && goToStudent(prevId)}
                        disabled={!prevId}
                        className={cn(smallButtonClass, 'w-8 px-0')}
                        title={prevId ? `Anterior: ${prevName ?? 'aluno'} (K)` : 'Sem aluno anterior'}
                        aria-label="Aluno anterior"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => nextId && goToStudent(nextId)}
                        disabled={!nextId}
                        className={cn(smallButtonClass, 'w-8 px-0')}
                        title={nextId ? `Próximo: ${nextName ?? 'aluno'} (J)` : 'Sem próximo aluno'}
                        aria-label="Próximo aluno"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <StudentSwitcher currentId={student.id} onPick={goToStudent} />
                </div>
            </div>

            {/* Header */}
            <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4">
                <Avatar name={student.user.name} src={student.user.avatar || undefined} size="xl" />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="truncate text-2xl font-bold text-foreground">{student.user.name}</h1>
                        <StudentStatusBadge status={student.status} />
                        <BillingBadge billing={billing} />
                        {isValidating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Atualizando" />}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {student.goal ? <span className="text-foreground">{student.goal}</span> : 'Sem objetivo definido'}
                        {' · '}aluno desde {formatDate(student.createdAt)}
                    </p>
                </div>
                <p className="hidden items-center gap-1 text-xs text-muted-foreground xl:flex">
                    <Kbd>K</Kbd>
                    <Kbd>J</Kbd> anterior / próximo
                </p>
            </header>

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 space-y-4">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <KpiCard
                            label="Último treino"
                            icon={<Dumbbell className="h-3.5 w-3.5 text-[#F88022]" />}
                            value={lastSession ? relativeDaysLabel(lastWorkoutDays) : 'Nunca treinou'}
                            detail={lastSession ? `${lastSession.dayName} · ${lastSession.percentage}% concluído` : 'Nenhum treino registrado no app'}
                            tone={
                                student.status !== 'ACTIVE'
                                    ? 'muted'
                                    : lastWorkoutDays === null || lastWorkoutDays >= INACTIVITY_ALERT_DAYS
                                        ? 'danger'
                                        : 'ok'
                            }
                        />
                        <KpiCard
                            label="Último check-in"
                            icon={<Clock className="h-3.5 w-3.5 text-purple-500" />}
                            value={lastCheckin ? `${formatShortDate(lastCheckin.date)} · ${relativeDaysLabel(lastCheckinDays).toLowerCase()}` : 'Sem check-in ainda'}
                            detail={
                                lastCheckin
                                    ? `Adesão: treino ${lastCheckin.workoutAdherence}% · dieta ${lastCheckin.dietAdherence}%`
                                    : 'Envie um lembrete de check-in'
                            }
                            tone={lastCheckin ? ((lastCheckinDays ?? 0) >= CHECKIN_EXPECTED_DAYS ? 'warn' : 'ok') : 'muted'}
                        />
                        <KpiCard
                            label="Peso atual"
                            icon={<Scale className="h-3.5 w-3.5 text-blue-500" />}
                            value={formatNumber(weightNow, ' kg')}
                            detail={
                                weightDelta && student.firstCheckin
                                    ? `${weightDelta} desde ${formatDate(student.firstCheckin.date)}`
                                    : lastCheckin
                                        ? 'Primeiro registro de peso'
                                        : 'Peso do cadastro'
                            }
                        />
                        <KpiCard
                            label="Treino ativo"
                            icon={<History className="h-3.5 w-3.5 text-emerald-500" />}
                            value={workout ? workoutEnd?.label ?? 'Sem data de término' : 'Sem treino ativo'}
                            detail={workout ? workout.title : 'Prescreva um treino'}
                            tone={workout ? workoutEnd?.tone ?? 'muted' : 'danger'}
                        />
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1" role="tablist" aria-label="Seções da ficha">
                        {TABS.map((item) => {
                            const Icon = item.icon;
                            const badge =
                                item.id === 'progress' && counts ? counts.checkins : item.id === 'workout' && derived.activeWorkoutCount > 1 ? derived.activeWorkoutCount : null;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === item.id}
                                    onClick={() => setTab(item.id)}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40',
                                        tab === item.id ? 'bg-background font-semibold text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <Icon className={cn('h-4 w-4', tab === item.id && 'text-[#F88022]')} />
                                    {item.label}
                                    {badge ? <span className="rounded-full bg-background/70 px-1.5 text-xs font-semibold text-muted-foreground">{badge}</span> : null}
                                </button>
                            );
                        })}
                    </div>

                    {tab === 'overview' && (
                        <div className="grid gap-4 xl:grid-cols-2">
                            <SectionCard
                                title="Informações"
                                icon={<User className="h-4 w-4 text-[#F88022]" />}
                                action={
                                    <button
                                        type="button"
                                        onClick={() => setDialog('info')}
                                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-[#F88022] hover:bg-[#F88022]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40"
                                    >
                                        <Pencil className="h-3 w-3" />
                                        Editar
                                    </button>
                                }
                            >
                                <div className="divide-y divide-border/60">
                                    <InfoRow label="Telefone">{student.user.phone || '—'}</InfoRow>
                                    <InfoRow label="Nascimento">
                                        {student.birthDate ? `${calendarDate(student.birthDate)?.toLocaleDateString('pt-BR')}${age !== null ? ` · ${age} anos` : ''}` : '—'}
                                    </InfoRow>
                                    <InfoRow label="Sexo">{student.gender ? GENDER_LABELS[student.gender] ?? student.gender : '—'}</InfoRow>
                                    <InfoRow label="Altura">{formatNumber(student.height, ' cm')}</InfoRow>
                                    <InfoRow label="Peso">{formatNumber(weightNow, ' kg')}</InfoRow>
                                    <InfoRow label="IMC">{imc ? formatNumber(imc) : '—'}</InfoRow>
                                    <InfoRow label="Objetivo">{student.goal || '—'}</InfoRow>
                                </div>
                            </SectionCard>

                            <SectionCard title="Atividade recente" icon={<History className="h-4 w-4 text-emerald-500" />}>
                                {student.workoutSessions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Nenhum treino registrado no app ainda.</p>
                                ) : (
                                    <ul className="divide-y divide-border/60">
                                        {student.workoutSessions.slice(0, 6).map((session) => (
                                            <li key={session.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                                                <span className="min-w-0">
                                                    <span className="block truncate font-medium text-foreground">{session.dayName}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatDate(session.completedAt)} · {formatDuration(session.durationSeconds)}
                                                    </span>
                                                </span>
                                                <span
                                                    className={cn(
                                                        'shrink-0 text-xs font-semibold',
                                                        session.percentage >= 90 ? toneText.ok : session.percentage >= 50 ? toneText.warn : toneText.danger
                                                    )}
                                                >
                                                    {session.percentage}%
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </SectionCard>

                            <SectionCard
                                title="Treino atual"
                                icon={<Dumbbell className="h-4 w-4 text-[#F88022]" />}
                                action={
                                    <button type="button" onClick={() => setTab('workout')} className="text-xs font-semibold text-[#F88022] hover:underline">
                                        Ver treino completo
                                    </button>
                                }
                            >
                                {workout ? (
                                    <div className="space-y-2">
                                        <p className="font-semibold text-foreground">{workout.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDate(workout.startDate)} – {formatDate(workout.endDate)}
                                            {workoutEnd && <span className={cn('ml-1.5 font-semibold', toneText[workoutEnd.tone])}>{workoutEnd.label}</span>}
                                        </p>
                                        <ul className="space-y-1 text-sm">
                                            {workout.workoutDays.map((day) => (
                                                <li key={day.id} className="flex items-center justify-between gap-2">
                                                    <span className="truncate text-foreground">{day.name}</span>
                                                    <span className="shrink-0 text-xs text-muted-foreground">{day.items.length} exercícios</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Nenhum treino ativo.</p>
                                )}
                                <div className="mt-3 flex flex-wrap gap-2">{workoutActions}</div>
                            </SectionCard>

                            <SectionCard
                                title="Dieta atual"
                                icon={<Utensils className="h-4 w-4 text-emerald-500" />}
                                action={
                                    <button type="button" onClick={() => setTab('diet')} className="text-xs font-semibold text-[#F88022] hover:underline">
                                        Ver dieta completa
                                    </button>
                                }
                            >
                                {diet ? (
                                    <div className="space-y-2">
                                        <p className="font-semibold text-foreground">{diet.title}</p>
                                        <div className="grid grid-cols-4 gap-2 text-center">
                                            {[
                                                { label: 'kcal', value: diet.calories },
                                                { label: 'Prot.', value: diet.protein, suffix: 'g' },
                                                { label: 'Carb.', value: diet.carbs, suffix: 'g' },
                                                { label: 'Gord.', value: diet.fat, suffix: 'g' },
                                            ].map((macro) => (
                                                <div key={macro.label} className="rounded-lg bg-muted/60 py-1.5">
                                                    <p className="text-sm font-bold text-foreground">
                                                        {macro.value ?? '—'}
                                                        {macro.value != null && macro.suffix}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">{macro.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{diet.meals.length} refeições</p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Nenhuma dieta ativa.</p>
                                )}
                                <div className="mt-3 flex flex-wrap gap-2">{dietActions}</div>
                            </SectionCard>
                        </div>
                    )}

                    {tab === 'workout' && (
                        <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
                            {workout ? (
                                <>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {workoutActions}
                                        <button
                                            type="button"
                                            onClick={saveWorkoutAsTemplate}
                                            disabled={savingTemplate !== null}
                                            className={smallButtonClass}
                                        >
                                            {savingTemplate === 'workout' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                                            Salvar como modelo
                                        </button>
                                    </div>
                                    <WorkoutPlanView plan={workout} activeCount={derived.activeWorkoutCount} />
                                </>
                            ) : (
                                <EmptyPlan kind="treino" action={workoutActions} />
                            )}
                            {workoutHistory.length > 0 && (
                                <details className="rounded-xl border border-border">
                                    <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-foreground">
                                        Histórico de treinos ({workoutHistory.length})
                                    </summary>
                                    <ul className="divide-y divide-border/60 border-t border-border">
                                        {workoutHistory.map((plan) => (
                                            <li key={plan.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                                <span className="min-w-0 truncate text-foreground">{plan.title}</span>
                                                <span className="shrink-0 text-xs text-muted-foreground">
                                                    {formatDate(plan.startDate)} – {formatDate(plan.endDate)}
                                                    {plan.active ? ' · ativo' : ''}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </section>
                    )}

                    {tab === 'diet' && (
                        <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
                            {diet ? (
                                <>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {dietActions}
                                        <button type="button" onClick={saveDietAsTemplate} disabled={savingTemplate !== null} className={smallButtonClass}>
                                            {savingTemplate === 'diet' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                                            Salvar como modelo
                                        </button>
                                    </div>
                                    <DietPlanView plan={diet} activeCount={derived.activeDietCount} />
                                </>
                            ) : (
                                <EmptyPlan kind="dieta" action={dietActions} />
                            )}
                            {dietHistory.length > 0 && (
                                <details className="rounded-xl border border-border">
                                    <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-foreground">
                                        Histórico de dietas ({dietHistory.length})
                                    </summary>
                                    <ul className="divide-y divide-border/60 border-t border-border">
                                        {dietHistory.map((plan) => (
                                            <li key={plan.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                                <span className="min-w-0 truncate text-foreground">
                                                    {plan.title}
                                                    {plan.calories ? <span className="text-muted-foreground"> · {plan.calories} kcal</span> : null}
                                                </span>
                                                <span className="shrink-0 text-xs text-muted-foreground">
                                                    {formatDate(plan.startDate ?? plan.createdAt)} – {formatDate(plan.endDate)}
                                                    {plan.active ? ' · ativa' : ''}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </section>
                    )}

                    {tab === 'progress' && (
                        <div className="space-y-4">
                            {student.checkins.some((checkin) => checkin.waist != null || checkin.chest != null || checkin.bodyFatPercentage != null || checkin.hips != null || checkin.armRight != null || checkin.thighRight != null || checkin.abdomen != null) && (
                                <SectionCard title="Medidas corporais" icon={<Ruler className="h-4 w-4 text-emerald-500" />}>
                                    <MeasurementsSummary checkins={student.checkins} firstCheckin={student.firstCheckin} />
                                </SectionCard>
                            )}
                            <SectionCard
                                title="Check-ins"
                                icon={<TrendingUp className="h-4 w-4 text-[#F88022]" />}
                                action={
                                    counts && counts.checkins > student.checkins.length ? (
                                        <Link href={`/personal/students/${student.id}/report`} className="text-xs font-semibold text-[#F88022] hover:underline">
                                            Últimos {student.checkins.length} de {counts.checkins} · ver relatório completo
                                        </Link>
                                    ) : undefined
                                }
                                bodyClassName="p-0 sm:p-4"
                            >
                                {student.checkins.length === 0 ? (
                                    <div className="p-4 text-center sm:p-2">
                                        <p className="font-semibold text-foreground">Sem check-in ainda</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Envie um lembrete para o aluno registrar peso, medidas e fotos.</p>
                                        <button type="button" onClick={() => setDialog('reminder')} className={cn(smallButtonClass, 'mt-3')}>
                                            Enviar lembrete de check-in
                                        </button>
                                    </div>
                                ) : (
                                    <CheckinsTable checkins={student.checkins} />
                                )}
                            </SectionCard>
                            <SectionCard title="Fotos de evolução" icon={<Camera className="h-4 w-4 text-indigo-500" />}>
                                <PhotoGallery photos={student.progressPhotos} total={counts?.progressPhotos ?? student.progressPhotos.length} />
                            </SectionCard>
                        </div>
                    )}
                </div>

                <aside
                    ref={asideRef}
                    className={cn('space-y-3', stickyAside && 'lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pb-2')}
                >
                    <ContactCard student={student} />
                    <ContractCard student={student} onEdit={() => setDialog('contract')} />
                    <AnamnesisCard student={student} onEdit={() => setDialog('anamnesis')} />
                    <StatusCard student={student} />
                    <QuickActionsCard
                        student={student}
                        onRemind={() => setDialog('reminder')}
                        onResetPassword={() => setDialog('password')}
                        onDelete={deleteStudent}
                    />
                </aside>
            </div>

            <ContractDialog
                open={dialog === 'contract'}
                onOpenChange={(open) => setDialog(open ? 'contract' : null)}
                student={student}
                studentName={student.user.name}
                onSubmit={async (patch) => {
                    await updateStudent(student.id, patch);
                    toast.success('Contrato atualizado', student.user.name);
                }}
            />
            <PersonalInfoDialog open={dialog === 'info'} onOpenChange={(open) => setDialog(open ? 'info' : null)} student={student} />
            <AnamnesisDialog open={dialog === 'anamnesis'} onOpenChange={(open) => setDialog(open ? 'anamnesis' : null)} student={student} />
            <ResetPasswordDialog open={dialog === 'password'} onOpenChange={(open) => setDialog(open ? 'password' : null)} student={student} />
            <ReminderDialog
                open={dialog === 'reminder'}
                onOpenChange={(open) => setDialog(open ? 'reminder' : null)}
                students={[{ id: student.id, name: student.user.name }]}
            />
            <AssignWorkoutTemplateDialog
                open={dialog === 'assignWorkout'}
                onOpenChange={(open) => setDialog(open ? 'assignWorkout' : null)}
                studentId={student.id}
                studentName={student.user.name}
            />
            <CloneWorkoutDialog
                open={dialog === 'cloneWorkout'}
                onOpenChange={(open) => setDialog(open ? 'cloneWorkout' : null)}
                studentId={student.id}
                studentName={student.user.name}
                hasActiveWorkout={Boolean(workout)}
            />
            <AssignDietTemplateDialog
                open={dialog === 'assignDiet'}
                onOpenChange={(open) => setDialog(open ? 'assignDiet' : null)}
                studentId={student.id}
                studentName={student.user.name}
                currentCalories={diet?.calories ?? null}
            />
        </div>
    );
}
