'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, Download, Loader2, MessageCircle, RefreshCw, Share2 } from 'lucide-react';
import { useToast } from '@/components/ui';
import { firstName } from '@/components/personal/students/lib';

/** Preview and hand-off shared by the PDF dialogs (plans and the evolution report). */

export const pdfButtonClass =
    'inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60';
export const pdfPrimaryButtonClass =
    'inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60';

export type PdfPreviewState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; url: string };

/** Rendering spinner, the error with a retry, or the document. */
export function PdfPreview({ state, onRetry }: { state: PdfPreviewState; onRetry: () => void }) {
    return (
        <div className="relative flex h-[58dvh] min-h-[280px] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
            {state.status === 'loading' && (
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando o PDF…
                </span>
            )}
            {state.status === 'error' && (
                <div className="max-w-sm space-y-3 px-4 text-center">
                    <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
                    <p className="text-sm text-foreground">Não foi possível gerar o PDF.</p>
                    <p className="text-xs text-muted-foreground">{state.message}</p>
                    <button type="button" onClick={onRetry} className={pdfButtonClass}>
                        <RefreshCw className="h-4 w-4" />
                        Tentar de novo
                    </button>
                </div>
            )}
            {state.status === 'ready' && <iframe title="Prévia do PDF" src={`${state.url}#navpanes=0&view=FitH`} className="h-full w-full bg-white" />}
        </div>
    );
}

export interface ReadyPdf {
    /** Object URL of the rendered PDF. */
    url: string;
    file: File;
    /** Pre-filled WhatsApp text. */
    message: string;
    /** wa.me link with the message, or null when the student has no WhatsApp number. */
    whatsapp: string | null;
}

function saveFile(url: string, fileName: string) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

/**
 * Hands the PDF to the student: download, the system share sheet (phones, Safari) or download + their
 * WhatsApp chat. `onHandedOff` runs after each successful hand-off (e.g. to record a plan as sent).
 */
export function PdfHandoffActions({
    pdf,
    studentName,
    onHandedOff,
}: {
    pdf: ReadyPdf | null;
    studentName: string | null;
    onHandedOff?: () => void;
}) {
    const { toast } = useToast();
    const name = studentName ? firstName(studentName) : 'o aluno';
    const canShare = useMemo(
        () => Boolean(pdf && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [pdf.file] })),
        [pdf]
    );
    const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    const shareFirst = canShare && Boolean(touch);

    const download = () => {
        if (!pdf) return;
        saveFile(pdf.url, pdf.file.name);
        onHandedOff?.();
        toast.success('PDF baixado', pdf.file.name);
    };

    const openWhatsapp = () => {
        if (!pdf?.whatsapp) return;
        saveFile(pdf.url, pdf.file.name);
        window.open(pdf.whatsapp, '_blank', 'noopener,noreferrer');
        onHandedOff?.();
        toast.info('PDF baixado', `Anexe o arquivo na conversa com ${name} que abriu no WhatsApp.`);
    };

    const share = async () => {
        if (!pdf) return;
        try {
            await navigator.share({ files: [pdf.file], title: pdf.file.name.replace(/\.pdf$/i, ''), text: pdf.message });
            onHandedOff?.();
        } catch (error) {
            if ((error as DOMException)?.name === 'AbortError') return;
            toast.error('Não foi possível compartilhar', 'Baixe o PDF e envie pelo WhatsApp.');
        }
    };

    const hint = !pdf
        ? null
        : shareFirst
          ? `Toque em Compartilhar e escolha o WhatsApp de ${name}.`
          : pdf.whatsapp
            ? `O PDF é baixado e a conversa com ${name} abre no WhatsApp. É só anexar o arquivo.`
            : `Cadastre o WhatsApp de ${name} na ficha do aluno para abrir a conversa direto daqui.`;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-[200px] flex-1 text-xs text-muted-foreground">{hint}</p>
            {canShare && !shareFirst && (
                <button type="button" onClick={() => void share()} className={pdfButtonClass}>
                    <Share2 className="h-4 w-4" />
                    Compartilhar
                </button>
            )}
            <button
                type="button"
                onClick={download}
                disabled={!pdf}
                className={shareFirst || pdf?.whatsapp || !pdf ? pdfButtonClass : pdfPrimaryButtonClass}
            >
                <Download className="h-4 w-4" />
                Baixar PDF
            </button>
            {shareFirst ? (
                <button type="button" onClick={() => void share()} className={pdfPrimaryButtonClass}>
                    <Share2 className="h-4 w-4" />
                    Compartilhar
                </button>
            ) : (
                pdf?.whatsapp && (
                    <button type="button" onClick={openWhatsapp} className={pdfPrimaryButtonClass}>
                        <MessageCircle className="h-4 w-4" />
                        Baixar e abrir WhatsApp
                    </button>
                )
            )}
        </div>
    );
}
