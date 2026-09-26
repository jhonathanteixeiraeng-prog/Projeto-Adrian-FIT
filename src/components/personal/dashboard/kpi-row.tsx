'use client';

import React from 'react';
import Link from 'next/link';
import { CreditCard, Dumbbell, Target, Users, Wallet, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/components/personal/chat/contact';
import type { DashboardKpis } from './types';

interface KpiCardProps {
    label: string;
    value: React.ReactNode;
    hint: React.ReactNode;
    icon: LucideIcon;
    tone: string;
    href?: string;
    onClick?: () => void;
    title?: string;
}

function KpiCard({ label, value, hint, icon: Icon, tone, href, onClick, title }: KpiCardProps) {
    const content = (
        <>
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tone)}>
                    <Icon className="h-4 w-4" />
                </span>
            </div>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
        </>
    );
    const className =
        'block rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

    if (href) {
        return (
            <Link href={href} className={className} title={title}>
                {content}
            </Link>
        );
    }
    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={cn(className, 'w-full')} title={title}>
                {content}
            </button>
        );
    }
    return (
        <div className={cn(className, 'hover:border-border')} title={title}>
            {content}
        </div>
    );
}

function Skeleton() {
    return <div className="h-[106px] animate-pulse rounded-2xl border border-border bg-muted" />;
}

interface KpiRowProps {
    kpis: DashboardKpis | undefined;
    onShowBilling: () => void;
}

export function KpiRow({ kpis, onShowBilling }: KpiRowProps) {
    if (!kpis) {
        return (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} />
                ))}
            </div>
        );
    }

    const hasRealAdherence = kpis.workoutAdherence7d !== null;
    const adherenceValue = hasRealAdherence ? kpis.workoutAdherence7d : kpis.reportedWorkoutAdherence;

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <KpiCard
                label="Alunos ativos"
                value={kpis.activeStudents}
                hint={`de ${kpis.totalStudents} cadastrados`}
                icon={Users}
                tone="bg-muted text-muted-foreground"
                href="/personal/students"
            />
            <KpiCard
                label="Treinos · 7 dias"
                value={kpis.workoutsLast7Days}
                hint="concluídos pelos alunos"
                icon={Dumbbell}
                tone="bg-muted text-muted-foreground"
            />
            <KpiCard
                label={hasRealAdherence ? 'Adesão · 7 dias' : 'Adesão (último check-in)'}
                value={adherenceValue === null ? '—' : `${adherenceValue}%`}
                hint={
                    hasRealAdherence
                        ? `treinos feitos vs. previstos · ${kpis.workoutAdherenceStudents} ${kpis.workoutAdherenceStudents === 1 ? 'aluno' : 'alunos'}`
                        : 'média relatada pelos alunos'
                }
                title={
                    hasRealAdherence
                        ? 'Dias com treino concluído nos últimos 7 dias, comparados aos dias previstos nas fichas ativas.'
                        : 'Média da adesão informada no último check-in de cada aluno ativo.'
                }
                icon={Target}
                tone="bg-muted text-muted-foreground"
            />
            <KpiCard
                label="Receita mensal"
                value={formatCurrency(kpis.mrr)}
                hint="MRR dos alunos ativos"
                title="Soma do valor mensal equivalente dos planos dos alunos ativos (planos trimestrais, semestrais e anuais divididos por mês)."
                icon={Wallet}
                tone="bg-muted text-muted-foreground"
            />
            <KpiCard
                label="Cobranças"
                value={kpis.pendingCharges}
                hint={
                    kpis.expiringSoon > 0
                        ? `pendentes · ${kpis.expiringSoon} ${kpis.expiringSoon === 1 ? 'vence' : 'vencem'} em 7 dias`
                        : 'pendentes ou vencidas'
                }
                icon={CreditCard}
                tone={kpis.pendingCharges > 0 ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}
                onClick={onShowBilling}
                title="Ver cobranças na fila de atenção"
            />
        </div>
    );
}
