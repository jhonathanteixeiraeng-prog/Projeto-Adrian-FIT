import React from 'react';
import { pdf, type DocumentProps } from '@react-pdf/renderer';
import { DietPlanDocument } from './diet-document';
import type { DietPdfModel, WorkoutPdfModel } from './models';
import { EvolutionReportDocument } from './report-document';
import type { ReportPdfModel, ReportPdfPhoto } from './report-model';
import { registerPdfFonts } from './theme';
import { WorkoutPlanDocument } from './workout-document';

/**
 * Renders the PDFs in the browser. Loaded with a dynamic import by the export dialogs, so the PDF
 * engine (~500 KB) is only downloaded when the trainer exports something.
 */
export async function renderPlanPdf(model: WorkoutPdfModel | DietPdfModel, origin: string): Promise<Blob> {
    registerPdfFonts(origin);
    const element = model.kind === 'workout' ? <WorkoutPlanDocument model={model} /> : <DietPlanDocument model={model} />;
    return pdf(element as React.ReactElement<DocumentProps>).toBlob();
}

const PHOTO_MAX_SIDE = 900;

/**
 * The PDF engine only reads JPEG/PNG and fetches without the page's decoding: each progress photo
 * (private, opened with the trainer's session cookie) becomes a small JPEG first. Null when it can't be read.
 */
async function photoAsJpeg(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) return null;
        const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'from-image' });
        const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        return canvas.toDataURL('image/jpeg', 0.82);
    } catch {
        return null;
    }
}

const loadPhoto = async (photo: ReportPdfPhoto): Promise<ReportPdfPhoto> => ({ ...photo, src: photo.src ? await photoAsJpeg(photo.src) : null });

export async function renderReportPdf(model: ReportPdfModel, origin: string): Promise<Blob> {
    registerPdfFonts(origin);
    const photos = await Promise.all(
        model.photos.map(async (pair) => ({ ...pair, before: await loadPhoto(pair.before), after: pair.after ? await loadPhoto(pair.after) : null }))
    );
    const element = <EvolutionReportDocument model={{ ...model, photos }} />;
    return pdf(element as React.ReactElement<DocumentProps>).toBlob();
}
