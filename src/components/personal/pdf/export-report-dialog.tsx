'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { whatsappLink } from '@/lib/whatsapp';
import { PdfHandoffActions, PdfPreview, type PdfPreviewState, type ReadyPdf } from './pdf-handoff';
import { reportPdfFileName, reportWhatsappMessage, type ReportPdfModel } from './report-model';

type RenderState = { status: 'loading' } | { status: 'error'; message: string } | ({ status: 'ready' } & ReadyPdf);

/**
 * The evolution report as a PDF to send over WhatsApp: preview, download, share or download + the
 * student's chat. `model` is a snapshot taken when the trainer clicks "Enviar ao aluno".
 */
export function ExportReportDialog({
    model,
    phone,
    onOpenChange,
}: {
    /** Null closes the dialog. */
    model: ReportPdfModel | null;
    phone: string | null;
    onOpenChange: (open: boolean) => void;
}) {
    const [state, setState] = useState<RenderState>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const urlRef = useRef<string | null>(null);

    useEffect(() => {
        if (!model) return;
        let cancelled = false;
        setState({ status: 'loading' });
        (async () => {
            const { renderReportPdf } = await import('./render');
            const blob = await renderReportPdf(model, window.location.origin);
            if (cancelled) return;
            const file = new File([blob], reportPdfFileName(model.header.studentName, new Date()), { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
            urlRef.current = url;
            const message = reportWhatsappMessage(model.header.studentName, model.header.period ?? '');
            setState({ status: 'ready', url, file, message, whatsapp: whatsappLink(phone, message) });
        })().catch((error) => {
            if (cancelled) return;
            console.error('Report PDF failed:', error);
            setState({ status: 'error', message: error instanceof Error ? error.message : 'Tente novamente.' });
        });
        return () => {
            cancelled = true;
        };
    }, [model, phone, attempt]);

    // Free the preview when the dialog closes or goes away.
    useEffect(() => {
        if (model || !urlRef.current) return;
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
    }, [model]);
    useEffect(() => () => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    }, []);

    const readyUrl = state.status === 'ready' ? state.url : null;
    const readyFile = state.status === 'ready' ? state.file : null;
    const readyMessage = state.status === 'ready' ? state.message : '';
    const readyWhatsapp = state.status === 'ready' ? state.whatsapp : null;
    const pdf = useMemo<ReadyPdf | null>(
        () => (readyUrl && readyFile ? { url: readyUrl, file: readyFile, message: readyMessage, whatsapp: readyWhatsapp } : null),
        [readyUrl, readyFile, readyMessage, readyWhatsapp]
    );
    const preview: PdfPreviewState = readyUrl ? { status: 'ready', url: readyUrl } : state.status === 'error' ? state : { status: 'loading' };

    return (
        <Dialog open={Boolean(model)} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[94dvh] max-w-3xl flex-col gap-3 p-4 sm:p-5">
                <DialogHeader>
                    <DialogTitle>Enviar relatório de evolução</DialogTitle>
                    <DialogDescription>
                        {model ? `Relatório de ${model.header.studentName} · ${model.header.period ?? ''}` : 'Relatório de evolução'}
                    </DialogDescription>
                </DialogHeader>
                <PdfPreview state={preview} onRetry={() => setAttempt((value) => value + 1)} />
                <PdfHandoffActions pdf={pdf} studentName={model?.header.studentName ?? null} />
            </DialogContent>
        </Dialog>
    );
}
