'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, useToast } from '@/components/ui';
import { firstName } from '@/components/personal/students/lib';
import { invalidateApi } from '@/hooks/use-api';
import { useLocalStorageState } from '@/hooks/use-local-storage';
import { formatSentDate, sendFieldsOf, sendState, type SendFields, type SentInfo } from '@/lib/plan-send';
import { formatPhone, whatsappLink } from '@/lib/whatsapp';
import {
    buildDietPdfModel,
    buildWorkoutPdfModel,
    pdfFileName,
    whatsappMessage,
    type DietPlanForPdf,
    type PdfIdentity,
    type PdfKind,
    type WorkoutPlanForPdf,
} from './models';
import { PdfHandoffActions, PdfPreview, type PdfPreviewState, type ReadyPdf } from './pdf-handoff';

export interface PdfExportTarget {
    kind: PdfKind;
    planId: string;
}

const FALLBACK_BRAND = 'Adrian Fit';

interface LoadedData {
    key: string;
    plan: WorkoutPlanForPdf | DietPlanForPdf;
    identity: PdfIdentity;
    phone: string | null;
    /** Plan version the PDF shows. */
    version: number | null;
    /** When a PDF of the plan was last sent, and of which version. */
    send: SendFields;
}

interface ReadyExport {
    status: 'ready';
    url: string;
    file: File;
    studentName: string;
    message: string;
    whatsapp: string | null;
    /** Version rendered in this PDF (what gets recorded as sent). */
    version: number | null;
    send: SendFields;
}

type ExportState = { status: 'loading' } | { status: 'error'; message: string } | ReadyExport;

async function getJson(url: string) {
    const response = await fetch(url, { cache: 'no-store' });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || 'Não foi possível carregar os dados.');
    return body;
}

async function loadData(target: PdfExportTarget, key: string): Promise<LoadedData> {
    const planUrl = target.kind === 'workout' ? `/api/workout-plans/${target.planId}` : `/api/diets/${target.planId}`;
    const [planBody, profileBody] = await Promise.all([getJson(planUrl), getJson('/api/profile')]);
    // Workout plans come raw; diets come as { success, data }.
    const plan = (target.kind === 'workout' ? planBody : planBody?.data) as (WorkoutPlanForPdf | DietPlanForPdf) & SendFields;
    if (!plan) throw new Error('Plano não encontrado.');
    const profile = profileBody?.data ?? {};
    return {
        key,
        plan,
        identity: {
            brand: profile.brandName?.trim() || FALLBACK_BRAND,
            coach: profile.name?.trim() || 'Personal trainer',
            coachPhone: formatPhone(profile.phone),
        },
        phone: plan.student?.user?.phone ?? null,
        version: plan.version ?? null,
        send: sendFieldsOf(plan),
    };
}

/** Records that the student got this version of the plan (see src/lib/plan-send.ts). */
async function recordPlanSent(target: PdfExportTarget, version: number | null): Promise<SentInfo> {
    const base = target.kind === 'workout' ? '/api/workout-plans' : '/api/diets';
    const response = await fetch(`${base}/${target.planId}/sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(version ? { version } : {}),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.data) throw new Error(body?.error || 'Não foi possível registrar o envio.');
    // Lists, the student profile and the dashboard queue all show the send status.
    invalidateApi(base);
    invalidateApi('/api/students');
    invalidateApi('/api/dashboard');
    return body.data as SentInfo;
}

/**
 * Builds the PDF of a saved workout plan or diet, shows a preview and hands it off: download,
 * the system share sheet (phones, Safari) or download + the student's WhatsApp chat.
 * Each hand-off records the plan as sent; `onSent` lets the opener update what it shows.
 */
export function ExportPdfDialog({
    target,
    onOpenChange,
    onSent,
}: {
    target: PdfExportTarget | null;
    onOpenChange: (open: boolean) => void;
    onSent?: (info: SentInfo, target: PdfExportTarget) => void;
}) {
    const { toast } = useToast();
    const [showCalories, setShowCalories] = useLocalStorageState('pdf-export:diet-calories', true);
    const [state, setState] = useState<ExportState>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const [marking, setMarking] = useState(false);
    const dataRef = useRef<LoadedData | null>(null);
    const urlRef = useRef<string | null>(null);

    const kind = target?.kind ?? 'workout';
    const planId = target?.planId ?? null;
    const caloriesOption = kind === 'diet' ? showCalories : null;

    useEffect(() => {
        if (!planId) return;
        const target: PdfExportTarget = { kind, planId };
        let cancelled = false;
        setState({ status: 'loading' });

        (async () => {
            const key = `${target.kind}:${target.planId}:${attempt}`;
            const data = dataRef.current?.key === key ? dataRef.current : await loadData(target, key);
            dataRef.current = data;
            const { renderPlanPdf } = await import('./render');
            const model =
                target.kind === 'workout'
                    ? buildWorkoutPdfModel(data.plan as WorkoutPlanForPdf, data.identity)
                    : buildDietPdfModel(data.plan as DietPlanForPdf, data.identity, { showCalories: caloriesOption !== false });
            const blob = await renderPlanPdf(model, window.location.origin);
            if (cancelled) return;

            const fileName = pdfFileName(target.kind, model.header.studentName, model.header.planTitle);
            const file = new File([blob], fileName, { type: 'application/pdf' });
            const message = whatsappMessage(target.kind, model.header);
            const url = URL.createObjectURL(blob);
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
            urlRef.current = url;
            setState({
                status: 'ready',
                url,
                file,
                studentName: model.header.studentName,
                message,
                whatsapp: whatsappLink(data.phone, message),
                version: data.version,
                send: data.send,
            });
        })().catch((error) => {
            if (cancelled) return;
            console.error('PDF export failed:', error);
            setState({ status: 'error', message: error instanceof Error ? error.message : 'Tente novamente.' });
        });

        return () => {
            cancelled = true;
        };
    }, [kind, planId, attempt, caloriesOption]);

    // Free the preview when the dialog closes.
    useEffect(() => {
        if (planId) return;
        dataRef.current = null;
        if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
        }
    }, [planId]);
    useEffect(() => () => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    }, []);

    const ready = state.status === 'ready' ? state : null;
    const name = ready ? firstName(ready.studentName) : 'o aluno';
    // Same object while the PDF doesn't change (recording the send updates `ready`, not the file).
    const readyUrl = ready?.url ?? null;
    const readyFile = ready?.file ?? null;
    const readyMessage = ready?.message ?? '';
    const readyWhatsapp = ready?.whatsapp ?? null;
    const readyPdf = useMemo<ReadyPdf | null>(
        () => (readyUrl && readyFile ? { url: readyUrl, file: readyFile, message: readyMessage, whatsapp: readyWhatsapp } : null),
        [readyUrl, readyFile, readyMessage, readyWhatsapp]
    );
    const preview: PdfPreviewState = ready ? { status: 'ready', url: ready.url } : state.status === 'error' ? state : { status: 'loading' };

    /** Best effort: the PDF already reached the trainer, so a failure here is only logged. */
    const recordSent = async (): Promise<SentInfo | null> => {
        if (!ready || !planId) return null;
        const exported: PdfExportTarget = { kind, planId };
        const key = dataRef.current?.key;
        try {
            const info = await recordPlanSent(exported, ready.version);
            // The dialog may show another plan by now.
            if (dataRef.current && dataRef.current.key === key) {
                dataRef.current = { ...dataRef.current, send: info };
                setState((current) => (current.status === 'ready' ? { ...current, send: info } : current));
            }
            onSent?.(info, exported);
            return info;
        } catch (error) {
            console.error('Could not record the plan as sent:', error);
            return null;
        }
    };

    /** For a PDF sent some other way (before this record existed, printed…). */
    const markAsSent = async () => {
        setMarking(true);
        const info = await recordSent();
        setMarking(false);
        if (!info) {
            toast.error('Não foi possível registrar o envio', 'Tente novamente.');
            return;
        }
        toast.success('Envio registrado', `O PDF consta como enviado para ${name}.`);
        onOpenChange(false);
    };

    const sent = ready ? sendState(ready.send) : null;
    const description = !ready
        ? 'O PDF usa a versão salva do plano.'
        : sent === 'SENT'
          ? `PDF de ${ready.studentName}. Esta versão foi enviada em ${formatSentDate(ready.send.sentAt!)}.`
          : sent === 'CHANGED'
            ? `PDF de ${ready.studentName}. O plano mudou depois do envio de ${formatSentDate(ready.send.sentAt!)}.`
            : `PDF de ${ready.studentName}, pronto para enviar.`;

    return (
        <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[94dvh] max-w-3xl flex-col gap-3 p-4 sm:p-5">
                <DialogHeader>
                    <DialogTitle>{kind === 'workout' ? 'Exportar ficha de treino' : 'Exportar plano alimentar'}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                    {ready && sent !== 'SENT' && (
                        <button
                            type="button"
                            onClick={() => void markAsSent()}
                            disabled={marking}
                            title="Registra o envio sem baixar o PDF de novo"
                            className="self-center text-xs font-semibold text-primary hover:underline disabled:opacity-60 sm:self-start"
                        >
                            {marking ? 'Registrando…' : 'Já enviei esta versão'}
                        </button>
                    )}
                </DialogHeader>

                <PdfPreview state={preview} onRetry={() => setAttempt((value) => value + 1)} />

                {kind === 'diet' && (
                    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-foreground">
                        <input
                            type="checkbox"
                            checked={showCalories}
                            onChange={(event) => setShowCalories(event.target.checked)}
                            className="rounded border-border text-primary focus:ring-primary/25"
                        />
                        Mostrar calorias e macros
                    </label>
                )}

                <PdfHandoffActions pdf={readyPdf} studentName={ready?.studentName ?? null} onHandedOff={() => void recordSent()} />
            </DialogContent>
        </Dialog>
    );
}
