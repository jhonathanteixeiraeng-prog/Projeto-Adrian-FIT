import React from 'react';
import { Document, StyleSheet, Text, View } from '@react-pdf/renderer';
import { DocumentHeader, DocumentPage, InfoStrip } from './kit';
import type { DietPdfFood, DietPdfMeal, DietPdfModel } from './models';
import { pdfColors } from './theme';

const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const styles = StyleSheet.create({
    nutrition: { flexDirection: 'row', alignItems: 'stretch', marginTop: 10 },
    nutritionLabel: { width: 78, justifyContent: 'center' },
    nutritionLabelText: { fontSize: 8.5, fontWeight: 600, color: pdfColors.muted },
    macro: {
        flexGrow: 1,
        flexBasis: 0,
        marginLeft: 6,
        paddingVertical: 6,
        paddingHorizontal: 9,
        borderWidth: 1,
        borderColor: pdfColors.border,
        borderRadius: 5,
    },
    macroLabel: { fontSize: 7.5, color: pdfColors.muted },
    macroValue: { fontSize: 11, fontWeight: 700, marginTop: 1 },
    meal: { marginTop: 14 },
    mealHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: pdfColors.border,
    },
    time: {
        backgroundColor: pdfColors.brandSoft,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginRight: 8,
    },
    timeText: { fontSize: 9, fontWeight: 700, color: pdfColors.brandText },
    mealName: { flex: 1, fontSize: 11.5, fontWeight: 700 },
    mealKcal: { fontSize: 8.5, color: pdfColors.muted },
    food: { paddingVertical: 5, paddingLeft: 4, borderBottomWidth: 0.75, borderBottomColor: pdfColors.rule },
    foodLine: { flexDirection: 'row', alignItems: 'flex-start' },
    foodName: { flex: 1, fontSize: 9.5, fontWeight: 600, paddingRight: 10 },
    foodAmount: { maxWidth: 210, fontSize: 9.5, textAlign: 'right' },
    foodNote: { fontSize: 8, color: pdfColors.muted, marginTop: 1.5 },
    foodSub: { fontSize: 8, color: pdfColors.muted, marginTop: 1.5 },
    foodSubLabel: { fontWeight: 600, color: pdfColors.text },
    mealNotes: { marginTop: 6, paddingVertical: 6, paddingHorizontal: 9, borderRadius: 5, backgroundColor: pdfColors.soft },
    mealNotesText: { fontSize: 8.5, color: pdfColors.muted },
    empty: { marginTop: 16, fontSize: 9, color: pdfColors.muted },
    emptyMeal: { paddingVertical: 6, paddingLeft: 4, fontSize: 8.5, color: pdfColors.muted },
});

function Substitution({ text }: { text: string }) {
    // "Pode trocar por: batata-doce (150 g)" with the label in bold.
    const split = text.indexOf(':');
    if (split < 0) return <Text style={styles.foodSub}>{text}</Text>;
    return (
        <Text style={styles.foodSub}>
            <Text style={styles.foodSubLabel}>{text.slice(0, split + 1)}</Text>
            {text.slice(split + 1)}
        </Text>
    );
}

function Food({ food }: { food: DietPdfFood }) {
    return (
        <View style={styles.food} wrap={false}>
            <View style={styles.foodLine}>
                <Text style={styles.foodName}>{food.name}</Text>
                <Text style={styles.foodAmount}>{food.amount}</Text>
            </View>
            {food.notes && <Text style={styles.foodNote}>{food.notes}</Text>}
            {food.substitution && <Substitution text={food.substitution} />}
        </View>
    );
}

function Meal({ meal, showCalories }: { meal: DietPdfMeal; showCalories: boolean }) {
    const [first, ...rest] = meal.foods;
    return (
        <View style={styles.meal}>
            {/* The meal title never stays alone at the bottom of a page: it moves with its first food. */}
            <View wrap={false}>
                <View style={styles.mealHeader}>
                    {meal.time ? (
                        <View style={styles.time}>
                            <Text style={styles.timeText}>{meal.time}</Text>
                        </View>
                    ) : null}
                    <Text style={styles.mealName}>{meal.name}</Text>
                    {showCalories && meal.foods.length > 0 && <Text style={styles.mealKcal}>{integer.format(Math.round(meal.calories))} kcal</Text>}
                </View>
                {first ? <Food food={first} /> : <Text style={styles.emptyMeal}>Sem alimentos nesta refeição.</Text>}
            </View>
            {rest.map((food) => (
                <Food key={food.key} food={food} />
            ))}
            {meal.notes && (
                <View style={styles.mealNotes} wrap={false}>
                    <Text style={styles.mealNotesText}>
                        <Text style={{ fontWeight: 600, color: pdfColors.text }}>Observações: </Text>
                        {meal.notes}
                    </Text>
                </View>
            )}
        </View>
    );
}

export function DietPlanDocument({ model }: { model: DietPdfModel }) {
    const { header, nutrition } = model;
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
                        { label: 'Refeições', value: `${model.meals.length} por dia` },
                    ]}
                />
                {nutrition && (
                    <View style={styles.nutrition} wrap={false}>
                        <View style={styles.nutritionLabel}>
                            <Text style={styles.nutritionLabelText}>{nutrition.label}</Text>
                        </View>
                        {[
                            { label: 'Calorias', value: `${integer.format(nutrition.calories)} kcal` },
                            { label: 'Proteínas', value: `${integer.format(nutrition.protein)} g` },
                            { label: 'Carboidratos', value: `${integer.format(nutrition.carbs)} g` },
                            { label: 'Gorduras', value: `${integer.format(nutrition.fat)} g` },
                        ].map((macro) => (
                            <View key={macro.label} style={styles.macro}>
                                <Text style={styles.macroLabel}>{macro.label}</Text>
                                <Text style={styles.macroValue}>{macro.value}</Text>
                            </View>
                        ))}
                    </View>
                )}
                {model.meals.length === 0 ? (
                    <Text style={styles.empty}>Este plano ainda não tem refeições cadastradas.</Text>
                ) : (
                    model.meals.map((meal) => <Meal key={meal.key} meal={meal} showCalories={model.showCalories} />)
                )}
            </DocumentPage>
        </Document>
    );
}
