import React from 'react';
import { Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { PdfHeader } from './models';
import { pdfColors } from './theme';

/** Parts shared by the workout and diet PDFs: A4 page, brand header, student block and footer. */

export const kit = StyleSheet.create({
    page: {
        paddingTop: 34,
        paddingBottom: 52,
        paddingHorizontal: 36,
        fontFamily: 'Inter',
        fontSize: 9,
        lineHeight: 1.35,
        color: pdfColors.text,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: pdfColors.border,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    brandMark: {
        width: 22,
        height: 22,
        borderRadius: 5,
        backgroundColor: pdfColors.brand,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 7,
    },
    brandInitial: { fontFamily: 'Montserrat', fontWeight: 800, fontSize: 12, color: '#FFFFFF', lineHeight: 1 },
    brandName: { fontFamily: 'Montserrat', fontWeight: 800, fontSize: 12.5, color: pdfColors.brand, textTransform: 'uppercase', letterSpacing: 0.2 },
    documentTitle: { fontSize: 19, fontWeight: 700, lineHeight: 1.15 },
    planTitle: { fontSize: 11, color: pdfColors.muted, marginTop: 3 },
    coachBlock: { alignItems: 'flex-end', maxWidth: 190, paddingTop: 2 },
    coachLine: { fontSize: 8.5, color: pdfColors.muted, textAlign: 'right' },
    coachName: { fontSize: 8.5, fontWeight: 600, color: pdfColors.text, textAlign: 'right' },
    info: {
        flexDirection: 'row',
        marginTop: 14,
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 6,
        backgroundColor: pdfColors.soft,
    },
    infoCell: { flexGrow: 1, flexBasis: 0, paddingRight: 10 },
    infoLabel: { fontSize: 7.5, color: pdfColors.muted, marginBottom: 2 },
    infoValue: { fontSize: 9.5, fontWeight: 600 },
    footer: {
        position: 'absolute',
        left: 36,
        right: 36,
        bottom: 22,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 7,
        borderTopWidth: 1,
        borderTopColor: pdfColors.rule,
    },
    footerText: { fontSize: 7.5, color: pdfColors.faint },
    sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 18, marginBottom: 6 },
    guideLine: { flexDirection: 'row', marginBottom: 3 },
    guideBullet: { width: 9, color: pdfColors.brandText, fontWeight: 700 },
    guideText: { flex: 1, fontSize: 8, color: pdfColors.muted },
});

export function DocumentPage({ header, children }: { header: PdfHeader; children: React.ReactNode }) {
    const footerLabel = `${header.identity.brand} · ${header.documentTitle} · ${header.studentName}`;
    return (
        <Page size="A4" style={kit.page}>
            {children}
            <View style={kit.footer} fixed>
                <Text style={kit.footerText}>{footerLabel}</Text>
                <Text style={kit.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
            </View>
        </Page>
    );
}

export function DocumentHeader({ header }: { header: PdfHeader }) {
    const { identity } = header;
    return (
        <View style={kit.header}>
            <View style={{ flex: 1, paddingRight: 16 }}>
                <View style={kit.brandRow}>
                    <View style={kit.brandMark}>
                        <Text style={kit.brandInitial}>{identity.brand.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={kit.brandName}>{identity.brand}</Text>
                </View>
                <Text style={kit.documentTitle}>{header.documentTitle}</Text>
                <Text style={kit.planTitle}>{header.planTitle}</Text>
            </View>
            <View style={kit.coachBlock}>
                <Text style={kit.coachName}>{identity.coach}</Text>
                <Text style={kit.coachLine}>Personal trainer</Text>
                {identity.coachPhone && <Text style={kit.coachLine}>{identity.coachPhone}</Text>}
                <Text style={[kit.coachLine, { marginTop: 4 }]}>Emitido em {header.issuedAt}</Text>
            </View>
        </View>
    );
}

export function InfoStrip({ cells }: { cells: Array<{ label: string; value: string | null }> }) {
    return (
        <View style={kit.info}>
            {cells.map((cell) => (
                <View key={cell.label} style={kit.infoCell}>
                    <Text style={kit.infoLabel}>{cell.label}</Text>
                    <Text style={kit.infoValue}>{cell.value || '—'}</Text>
                </View>
            ))}
        </View>
    );
}

export function Guide({ title, lines }: { title: string; lines: string[] }) {
    if (lines.length === 0) return null;
    return (
        <View wrap={false}>
            <Text style={kit.sectionTitle}>{title}</Text>
            {lines.map((line) => (
                <View key={line} style={kit.guideLine}>
                    <Text style={kit.guideBullet}>•</Text>
                    <Text style={kit.guideText}>{line}</Text>
                </View>
            ))}
        </View>
    );
}
