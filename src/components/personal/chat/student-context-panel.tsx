'use client';

import React from 'react';
import Link from 'next/link';
import {
    CalendarCheck2,
    CreditCard,
    Dumbbell,
    FileText,
    Loader2,
    PanelRightClose,
    Phone,
    Target,
    TrendingUp,
    User,
    Utensils,
    type LucideIcon,
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { PLAN_TYPE_LABELS, getBillingInfo, monthlyValue, type BillingStatus } from '@/lib/student-status';
import { personalLinks } from '@/lib/notifications';
import { formatCurrency, studentPaths, whatsappHref } from './contact';
import { calendarDaysAgo, formatRelativeShort, formatShortDate } from './time-format';

/** The fields of GET /api/students used here (shared, cached list). */
interface StudentListEntry {
    id: string;
    status: string;
    goal?: string | null;
    planType?: string | null;
    planValue?: number | null;
    planExpiresAt?: string | null;
    paymentStatus?: string | null;
    user?: { name?: string; email?: string; phone?: string | null; avatar?: string | null };
    workoutPlans?: Array<{ id: string; title: string; endDate?: string | null }>;
    dietPlans?: Array<{ id: string; title: string; endDate?: string | null; calories?: number | null }>;
    checkins?: Array<{ date: string; weight?: number | null; workoutAdherence?: number | null; dietAdherence?: number | null }>;
    workoutSessions?: Array<{ completedAt: string; dayName?: string | null }>;
}

const BILLING_TONE: Record<BillingStatus, string> = {
    OVERDUE: 'bg-red-500/10 text-red-600 dark:text-red-400',
    EXPIRING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    OK: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    NO_PLAN: 'bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Ativo', PAUSED: 'Pausado', INACTIVE: 'Inativo' };

function planEndText(endDate: string | null | undefined): { text: string; tone: string } | null {
    if (!endDate) return null;
    const daysLeft = -calendarDaysAgo(endDate);
    if (daysLeft < 0) return { text: `venceu em ${formatShortDate(endDate)}`, tone: 'text-red-500' };
    if (daysLeft === 0) return { text: 'termina hoje', tone: 'text-amber-600 dark:text-amber-400' };
    if (daysLeft <= 7) return { text: `termina em ${daysLeft} dia${daysLeft === 1 ? '' : 's'}`, tone: 'text-amber-600 dark:text-amber-400' };
    return { text: `até ${formatShortDate(endDate)}`, tone: 'text-muted-foreground' };
}

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
    return (
        <section className="space-y-1.5 border-t border-border px-4 py-3.5">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-[#F88022]" />
                {title}
            </h3>
            {children}
        </section>
    );
}

function ShortcutLink({ href, icon: Icon, label, external }: { href: string; icon: LucideIcon; label: string; external?: boolean }) {
    const className =
        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-[#F88022] lg:min-h-0';
    if (external) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
            </a>
        );
    }
    return (
        <Link href={href} className={className}>
            <Icon className="h-4 w-4 text-muted-foreground" />
            {label}
        </Link>
    );
}

interface StudentContextPanelProps {
    studentId: string;
    name: string;
    avatar: string | null;
    phone: string | null;
    onClose: () => void;
}

/** Right-hand panel of the conversation: who the student is, contract and training status, shortcuts. */
export function StudentContextPanel({ studentId, name, avatar, phone, onClose }: StudentContextPanelProps) {
    // Same cached list the ⌘K palette and the CRM use: usually already in memory.
    const { data, isLoading, error } = useApi<StudentListEntry[]>('/api/students');
    const student = Array.isArray(data) ? data.find((entry) => entry.id === studentId) : undefined;

    const billing = student ? getBillingInfo(student) : null;
    const monthly = student ? monthlyValue(student.planType, student.planValue) : null;
    const lastSession = student?.workoutSessions?.[0];
    const lastCheckin = student?.checkins?.[0];
    const workoutPlan = student?.workoutPlans?.[0];
    const dietPlan = student?.dietPlans?.[0];
    const workoutEnd = planEndText(workoutPlan?.endDate);
    const dietEnd = planEndText(dietPlan?.endDate);
    const whatsapp = whatsappHref(phone ?? student?.user?.phone);

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sobre o aluno</span>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:min-h-0 lg:min-w-0"
                    aria-label="Ocultar painel do aluno"
                    title="Ocultar painel"
                >
                    <PanelRightClose className="h-4 w-4" />
                </button>
            </div>

            <div className="flex items-center gap-3 px-4 pb-3.5">
                <Avatar src={avatar ?? undefined} name={name} size="lg" />
                <div className="min-w-0">
                    <Link href={personalLinks.student(studentId)} className="block truncate font-semibold text-foreground hover:text-[#F88022] lg:min-h-0 lg:min-w-0">
                        {name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                        {student ? STATUS_LABELS[student.status] ?? student.status : '—'}
                        {student?.goal ? ` · ${student.goal}` : ''}
                    </p>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {isLoading && !student ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-[#F88022]" />
                    </div>
                ) : !student ? (
                    <p className="border-t border-border px-4 py-4 text-sm text-muted-foreground">
                        {error ? 'Não foi possível carregar os dados do aluno.' : 'Dados do aluno indisponíveis.'}
                    </p>
                ) : (
                    <>
                        <Section title="Contrato" icon={CreditCard}>
                            {billing && (
                                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', BILLING_TONE[billing.status])}>
                                    {billing.label}
                                </span>
                            )}
                            <p className="text-sm text-foreground">
                                {PLAN_TYPE_LABELS[(student.planType || '').toUpperCase()] ?? student.planType ?? 'Sem plano'}
                                {typeof student.planValue === 'number' && ` · ${formatCurrency(student.planValue, 2)}`}
                            </p>
                            {monthly !== null && (student.planType || 'MENSAL').toUpperCase() !== 'MENSAL' && (
                                <p className="text-xs text-muted-foreground">Equivale a {formatCurrency(monthly, 2)}/mês</p>
                            )}
                            {student.planExpiresAt && (
                                <p className="text-xs text-muted-foreground">Vencimento: {formatShortDate(student.planExpiresAt)}</p>
                            )}
                        </Section>

                        <Section title="Atividade" icon={Target}>
                            <p className="text-sm text-foreground">
                                <span className="text-muted-foreground">Último treino: </span>
                                {lastSession
                                    ? `${formatRelativeShort(lastSession.completedAt)}${lastSession.dayName ? ` · ${lastSession.dayName}` : ''}`
                                    : 'nenhum registrado'}
                            </p>
                            <p className="text-sm text-foreground">
                                <span className="text-muted-foreground">Último check-in: </span>
                                {lastCheckin
                                    ? `${formatShortDate(lastCheckin.date)}${typeof lastCheckin.weight === 'number' ? ` · ${lastCheckin.weight} kg` : ''}`
                                    : 'nenhum enviado'}
                            </p>
                            {lastCheckin && typeof lastCheckin.workoutAdherence === 'number' && (
                                <p className="text-xs text-muted-foreground">
                                    Adesão relatada: treino {lastCheckin.workoutAdherence}%
                                    {typeof lastCheckin.dietAdherence === 'number' ? ` · dieta ${lastCheckin.dietAdherence}%` : ''}
                                </p>
                            )}
                        </Section>

                        <Section title="Plano atual" icon={CalendarCheck2}>
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="truncate text-sm text-foreground">
                                        <Dumbbell className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                                        {workoutPlan ? workoutPlan.title : 'Sem treino ativo'}
                                    </p>
                                    {workoutEnd && <p className={cn('text-xs', workoutEnd.tone)}>{workoutEnd.text}</p>}
                                </div>
                                <Link href={studentPaths.workoutEditor(studentId)} className="shrink-0 text-xs font-semibold text-[#F88022] hover:underline lg:min-h-0 lg:min-w-0">
                                    {workoutPlan ? 'Editar' : 'Prescrever'}
                                </Link>
                            </div>
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="truncate text-sm text-foreground">
                                        <Utensils className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                                        {dietPlan ? dietPlan.title : 'Sem dieta ativa'}
                                    </p>
                                    {dietEnd && <p className={cn('text-xs', dietEnd.tone)}>{dietEnd.text}</p>}
                                </div>
                                <Link href={studentPaths.dietEditor(studentId)} className="shrink-0 text-xs font-semibold text-[#F88022] hover:underline lg:min-h-0 lg:min-w-0">
                                    {dietPlan ? 'Editar' : 'Prescrever'}
                                </Link>
                            </div>
                        </Section>
                    </>
                )}

                <Section title="Atalhos" icon={User}>
                    <div className="-mx-2">
                        <ShortcutLink href={personalLinks.student(studentId)} icon={User} label="Ficha completa" />
                        <ShortcutLink href={personalLinks.student(studentId, 'progress')} icon={TrendingUp} label="Evolução e check-ins" />
                        <ShortcutLink href={studentPaths.report(studentId)} icon={FileText} label="Relatório" />
                        {whatsapp && <ShortcutLink href={whatsapp} icon={Phone} label="WhatsApp" external />}
                    </div>
                </Section>
            </div>
        </div>
    );
}
