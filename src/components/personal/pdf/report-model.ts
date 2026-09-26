import { firstName } from '@/components/personal/students/lib';
import { fileNamePart, type PdfHeader } from './models';

/**
 * The evolution report PDF the trainer sends over WhatsApp. The report page fills it with the same
 * formatted figures it shows on screen, so the PDF and the page always match.
 */

export interface ReportPdfKpi {
    label: string;
    value: string;
    /** "-2,5 kg" when the value changed in the period. */
    delta: string | null;
    detail: string;
}

export interface ReportPdfMeasure {
    label: string;
    initial: string;
    current: string;
    delta: string;
}

export interface ReportPdfPhoto {
    date: string;
    /** Photo URL on the page; JPEG data by the time the PDF is drawn (null when it couldn't be loaded). */
    src: string | null;
}

export interface ReportPdfPhotoPair {
    angle: string;
    before: ReportPdfPhoto;
    after: ReportPdfPhoto | null;
}

export interface ReportPdfTable {
    title: string;
    /** "(últimas 10 de 14)" when rows were left out. */
    note: string | null;
    columns: Array<{ label: string; width?: number; align?: 'left' | 'center' | 'right' }>;
    rows: string[][];
}

export interface ReportPdfModel {
    header: PdfHeader;
    info: Array<{ label: string; value: string | null }>;
    kpis: ReportPdfKpi[];
    measures: ReportPdfMeasure[];
    photos: ReportPdfPhotoPair[];
    tables: ReportPdfTable[];
    opinion: string;
    /** "Adrian Fit · relatório gerado em 26/09/2026 às 18:40". */
    generatedNote: string;
}

/** "Relatório de evolução - João Silva - 26-09-2026.pdf". */
export function reportPdfFileName(studentName: string, issuedAt: Date): string {
    const day = issuedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const name = ['Relatório de evolução', fileNamePart(studentName), day].filter(Boolean).join(' - ').slice(0, 120).trim();
    return `${name}.pdf`;
}

/** Pre-filled WhatsApp text; the trainer attaches the PDF and can edit it before sending. */
export function reportWhatsappMessage(studentName: string, period: string): string {
    const range = period ? ` (${period.charAt(0).toLowerCase()}${period.slice(1)})` : '';
    return `Olá, ${firstName(studentName)}! Segue o seu relatório de evolução${range}. Qualquer dúvida, é só me chamar.`;
}
