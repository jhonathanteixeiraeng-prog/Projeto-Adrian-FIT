import React from 'react';
import { Document, Link, StyleSheet, Text, View } from '@react-pdf/renderer';
import { DocumentHeader, DocumentPage, Guide, InfoStrip } from './kit';
import type { WorkoutPdfDay, WorkoutPdfModel, WorkoutPdfRow } from './models';
import { groupTones, pdfColors } from './theme';

const W = { tag: 28, sets: 38, reps: 66, load: 78, rpe: 34, rest: 72 };

/** Keeps "kg"/"s" with the number ("60/90/120 s" never leaves "s" alone on the next line). */
const glue = (text: string) => text.replace(/ /g, ' ');

/** Per-set values can be long ("22,5/25/27,5/30 kg"): smaller type instead of breaking them. */
const fit = (text: string) => (text.length > 15 ? { fontSize: 7.5 } : text.length > 11 ? { fontSize: 8 } : null);

const styles = StyleSheet.create({
    day: { marginTop: 16 },
    dayHeader: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 5,
        backgroundColor: pdfColors.soft,
        borderLeftWidth: 3,
        borderLeftColor: pdfColors.brand,
    },
    weekday: { fontSize: 8, color: pdfColors.muted },
    dayName: { fontSize: 11.5, fontWeight: 700, marginTop: 1 },
    daySummary: { fontSize: 8, color: pdfColors.muted, marginLeft: 8, paddingBottom: 1 },
    headRow: {
        flexDirection: 'row',
        paddingTop: 7,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: pdfColors.border,
        borderLeftWidth: 2.5,
        borderLeftColor: 'transparent',
    },
    headText: { fontSize: 7.5, fontWeight: 600, color: pdfColors.muted },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 5.5,
        borderBottomWidth: 0.75,
        borderBottomColor: pdfColors.rule,
        borderLeftWidth: 2.5,
    },
    cTag: { width: W.tag, paddingLeft: 5 },
    cName: { flex: 1, paddingRight: 8 },
    cSets: { width: W.sets, textAlign: 'center' },
    cReps: { width: W.reps, paddingRight: 4 },
    cLoad: { width: W.load, paddingRight: 4 },
    cRpe: { width: W.rpe, textAlign: 'center' },
    cRest: { width: W.rest },
    tag: { fontSize: 8, fontWeight: 700, color: pdfColors.faint, paddingTop: 1 },
    tagPill: { alignSelf: 'flex-start', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 0.5 },
    nameLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
    name: { fontSize: 9.5, fontWeight: 600, marginRight: 5 },
    chip: { borderWidth: 0.75, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 0.5, marginTop: 1 },
    chipText: { fontSize: 6.5, fontWeight: 600 },
    details: { fontSize: 8, color: pdfColors.muted, marginTop: 1.5 },
    video: { fontSize: 7.5, color: pdfColors.brandText, marginTop: 2, textDecoration: 'none' },
    value: { fontSize: 9, fontWeight: 600 },
    restNote: { fontSize: 7, color: pdfColors.muted },
    empty: { marginTop: 16, fontSize: 9, color: pdfColors.muted },
});

function Row({ row, columns }: { row: WorkoutPdfRow; columns: WorkoutPdfModel['columns'] }) {
    const tone = row.tone === null ? null : groupTones[row.tone % groupTones.length];
    return (
        <View style={[styles.row, { borderLeftColor: tone ? tone.line : '#FFFFFF' }]} wrap={false}>
            <View style={styles.cTag}>
                {tone ? (
                    <View style={[styles.tagPill, { backgroundColor: tone.fill }]}>
                        <Text style={[styles.tag, { color: tone.text, paddingTop: 0 }]}>{row.tag}</Text>
                    </View>
                ) : (
                    <Text style={styles.tag}>{row.tag}</Text>
                )}
            </View>
            <View style={styles.cName}>
                <View style={styles.nameLine}>
                    <Text style={styles.name}>{row.name}</Text>
                    {row.chip && tone && (
                        <View style={[styles.chip, { borderColor: tone.line }]}>
                            <Text style={[styles.chipText, { color: tone.text }]}>{row.chip}</Text>
                        </View>
                    )}
                </View>
                {row.details && <Text style={styles.details}>{row.details}</Text>}
                {row.videoUrl && (
                    <Link src={row.videoUrl} style={styles.video}>
                        Ver vídeo do exercício
                    </Link>
                )}
            </View>
            <Text style={[styles.cSets, styles.value]}>{row.sets}</Text>
            <Text style={[styles.cReps, styles.value, fit(row.reps) ?? {}]}>{row.reps}</Text>
            {columns.load && <Text style={[styles.cLoad, styles.value, fit(row.load) ?? {}]}>{glue(row.load)}</Text>}
            {columns.rpe && <Text style={[styles.cRpe, styles.value]}>{row.rpe}</Text>}
            <View style={styles.cRest}>
                <Text style={[styles.value, fit(row.rest) ?? {}]}>{glue(row.rest)}</Text>
                {row.restNote && <Text style={styles.restNote}>{row.restNote}</Text>}
            </View>
        </View>
    );
}

function Day({ day, columns }: { day: WorkoutPdfDay; columns: WorkoutPdfModel['columns'] }) {
    const [first, ...rest] = day.rows;
    return (
        <View style={styles.day}>
            {/* The day title never stays alone at the bottom of a page: it moves with its first exercise. */}
            <View wrap={false}>
                <View style={styles.dayHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.weekday}>{day.weekday}</Text>
                        <Text style={styles.dayName}>{day.name}</Text>
                    </View>
                    <Text style={styles.daySummary}>{day.summary}</Text>
                </View>
                <View style={styles.headRow}>
                    <Text style={[styles.cTag, styles.headText]}>#</Text>
                    <Text style={[styles.cName, styles.headText]}>Exercício</Text>
                    <Text style={[styles.cSets, styles.headText]}>Séries</Text>
                    <Text style={[styles.cReps, styles.headText]}>Repetições</Text>
                    {columns.load && <Text style={[styles.cLoad, styles.headText]}>Carga</Text>}
                    {columns.rpe && <Text style={[styles.cRpe, styles.headText]}>RPE</Text>}
                    <Text style={[styles.cRest, styles.headText]}>Descanso</Text>
                </View>
                {first ? <Row row={first} columns={columns} /> : <Text style={[styles.empty, { marginTop: 6 }]}>Sem exercícios neste dia.</Text>}
            </View>
            {rest.map((row) => (
                <Row key={row.key} row={row} columns={columns} />
            ))}
        </View>
    );
}

export function WorkoutPlanDocument({ model }: { model: WorkoutPdfModel }) {
    const { header } = model;
    const exercises = model.days.reduce((sum, day) => sum + day.rows.length, 0);
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
                <InfoStrip
                    cells={[
                        { label: 'Aluno', value: header.studentName },
                        ...(header.goal ? [{ label: 'Objetivo', value: header.goal }] : []),
                        { label: 'Período', value: header.period },
                        { label: 'Divisão', value: `${model.days.length} ${model.days.length === 1 ? 'treino' : 'treinos'} · ${exercises} exercícios` },
                    ]}
                />
                {model.days.length === 0 ? (
                    <Text style={styles.empty}>Esta ficha ainda não tem treinos cadastrados.</Text>
                ) : (
                    model.days.map((day) => <Day key={day.key} day={day} columns={model.columns} />)
                )}
                <Guide title="Como ler esta ficha" lines={model.guide} />
            </DocumentPage>
        </Document>
    );
}
