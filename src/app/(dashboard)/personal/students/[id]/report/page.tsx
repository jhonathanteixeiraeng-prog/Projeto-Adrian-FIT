'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Calendar, Camera, ClipboardList, Dumbbell, Percent, Printer, RefreshCw, Ruler, Scale, Send, TrendingUp, Utensils } from 'lucide-react';
import { usePageMeta } from '@/components/personal/page-meta';
import { ExportReportDialog } from '@/components/personal/pdf/export-report-dialog';
import type { ReportPdfModel } from '@/components/personal/pdf/report-model';
import { crmHref, formatDate, formatDelta, formatNumber, PHOTO_ANGLE_LABELS, reportKey, requestJson } from '@/components/personal/students/lib';
import { MEASURES } from '@/components/personal/students/progress-section';
import type { Checkin, ProgressPhoto, StudentReport } from '@/components/personal/students/types';
import { primarySmallButtonClass, smallButtonClass, textareaClass } from '@/components/personal/students/ui';
import { useInstantUrlValue } from '@/components/personal/students/use-instant-url-value';
import { setApiData, useApi } from '@/hooks/use-api';
import { useUrlState } from '@/hooks/use-url-state';
import { evolutionRecords, type EvolutionRecord } from '@/lib/evolution';
import { STUDENTS_USE_APP } from '@/lib/features';
import { cn } from '@/lib/utils';
import { formatPhone } from '@/lib/whatsapp';

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
    // Trainer's opinion: saved on the student (it used to stay in this browser's localStorage).
    const legacyOpinionKey = `personal:report-opinion:${id}`;
    const [opinion, setOpinion] = useState('');
    const [opinionStatus, setOpinionStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const opinionLoadedRef = useRef(false);
    const savedOpinionRef = useRef('');
    const saveSeqRef = useRef(0);
    const [pdfModel, setPdfModel] = useState<ReportPdfModel | null>(null);

    const [backHref, setBackHref] = useState('/personal/students');
    useEffect(() => setBackHref(crmHref()), []);
    const name = student?.user.name ?? 'Aluno';
    usePageMeta({
        title: student ? `${student.user.name} · Relatório` : 'Relatório',
        breadcrumbs: [{ label: 'Alunos', href: backHref }, { label: name, href: `/personal/students/${id}` }, { label: 'Relatório' }],
    });

    // First load: the saved opinion, or the text this browser kept before it was saved on the student.
    useEffect(() => {
        if (!student || opinionLoadedRef.current) return;
        opinionLoadedRef.current = true;
        let legacy = '';
        try {
            const raw = window.localStorage.getItem(legacyOpinionKey);
            const parsed: unknown = raw ? JSON.parse(raw) : '';
            legacy = typeof parsed === 'string' ? parsed : '';
        } catch {
            // Blocked storage or invalid JSON: nothing to bring over.
        }
        savedOpinionRef.current = student.reportOpinion ?? '';
        setOpinion(student.reportOpinion || legacy);
    }, [student, legacyOpinionKey]);

    const saveOpinion = useCallback(
        async (text: string) => {
            const seq = ++saveSeqRef.current;
            setOpinionStatus('saving');
            try {
                const result = await requestJson<{ data: { reportOpinion: string | null } }>(`/api/students/${id}/report-opinion`, {
                    method: 'PUT',
                    body: { opinion: text },
                });
                if (seq !== saveSeqRef.current) return; // A newer save is on its way.
                savedOpinionRef.current = result.data.reportOpinion ?? '';
                setApiData<StudentReport>(reportKey(id), (current) => (current ? { ...current, reportOpinion: result.data.reportOpinion } : current));
                try {
                    window.localStorage.removeItem(legacyOpinionKey);
                } catch {
                    // The browser copy is only a leftover now.
                }
                setOpinionStatus('saved');
            } catch {
                if (seq === saveSeqRef.current) setOpinionStatus('error');
            }
        },
        [id, legacyOpinionKey]
    );

    // Saved a moment after typing stops, and right away when the field loses focus.
    useEffect(() => {
        if (!opinionLoadedRef.current || opinion.trim() === savedOpinionRef.current.trim()) return;
        setOpinionStatus('saving');
        const timer = window.setTimeout(() => void saveOpinion(opinion), 800);
        return () => window.clearTimeout(timer);
    }, [opinion, saveOpinion]);

    const report = useMemo(() => {
        if (!student) return null;
        const periodConfig = PERIODS.find((item) => item.id === period)!;
        const now = new Date();
        const start = periodConfig.days ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - periodConfig.days) : null;

        const inRange = (date: string) => !start || new Date(date) >= start;
        const checkins = [...student.checkins].sort(byDateAsc);
        const checkinsInPeriod = checkins.filter((checkin) => inRange(checkin.date));

        // Weight and measures: the trainer's assessments and the app check-ins together, oldest first.
        // The first check-in ever may be older than the ones loaded, so it joins the timeline.
        const timeline = evolutionRecords(student.checkins, student.assessments ?? []).reverse();
        if (student.firstCheckin && !timeline.some((record) => record.id === student.firstCheckin!.id)) {
            timeline.unshift(evolutionRecords([student.firstCheckin], [])[0]);
        }
        const inPeriod = timeline.filter((record) => inRange(record.date));
        const before = timeline.filter((record) => !inRange(record.date));
        // Baseline: the first record of the whole follow-up, or the last one before the period started.
        const baselineOf = (list: EvolutionRecord[], periodList: EvolutionRecord[]) =>
            start ? list[list.length - 1] ?? periodList[0] ?? null : periodList[0] ?? null;
        const baseline = baselineOf(before, inPeriod);
        const series = baseline && !inPeriod.some((record) => record.id === baseline.id) ? [baseline, ...inPeriod] : inPeriod;

        const hasWeight = (record: EvolutionRecord) => record.weight != null;
        const weightBaseline = baselineOf(before.filter(hasWeight), inPeriod.filter(hasWeight));
        const weightLatest = [...inPeriod].reverse().find(hasWeight) ?? null;
        const initialWeight = weightBaseline?.weight ?? null;
        const currentWeight = weightLatest?.weight ?? null;
        const heightMeters = student.height ? student.height / 100 : null;
        const bmi = (weight: number | null) => (weight && heightMeters ? weight / (heightMeters * heightMeters) : null);

        const measurements = MEASURES.map((measure) => {
            const initial = series.find((record) => record[measure.key] != null)?.[measure.key] ?? null;
            const current = [...series].reverse().find((record) => record[measure.key] != null)?.[measure.key] ?? null;
            return { ...measure, initial, current };
        }).filter((row) => row.initial != null || row.current != null);
        const bodyFat = measurements.find((row) => row.key === 'bodyFatPercentage') ?? null;

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

        const assessmentsInPeriod = inPeriod.filter((record) => record.source === 'ASSESSMENT');
        return {
            start,
            inPeriod,
            checkinsInPeriod,
            weightBaseline,
            weightLatest,
            initialWeight,
            currentWeight,
            initialBmi: bmi(initialWeight),
            currentBmi: bmi(currentWeight),
            avgWorkout: average(checkinsInPeriod.map((checkin) => checkin.workoutAdherence)),
            avgDiet: average(checkinsInPeriod.map((checkin) => checkin.dietAdherence)),
            measurements,
            bodyFat,
            photoPairs,
            assessmentCount: assessmentsInPeriod.length,
            assessmentHistory: [...assessmentsInPeriod].reverse().slice(0, HISTORY_ROWS),
            history: [...checkinsInPeriod].reverse().slice(0, HISTORY_ROWS),
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
    const noRecords = report.inPeriod.length === 0;
    const weightChanged = Boolean(report.weightBaseline && report.weightLatest && report.weightBaseline.id !== report.weightLatest.id);

    // The same figures feed the page and the PDF sent to the student.
    const kpis: Array<{ icon: React.ReactNode; label: string; value: string; delta: string | null; detail: string }> = [
        {
            icon: <Scale className="h-3.5 w-3.5 text-blue-600" />,
            label: 'Peso corporal',
            value: formatNumber(report.currentWeight, ' kg'),
            delta: weightChanged ? weightDelta : null,
            detail: report.weightBaseline
                ? `Inicial: ${formatNumber(report.initialWeight, ' kg')} em ${formatDate(report.weightBaseline.date)}`
                : 'Sem registro inicial',
        },
        {
            icon: <TrendingUp className="h-3.5 w-3.5 text-purple-600" />,
            label: 'IMC',
            value: formatNumber(report.currentBmi),
            delta: weightChanged ? bmiDelta : null,
            detail: student.height ? `Inicial: ${formatNumber(report.initialBmi)}` : 'Altura não informada',
        },
        // Adherence is the student's self-report in the app check-in.
        ...(STUDENTS_USE_APP
            ? [
                  {
                      icon: <Dumbbell className="h-3.5 w-3.5 text-brand" />,
                      label: 'Adesão média ao treino',
                      value: report.avgWorkout === null ? '—' : `${report.avgWorkout}%`,
                      delta: null,
                      detail: `${report.checkinsInPeriod.length} ${report.checkinsInPeriod.length === 1 ? 'check-in' : 'check-ins'} no período`,
                  },
                  {
                      icon: <Utensils className="h-3.5 w-3.5 text-emerald-600" />,
                      label: 'Adesão média à dieta',
                      value: report.avgDiet === null ? '—' : `${report.avgDiet}%`,
                      delta: null,
                      detail: 'Cumprimento do plano alimentar',
                  },
              ]
            : [
                  {
                      icon: <Percent className="h-3.5 w-3.5 text-orange-600" />,
                      label: '% de gordura',
                      value: formatNumber(report.bodyFat?.current, '%'),
                      delta:
                          report.bodyFat?.initial != null && report.bodyFat.current != null && report.bodyFat.initial !== report.bodyFat.current
                              ? formatDelta(report.bodyFat.current, report.bodyFat.initial, ' p.p.')
                              : null,
                      detail: report.bodyFat?.initial != null ? `Inicial: ${formatNumber(report.bodyFat.initial, '%')}` : 'Sem medição',
                  },
                  {
                      icon: <ClipboardList className="h-3.5 w-3.5 text-blue-600" />,
                      label: 'Avaliações',
                      value: String(report.assessmentCount),
                      delta: null,
                      detail: report.assessmentCount === 1 ? 'avaliação no período' : 'avaliações no período',
                  },
              ]),
    ];
    const measureRows = report.measurements.map((row) => {
        const percent = row.unit.trim() === '%';
        const unit = percent ? '%' : ' cm';
        return {
            key: row.key,
            label: row.label,
            initial: formatNumber(row.initial, unit),
            current: formatNumber(row.current, unit),
            delta: formatDelta(row.current, row.initial, percent ? ' p.p.' : ' cm') ?? '—',
        };
    });

    /** What the page shows right now, for the PDF sent to the student. */
    const buildPdfModel = (): ReportPdfModel => {
        const now = new Date();
        const tables: ReportPdfModel['tables'] = [];
        if (report.assessmentHistory.length > 0) {
            tables.push({
                title: 'Avaliações do período',
                note: report.assessmentCount > HISTORY_ROWS ? `(últimas ${HISTORY_ROWS} de ${report.assessmentCount})` : null,
                columns: [
                    { label: 'Data', width: 64 },
                    { label: 'Peso', width: 64, align: 'center' },
                    { label: '% de gordura', width: 72, align: 'center' },
                    { label: 'Cintura', width: 64, align: 'center' },
                    { label: 'Observações' },
                ],
                rows: report.assessmentHistory.map((record) => [
                    formatDate(record.date),
                    formatNumber(record.weight, ' kg'),
                    formatNumber(record.bodyFatPercentage, '%'),
                    formatNumber(record.waist, ' cm'),
                    record.notes || '—',
                ]),
            });
        }
        if (report.history.length > 0) {
            tables.push({
                title: 'Check-ins do período',
                note: report.checkinsInPeriod.length > HISTORY_ROWS ? `(últimos ${HISTORY_ROWS} de ${report.checkinsInPeriod.length})` : null,
                columns: [
                    { label: 'Data', width: 64 },
                    { label: 'Peso', width: 56, align: 'center' },
                    { label: 'Sono', width: 48, align: 'center' },
                    { label: 'Treino', width: 52, align: 'center' },
                    { label: 'Dieta', width: 52, align: 'center' },
                    { label: 'Observações do aluno' },
                ],
                rows: report.history.map((checkin) => [
                    formatDate(checkin.date),
                    formatNumber(checkin.weight, ' kg'),
                    formatNumber(checkin.sleepHours, ' h'),
                    `${checkin.workoutAdherence}%`,
                    `${checkin.dietAdherence}%`,
                    checkin.notes || '—',
                ]),
            });
        }
        return {
            header: {
                identity: { brand, coach, coachPhone: formatPhone(student.personal?.user?.phone) },
                documentTitle: 'Relatório de evolução',
                planTitle: `Período: ${periodLabel}`,
                studentName: student.user.name,
                goal: student.goal,
                period: periodLabel,
                issuedAt: formatDate(now),
            },
            info: [
                { label: 'Aluno', value: student.user.name },
                { label: 'Objetivo', value: student.goal },
                { label: 'Altura', value: formatNumber(student.height, ' cm') },
                { label: 'Início do acompanhamento', value: formatDate(student.createdAt) },
            ],
            kpis: kpis.map(({ label, value, delta, detail }) => ({ label, value, delta, detail })),
            measures: measureRows.map(({ label, initial, current, delta }) => ({ label, initial, current, delta })),
            photos: report.photoPairs.map((pair) => ({
                angle: PHOTO_ANGLE_LABELS[pair.angle] ?? pair.angle,
                before: { date: formatDate(pair.before!.createdAt), src: pair.before!.url },
                after: pair.after ? { date: formatDate(pair.after.createdAt), src: pair.after.url } : null,
            })),
            tables,
            opinion: opinion.trim(),
            generatedNote: `${brand} · relatório gerado em ${now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        };
    };

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
                    <button type="button" onClick={() => window.print()} className={smallButtonClass}>
                        <Printer className="h-3.5 w-3.5" />
                        Imprimir
                    </button>
                    <button
                        type="button"
                        onClick={() => setPdfModel(buildPdfModel())}
                        className={primarySmallButtonClass}
                        title="Gerar o PDF do relatório e enviar pelo WhatsApp"
                    >
                        <Send className="h-3.5 w-3.5" />
                        Enviar ao aluno
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
                        {student.personal?.user?.phone && <p className="text-muted-foreground">{formatPhone(student.personal.user.phone)}</p>}
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

                {noRecords && (
                    <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden">
                        {STUDENTS_USE_APP
                            ? 'Nenhuma avaliação ou check-in neste período. Escolha um período maior, registre uma avaliação ou peça um check-in ao aluno.'
                            : 'Nenhuma avaliação neste período. Escolha um período maior ou registre uma avaliação na aba Evolução da ficha do aluno.'}
                    </p>
                )}

                {/* KPIs */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {kpis.map((kpi) => (
                        <Kpi key={kpi.label} {...kpi} />
                    ))}
                </div>

                {/* Measurements */}
                {measureRows.length > 0 && (
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
                                    {measureRows.map((row) => (
                                        <tr key={row.key}>
                                            <td className="p-3 font-medium text-foreground">{row.label}</td>
                                            <td className="p-3 text-center text-muted-foreground">{row.initial}</td>
                                            <td className="p-3 text-center font-semibold text-foreground">{row.current}</td>
                                            <td className="p-3 text-right font-semibold text-foreground">{row.delta}</td>
                                        </tr>
                                    ))}
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

                {/* Assessment history */}
                {report.assessmentHistory.length > 0 && (
                    <section className="report-avoid-break space-y-3">
                        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                            <ClipboardList className="h-4 w-4 text-blue-600" />
                            Avaliações do período
                            {report.assessmentCount > HISTORY_ROWS && (
                                <span className="text-xs font-normal text-muted-foreground">(últimas {HISTORY_ROWS} de {report.assessmentCount})</span>
                            )}
                        </h2>
                        <div className="overflow-hidden rounded-2xl border border-border">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted text-xs font-semibold text-muted-foreground">
                                        <th className="p-3">Data</th>
                                        <th className="p-3 text-center">Peso</th>
                                        <th className="p-3 text-center">% de gordura</th>
                                        <th className="p-3 text-center">Cintura</th>
                                        <th className="p-3">Observações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {report.assessmentHistory.map((record) => (
                                        <tr key={record.id}>
                                            <td className="whitespace-nowrap p-3 font-medium text-foreground">{formatDate(record.date)}</td>
                                            <td className="p-3 text-center font-semibold text-foreground">{formatNumber(record.weight, ' kg')}</td>
                                            <td className="p-3 text-center text-foreground">{formatNumber(record.bodyFatPercentage, '%')}</td>
                                            <td className="p-3 text-center text-foreground">{formatNumber(record.waist, ' cm')}</td>
                                            <td className="p-3 text-muted-foreground">{record.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* Check-in history */}
                {report.history.length > 0 && (
                    <section className="report-avoid-break space-y-3">
                        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            Check-ins do período
                            {report.checkinsInPeriod.length > HISTORY_ROWS && (
                                <span className="text-xs font-normal text-muted-foreground">(últimos {HISTORY_ROWS} de {report.checkinsInPeriod.length})</span>
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
                            onBlur={() => {
                                if (opinion.trim() !== savedOpinionRef.current.trim()) void saveOpinion(opinion);
                            }}
                            rows={5}
                            maxLength={4000}
                            placeholder="Escreva sua análise do período: pontos fortes, o que ajustar e os próximos passos. O texto fica salvo na ficha do aluno e vai na impressão e no PDF enviado."
                            className={cn(textareaClass, 'bg-white text-sm print:hidden')}
                        />
                        <p className={cn('text-xs print:hidden', opinionStatus === 'error' ? 'text-red-600' : 'text-muted-foreground')} aria-live="polite">
                            {opinionStatus === 'saving'
                                ? 'Salvando…'
                                : opinionStatus === 'error'
                                  ? 'Não foi possível salvar o parecer. Confira a conexão: tentamos de novo quando você sair do campo.'
                                  : opinionStatus === 'saved'
                                    ? 'Parecer salvo na ficha do aluno.'
                                    : 'Salvo automaticamente na ficha do aluno.'}
                        </p>
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

            <ExportReportDialog
                model={pdfModel}
                phone={student.user.phone ?? null}
                onOpenChange={(open) => {
                    if (!open) setPdfModel(null);
                }}
            />
        </div>
    );
}
