import React from 'react';
import { pdf, type DocumentProps } from '@react-pdf/renderer';
import { DietPlanDocument } from './diet-document';
import type { DietPdfModel, WorkoutPdfModel } from './models';
import { registerPdfFonts } from './theme';
import { WorkoutPlanDocument } from './workout-document';

/**
 * Renders a plan PDF in the browser. Loaded with a dynamic import by the export dialog, so the PDF
 * engine (~500 KB) is only downloaded when the trainer exports something.
 */
export async function renderPlanPdf(model: WorkoutPdfModel | DietPdfModel, origin: string): Promise<Blob> {
    registerPdfFonts(origin);
    const element = model.kind === 'workout' ? <WorkoutPlanDocument model={model} /> : <DietPlanDocument model={model} />;
    return pdf(element as React.ReactElement<DocumentProps>).toBlob();
}
