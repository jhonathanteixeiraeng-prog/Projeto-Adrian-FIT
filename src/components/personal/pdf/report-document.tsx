import React from 'react';
import { Document, Image as PdfImage, StyleSheet, Text, View } from '@react-pdf/renderer';
import { DocumentHeader, DocumentPage, InfoStrip, kit } from './kit';
import type { ReportPdfModel, ReportPdfPhoto, ReportPdfTable } from './report-model';
import { pdfColors } from './theme';

const PHOTO = { width: 148, height: 197 };

const styles = StyleSheet.create({
    kpis: { flexDirection: 'row', marginTop: 14 },
    kpi: {
        flexGrow: 1,
        flexBasis: 0,
        borderWidth: 1,
        borderColor: pdfColors.border,
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 9,
    },
    kpiLabel: { fontSize: 7.5, color: pdfColors.muted },
    kpiValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
    kpiValue: { fontSize: 13, fontWeight: 700 },
    kpiDelta: { fontSize: 7.5, fontWeight: 600, backgroundColor: pdfColors.soft, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1.5 },
    kpiDetail: { fontSize: 7.5, color: pdfColors.muted, marginTop: 3 },
    table: { borderWidth: 1, borderColor: pdfColors.border, borderRadius: 6 },
    headRow: { flexDirection: 'row', backgroundColor: pdfColors.soft, borderBottomWidth: 1, borderBottomColor: pdfColors.border },
    row: { flexDirection: 'row', borderBottomWidth: 0.75, borderBottomColor: pdfColors.rule },
    cell: { paddingVertical: 5, paddingHorizontal: 7 },
    headText: { fontSize: 7.5, fontWeight: 600, color: pdfColors.muted },
    cellText: { fontSize: 8.5 },
    strong: { fontWeight: 600 },
    tableNote: { fontSize: 8, fontWeight: 400, color: pdfColors.muted },
    photoRow: { marginBottom: 12 },
    photoAngle: { fontSize: 8, fontWeight: 700, color: pdfColors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
    photoPair: { flexDirection: 'row' },
    photoCell: { width: PHOTO.width, marginRight: 12 },
    photoDate: { fontSize: 7.5, fontWeight: 600, color: pdfColors.muted, marginBottom: 3 },
    photoBox: {
        width: PHOTO.width,
        height: PHOTO.height,
        borderWidth: 1,
        borderColor: pdfColors.border,
        borderRadius: 5,
        backgroundColor: pdfColors.soft,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    photo: { width: PHOTO.width, height: PHOTO.height, objectFit: 'cover' },
    photoEmpty: { fontSize: 7.5, color: pdfColors.faint },
    opinion: { borderWidth: 1, borderColor: pdfColors.border, borderRadius: 6, padding: 10, fontSize: 9, lineHeight: 1.45 },
    signatureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 30 },
    signatureNote: { fontSize: 7.5, color: pdfColors.faint },
    signature: { alignItems: 'center', width: 190 },
    signatureLine: { width: 190, borderBottomWidth: 1, borderBottomColor: pdfColors.faint, marginBottom: 4 },
    signatureName: { fontSize: 8.5, fontWeight: 700 },
    signatureRole: { fontSize: 7.5, color: pdfColors.muted },
});

const align = (value?: 'left' | 'center' | 'right') => ({ textAlign: value ?? 'left' }) as const;

function Table({ table }: { table: ReportPdfTable }) {
    const cellStyle = (index: number) => {
        const column = table.columns[index];
        return [styles.cell, column.width ? { width: column.width } : { flex: 1 }];
    };
    return (
        <View>
            <View wrap={false}>
                <Text style={kit.sectionTitle}>
                    {table.title}
                    {table.note ? <Text style={styles.tableNote}> {table.note}</Text> : null}
                </Text>
                <View style={[styles.table, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 }]}>
                    <View style={styles.headRow}>
                        {table.columns.map((column, index) => (
                            <View key={column.label} style={cellStyle(index)}>
                                <Text style={[styles.headText, align(column.align)]}>{column.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
            <View style={[styles.table, { borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
                {table.rows.map((row, rowIndex) => (
                    <View key={rowIndex} style={[styles.row, rowIndex === table.rows.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
                        {row.map((value, index) => (
                            <View key={index} style={cellStyle(index)}>
                                <Text style={[styles.cellText, align(table.columns[index].align), index === 0 ? styles.strong : {}]}>{value}</Text>
                            </View>
                        ))}
                    </View>
                ))}
            </View>
        </View>
    );
}

function Photo({ photo, missing }: { photo: ReportPdfPhoto | null; missing: string }) {
    return (
        <View style={styles.photoCell}>
            <Text style={styles.photoDate}>{photo ? photo.date : ' '}</Text>
            <View style={styles.photoBox}>
                {photo?.src ? <PdfImage src={photo.src} style={styles.photo} /> : <Text style={styles.photoEmpty}>{photo ? 'Foto indisponível' : missing}</Text>}
            </View>
        </View>
    );
}

/** Evolution report: the same sections as the report page, on A4. */
export function EvolutionReportDocument({ model }: { model: ReportPdfModel }) {
    const { header } = model;
    return (
        <Document
            title={`${header.documentTitle} — ${header.studentName}`}
            author={header.identity.coach}
            subject={header.planTitle}
            creator={header.identity.brand}
            producer={header.identity.brand}
            language="pt-BR"
        >
            <DocumentPage header={header}>
                <DocumentHeader header={header} />
                <InfoStrip cells={model.info} />

                <View style={styles.kpis} wrap={false}>
                    {model.kpis.map((kpi, index) => (
                        <View key={kpi.label} style={[styles.kpi, index < model.kpis.length - 1 ? { marginRight: 8 } : {}]}>
                            <Text style={styles.kpiLabel}>{kpi.label}</Text>
                            <View style={styles.kpiValueRow}>
                                <Text style={styles.kpiValue}>{kpi.value}</Text>
                                {kpi.delta && <Text style={styles.kpiDelta}>{kpi.delta}</Text>}
                            </View>
                            <Text style={styles.kpiDetail}>{kpi.detail}</Text>
                        </View>
                    ))}
                </View>

                {model.measures.length > 0 && (
                    <Table
                        table={{
                            title: 'Evolução das medidas corporais',
                            note: null,
                            columns: [
                                { label: 'Medida' },
                                { label: 'Inicial', width: 90, align: 'center' },
                                { label: 'Atual', width: 90, align: 'center' },
                                { label: 'Variação', width: 90, align: 'right' },
                            ],
                            rows: model.measures.map((measure) => [measure.label, measure.initial, measure.current, measure.delta]),
                        }}
                    />
                )}

                {model.photos.length > 0 && (
                    <View>
                        <Text style={kit.sectionTitle} minPresenceAhead={PHOTO.height + 30}>
                            Comparativo fotográfico
                        </Text>
                        {model.photos.map((pair) => (
                            <View key={pair.angle} style={styles.photoRow} wrap={false}>
                                <Text style={styles.photoAngle}>{pair.angle}</Text>
                                <View style={styles.photoPair}>
                                    <Photo photo={pair.before} missing="Sem foto" />
                                    <Photo photo={pair.after} missing="Sem foto posterior" />
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {model.tables.map((table) => (
                    <Table key={table.title} table={table} />
                ))}

                <View wrap={false}>
                    {model.opinion ? (
                        <>
                            <Text style={kit.sectionTitle}>Parecer do treinador</Text>
                            <Text style={styles.opinion}>{model.opinion}</Text>
                        </>
                    ) : null}
                    <View style={styles.signatureRow}>
                        <Text style={styles.signatureNote}>{model.generatedNote}</Text>
                        <View style={styles.signature}>
                            <View style={styles.signatureLine} />
                            <Text style={styles.signatureName}>{header.identity.coach}</Text>
                            <Text style={styles.signatureRole}>Responsável técnico</Text>
                        </View>
                    </View>
                </View>
            </DocumentPage>
        </Document>
    );
}
