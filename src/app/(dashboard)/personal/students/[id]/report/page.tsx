'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Calendar, Camera, Dumbbell, Printer, RefreshCw, Ruler, Scale, TrendingUp, Utensils } from 'lucide-react';
import { usePageMeta } from '@/components/personal/page-meta';
import { crmHref, formatDate, formatDelta, formatNumber, PHOTO_ANGLE_LABELS, reportKey } from '@/components/personal/students/lib';
import { MEASURES } from '@/components/personal/students/progress-section';
import type { Checkin, ProgressPhoto, StudentReport } from '@/components/personal/students/types';
import { primarySmallButtonClass, smallButtonClass, textareaClass } from '@/components/personal/students/ui';
import { useInstantUrlValue } from '@/components/personal/students/use-instant-url-value';
import { useApi } from '@/hooks/use-api';
import { useLocalStorageState } from '@/hooks/use-local-storage';
import { useUrlState } from '@/hooks/use-url-state';
import { cn } from '@/lib/utils';

const PERIODS = [
    { id: '30', label: 'Últimos 30 dias', days: 30 },
    { id: '90', label: 'Últimos 90 dias', days: 90 },
    { id: '180', label: 'Últimos 6 meses', days: 180 },
    { id: 'all', label: 'Todo o acompanhamento', days: null },
] as const;
type PeriodId = (typeof PERIODS)[number]['id'];

const FALLBACK_BRAND = 'Adrian Fit';
const HISTORY_ROWS = 10;

/**
 * The report sheet is always light (it is a paper document); print hides the app chrome
 * (sidebar, headers, mobile bottom nav) and keeps the colored badges.
 */
const REPORT_STYLES = `
.report-sheet {
  --background: #ffffff; --foreground: #09090b; --card: #ffffff; --card-foreground: #09090b;
  --muted: #f4f4f5; --muted-foreground: #52525b; --border: #e4e4e7;
  color-scheme: light; background: #ffffff; color: #09090b;
}
@media print {
  @page { margin: 12mm; }
  html, body { background: #ffffff !important; }
  header, nav, aside { display: none !important; }
  [class*="lg:ml-"] { margin-left: 0 !important; }
  main { padding: 0 !important; margin: 0 !important; }
  main > div { padding: 0 !important; max-width: none !important; }
  .report-sheet { border: 0 !important; border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; }
  .report-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .report-avoid-break { break-inside: avoid; page-break-inside: avoid; }
}
`;

const byDateAsc = (a: Checkin, b: Checkin) => new Date(a.date).getTime() - new Date(b.date).getTime();

function average(values: number[]): number | null {
    if (values.length === 0) return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function Kpi({ icon, label, value, delta, detail }: { icon: React.ReactNode; label: string; value: string; delta?: string | null; detail: string }) {
    return (
        <div className="report-avoid-break space-y-1 rounded-2xl border border-border p-4">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {icon}
                {label}
            </span>
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl font-bold text-foreground">{value}</span>
                {delta && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">{delta}</span>}
            </div>
            <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
    );
}

export default function StudentEvolutionReportPage() {
    const params = useParams();
    const id = String(params?.id ?? '');
    const { data: student, error, isLoading, isValidating, mutate } = useApi<StudentReport>(id ? reportKey(id) : null);

    const [urlPeriod, setUrlPeriod] = useUrlState('period', 'all');
    const [periodValue, setPeriod] = useInstantUrlValue(urlPeriod, setUrlPeriod);
    const period = (PERIODS.some((item) => item.id === periodValue) ? periodValue : 'all') as PeriodId;
    const [opinion, setOpinion] = useLocalStorageState<string>(`personal:report-opinion:${id}`, '');

    const [backHref, setBackHref] = useState('/personal/students');
    useEffect(() => setBackHref(crmHref()), []);
    const name = student?.user.name ?? 'Aluno';
    usePageMeta({
        title: student ? `${student.user.name} · Relatório` : 'Relatório',
        breadcrumbs: [{ label: 'Alunos', href: backHref }, { label: name, href: `/personal/students/${id}` }, { label: 'Relatório' }],
    });

    const report = useMemo(() => {
        if (!student) return null;
        const periodConfig = PERIODS.find((item) => item.id === period)!;
        const now = new Date();
        const start = periodConfig.days ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - periodConfig.days) : null;

        const checkins = [...student.checkins].sort(byDateAsc);
        const inPeriod = start ? checkins.filter((checkin) => new Date(checkin.date) >= start) : checkins;
        const before = start ? checkins.filter((checkin) => new Date(checkin.date) < start) : [];
        // Baseline: the real first check-in for the whole follow-up, or the last one before the period started.
        const baseline = start ? before[before.length - 1] ?? inPeriod[0] ?? null : student.firstCheckin ?? checkins[0] ?? null;
        const latest = inPeriod[inPeriod.length - 1] ?? null;
        const series = baseline && !inPeriod.some((checkin) => checkin.id === baseline.id) ? [baseline, ...inPeriod] : inPeriod;

        const initialWeight = baseline?.weight ?? null;
        const currentWeight = latest?.weight ?? null;
        const heightMeters = student.height ? student.height / 100 : null;
        const bmi = (weight: number | null) => (weight && heightMeters ? weight / (heightMeters * heightMeters) : null);

        const measurements = MEASURES.map((measure) => {
            const initial = series.find((checkin) => checkin[measure.key] != null)?.[measure.key] ?? null;
            const current = [...series].reverse().find((checkin) => checkin[measure.key] != null)?.[measure.key] ?? null;
            return { ...measure, initial, current };
        }).filter((row) => row.initial != null || row.current != null);

        const photos = (student.progressPhotos ?? [])
            .filter((photo) => !start || new Date(photo.createdAt) >= start)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const angles = ['FRONT', 'SIDE', 'BACK'];
        const photoPairs = angles
            .map((angle) => {
                const list = photos.filter((photo) => photo.angle === angle);
                return {
                    angle,
                    before: list[0] ?? null,
                    after: list.length > 1 ? list[list.length - 1] : null,
                };
            })
            .filter((pair) => pair.before);

        return {
            start,
            inPeriod,
            baseline,
            latest,
            initialWeight,
            currentWeight,
            initialBmi: bmi(initialWeight),
            currentBmi: bmi(currentWeight),
            avgWorkout: average(inPeriod.map((checkin) => checkin.workoutAdherence)),
            avgDiet: average(inPeriod.map((checkin) => checkin.dietAdherence)),
            measurements,
            photoPairs,
            history: [...inPeriod].reverse().slice(0, HISTORY_ROWS),
        };
    }, [student, period]);

    if (isLoading) {
        return (
            <div className="mx-auto max-w-5xl space-y-4" aria-busy="true" aria-label="Carregando relatório">
                <div className="h-14 animate-pulse rounded-2xl bg-muted" />
                <div className="h-[600px] animate-pulse rounded-3xl bg-muted/70" />
            </div>
        );
    }

    if (!student || !report) {
        return (
            <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center" role="alert">
                <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
                <p className="font-semibold text-foreground">Não foi possível gerar o relatório</p>
                <p className="text-sm text-muted-foreground">{error?.message ?? 'Aluno não encontrado.'}</p>
                <div className="flex justify-center gap-2">
                    <button type="button" onClick={() => mutate()} className={smallButtonClass}>
                        <RefreshCw className={cn('h-3.5 w-3.5', isValidating && 'animate-spin')} />
                        Tentar de novo
                    </button>
                    <Link href={`/personal/students/${id}`} className={primarySmallButtonClass}>
                        Voltar para a ficha
                    </Link>
                </div>
            </div>
        );
    }

    const brand = student.personal?.brandName?.trim() || FALLBACK_BRAND;
    const coach = student.personal?.user?.name || 'Personal trainer';
    const periodLabel = report.start
        ? `${formatDate(report.start)} a ${formatDate(new Date())}`
        : `Todo o acompanhamento, desde ${formatDate(student.createdAt)}`;
    const weightDelta = formatDelta(report.currentWeight, report.initialWeight, ' kg');
    const bmiDelta = formatDelta(report.currentBmi, report.initialBmi);
    const noCheckins = report.inPeriod.length === 0;

    return (
        <div className="mx-auto max-w-5xl space-y-4 pb-16">
            <style>{REPORT_STYLES}</style>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 print:hidden">
                <Link href={`/personal/students/${student.id}?tab=progress`} className={cn(smallButtonClass, 'border-transparent bg-transparent')}>
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para a ficha
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="report-period" className="text-xs font-semibold text-muted-foreground">
                        Período
                    </label>
                    <select
                        id="report-period"
                        value={period}
                        onChange={(event) => setPeriod(event.target.value)}
                        className="h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                    >
                        {PERIODS.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                    <button type="button" onClick={() => window.print()} className={primarySmallButtonClass}>
                        <Printer className="h-3.5 w-3.5" />
                        Imprimir / salvar PDF
                    </button>
                </div>
            </div>

            <article className="report-sheet space-y-7 rounded-3xl border border-border p-6 shadow-sm sm:p-10">
                {/* Document header */}
                <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-lg font-black text-white">
                                {brand.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xl font-black uppercase tracking-tight text-brand">{brand}</span>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Relatório de evolução</h1>
                        <p className="text-xs text-muted-foreground">Período: {periodLabel}</p>
                    </div>
                    <div className="space-y-0.5 text-xs sm:border-l sm:border-border sm:pl-6 sm:text-right">
                        <p className="font-semibold text-foreground">Treinador: {coach}</p>
                        {student.personal?.user?.phone && <p className="text-muted-foreground">{student.personal.user.phone}</p>}
                        <p className="text-muted-foreground">Emitido em {formatDate(new Date())}</p>
                    </div>
                </div>

                {/* Student */}
                <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-muted p-5 sm:grid-cols-4">
                    <div>
                        <span className="block text-xs font-medium text-muted-foreground">Aluno</span>
                        <strong className="text-sm font-semibold text-foreground">{student.user.name}</strong>
                    </div>
                    <div>
                        <span className="block text-xs font-medium text-muted-foreground">Objetivo</span>
                        <strong className="text-sm font-semibold text-foreground">{student.goal || '—'}</strong>
                    </div>
                    <div>
                        <span className="block text-xs font-medium text-muted-foreground">Altura</span>
                        <strong className="text-sm font-semibold text-foreground">{formatNumber(student.height, ' cm')}</strong>
                    </div>
                    <div>
                        <span className="block text-xs font-medium text-muted-foreground">Início do acompanhamento</span>
                        <strong className="text-sm font-semibold text-foreground">{formatDate(student.createdAt)}</strong>
                    </div>
                </div>

                {noCheckins && (
                    <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Nenhum check-in neste período. Escolha um período maior ou peça um check-in ao aluno.
                    </p>
                )}

                {/* KPIs */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Kpi
                        icon={<Scale className="h-3.5 w-3.5 text-blue-600" />}
                        label="Peso corporal"
                        value={formatNumber(report.currentWeight, ' kg')}
                        delta={report.baseline && report.latest && report.baseline.id !== report.latest.id ? weightDelta : null}
                        detail={report.baseline ? `Inicial: ${formatNumber(report.initialWeight, ' kg')} em ${formatDate(report.baseline.date)}` : 'Sem registro inicial'}
                    />
                    <Kpi
                        icon={<TrendingUp className="h-3.5 w-3.5 text-purple-600" />}
                        label="IMC"
                        value={formatNumber(report.currentBmi)}
                        delta={report.baseline && report.latest && report.baseline.id !== report.latest.id ? bmiDelta : null}
                        detail={student.height ? `Inicial: ${formatNumber(report.initialBmi)}` : 'Altura não informada'}
                    />
                    <Kpi
                        icon={<Dumbbell className="h-3.5 w-3.5 text-brand" />}
                        label="Adesão média ao treino"
                        value={report.avgWorkout === null ? '—' : `${report.avgWorkout}%`}
                        detail={`${report.inPeriod.length} ${report.inPeriod.length === 1 ? 'check-in' : 'check-ins'} no período`}
                    />
                    <Kpi
                        icon={<Utensils className="h-3.5 w-3.5 text-emerald-600" />}
                        label="Adesão média à dieta"
                        value={report.avgDiet === null ? '—' : `${report.avgDiet}%`}
                        detail="Cumprimento do plano alimentar"
                    />
                </div>

                {/* Measurements */}
                {report.measurements.length > 0 && (
                    <section className="report-avoid-break space-y-3">
                        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                            <Ruler className="h-4 w-4 text-emerald-600" />
                            Evolução das medidas corporais
                        </h2>
                        <div className="overflow-hidden rounded-2xl border border-border">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted text-xs font-semibold text-muted-foreground">
                                        <th className="p-3">Medida</th>
                                        <th className="p-3 text-center">Inicial</th>
                                        <th className="p-3 text-center">Atual</th>
                                        <th className="p-3 text-right">Variação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {report.measurements.map((row) => {
                                        const unit = row.unit.trim() === '%' ? '%' : ' cm';
                                        const delta = formatDelta(row.current, row.initial, row.unit.trim() === '%' ? ' p.p.' : ' cm');
                                        return (
                                            <tr key={row.key}>
                                                <td className="p-3 font-medium text-foreground">{row.label}</td>
                                                <td className="p-3 text-center text-muted-foreground">{formatNumber(row.initial, unit)}</td>
                                                <td className="p-3 text-center font-semibold text-foreground">{formatNumber(row.current, unit)}</td>
                                                <td className="p-3 text-right font-semibold text-foreground">{delta ?? '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* Photos */}
                {report.photoPairs.length > 0 && (
                    <section className="report-avoid-break space-y-3">
                        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                            <Camera className="h-4 w-4 text-indigo-600" />
                            Comparativo fotográfico
                        </h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {report.photoPairs.map((pair) => (
                                <div key={pair.angle} className="space-y-2 rounded-2xl border border-border bg-muted p-3">
                                    <span className="block text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        {PHOTO_ANGLE_LABELS[pair.angle] ?? pair.angle}
                                    </span>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[pair.before, pair.after].map((photo: ProgressPhoto | null, index) => (
                                            <div key={index} className="space-y-1">
                                                <span className={cn('block text-center text-xs font-semibold', index === 1 ? 'text-brand' : 'text-muted-foreground')}>
                                                    {photo ? formatDate(photo.createdAt) : 'Sem foto posterior'}
                                                </span>
                                                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
                                                    {photo ? (
                                                        <img src={photo.url} alt={`${PHOTO_ANGLE_LABELS[pair.angle] ?? pair.angle} em ${formatDate(photo.createdAt)}`} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Check-in history */}
                {report.history.length > 0 && (
                    <section className="report-avoid-break space-y-3">
                        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            Check-ins do período
                            {report.inPeriod.length > HISTORY_ROWS && (
                                <span className="text-xs font-normal text-muted-foreground">(últimos {HISTORY_ROWS} de {report.inPeriod.length})</span>
                            )}
                        </h2>
                        <div className="overflow-hidden rounded-2xl border border-border">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted text-xs font-semibold text-muted-foreground">
                                        <th className="p-3">Data</th>
                                        <th className="p-3 text-center">Peso</th>
                                        <th className="p-3 text-center">Sono</th>
                                        <th className="p-3 text-center">Treino</th>
                                        <th className="p-3 text-center">Dieta</th>
                                        <th className="p-3">Observações do aluno</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {report.history.map((checkin) => (
                                        <tr key={checkin.id}>
                                            <td className="whitespace-nowrap p-3 font-medium text-foreground">{formatDate(checkin.date)}</td>
                                            <td className="p-3 text-center font-semibold text-foreground">{formatNumber(checkin.weight, ' kg')}</td>
                                            <td className="p-3 text-center text-muted-foreground">{formatNumber(checkin.sleepHours, ' h')}</td>
                                            <td className="p-3 text-center font-semibold text-brand">{checkin.workoutAdherence}%</td>
                                            <td className="p-3 text-center font-semibold text-emerald-600">{checkin.dietAdherence}%</td>
                                            <td className="p-3 text-muted-foreground">{checkin.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* Trainer opinion and signature */}
                <section className="report-avoid-break space-y-8 border-t border-border pt-6">
                    <div className="space-y-2">
                        <label htmlFor="report-opinion" className="block text-sm font-bold text-foreground">
                            Parecer do treinador
                        </label>
                        <textarea
                            id="report-opinion"
                            value={opinion}
                            onChange={(event) => setOpinion(event.target.value)}
                            rows={5}
                            placeholder="Escreva sua análise do período: pontos fortes, o que ajustar e os próximos passos. O texto fica salvo neste navegador para este aluno e aparece na impressão."
                            className={cn(textareaClass, 'bg-white text-sm print:hidden')}
                        />
                        <p className="text-xs text-muted-foreground print:hidden">Salvo automaticamente neste navegador.</p>
                        <div className="hidden min-h-[96px] whitespace-pre-wrap rounded-xl border border-border p-4 text-sm text-foreground print:block">
                            {opinion.trim()}
                        </div>
                    </div>

                    <div className="flex items-end justify-between gap-6 pt-4">
                        <div className="text-xs text-muted-foreground">
                            <p>{brand}</p>
                            <p>Relatório gerado em {new Date().toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="space-y-1 text-center">
                            <div className="mb-1 w-56 border-b border-zinc-400" />
                            <p className="text-xs font-bold text-foreground">{coach}</p>
                            <p className="text-xs text-muted-foreground">Responsável técnico</p>
                        </div>
                    </div>
                </section>
            </article>
        </div>
    );
}
