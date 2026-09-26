import { Font } from '@react-pdf/renderer';

/**
 * Look of the exported PDFs: a light paper document in the personal area's palette
 * (graphite text, brand orange only for the mark and a few accents).
 */
export const pdfColors = {
    text: '#16181C',
    muted: '#5B616B',
    faint: '#8B919A',
    border: '#E2E5E9',
    rule: '#EEF0F2',
    soft: '#F5F6F8',
    brand: '#F88022',
    /** Orange that reads as text on white (4.5:1). */
    brandText: '#C2570C',
    brandSoft: '#FEF1E6',
};

/** Superset colors (A, B, C…), the same order as the editor: orange, sky, violet, emerald, rose. */
export const groupTones = [
    { line: '#F88022', text: '#C2570C', fill: '#FEEBDD' },
    { line: '#0EA5E9', text: '#0369A1', fill: '#E0F2FE' },
    { line: '#8B5CF6', text: '#6D28D9', fill: '#EDE9FE' },
    { line: '#10B981', text: '#047857', fill: '#D1FAE5' },
    { line: '#F43F5E', text: '#BE123C', fill: '#FFE4E6' },
];

let fontsRegistered = false;

/** Inter for the document, Montserrat for the brand mark (both OFL, served from /public/fonts/pdf). */
export function registerPdfFonts(origin: string) {
    if (fontsRegistered) return;
    const url = (file: string) => new URL(`/fonts/pdf/${file}`, origin).href;
    Font.register({
        family: 'Inter',
        fonts: [
            { src: url('Inter-Regular.ttf'), fontWeight: 400 },
            { src: url('Inter-SemiBold.ttf'), fontWeight: 600 },
            { src: url('Inter-Bold.ttf'), fontWeight: 700 },
        ],
    });
    Font.register({ family: 'Montserrat', src: url('Montserrat-ExtraBold.ttf'), fontWeight: 800 });
    // No hyphenation: the default rules are English and split Portuguese words in odd places.
    Font.registerHyphenationCallback((word) => [word]);
    fontsRegistered = true;
}
