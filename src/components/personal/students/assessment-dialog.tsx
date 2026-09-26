'use client';

import React, { useEffect, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, useToast } from '@/components/ui';
import { ASSESSMENT_MEASURES, type AssessmentMeasureKey } from '@/lib/assessments';
import { cn, parseDecimalInput } from '@/lib/utils';
import { PHOTO_ANGLE_LABELS, errorMessage, requestJson, toDateInputValue, todayInput } from './lib';
import { discardUploadedPhoto, uploadProgressPhoto } from './photo-upload';
import { MEASURES } from './progress-section';
import type { Assessment } from './types';
import { Field, inputClass, primarySmallButtonClass, smallButtonClass, textareaClass } from './ui';

const PHOTO_SLOTS = ['FRONT', 'SIDE', 'BACK'] as const;
type Slot = (typeof PHOTO_SLOTS)[number];

interface SlotState {
    /** Id of a photo already saved in this assessment. */
    savedId?: string;
    url?: string;
    /** Uploaded in this dialog, saved with the assessment. */
    isNew?: boolean;
    uploading?: boolean;
    error?: string;
}

type Values = Record<AssessmentMeasureKey, string>;

const SHORT_LABEL: Record<string, string> = Object.fromEntries(MEASURES.map((measure) => [measure.key, measure.short]));
const CIRCUMFERENCES = ASSESSMENT_MEASURES.filter((measure) => measure.unit === 'cm');
const emptyValues = () => Object.fromEntries(ASSESSMENT_MEASURES.map((measure) => [measure.key, ''])) as Values;
const emptySlots = (): Record<Slot, SlotState> => ({ FRONT: {}, SIDE: {}, BACK: {} });
const toText = (value: number | null) => (value == null ? '' : String(value).replace('.', ','));

function FormError({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
            {message}
        </p>
    );
}

function PhotoSlot({ slot, state, disabled, onPick, onRemove }: { slot: Slot; state: SlotState; disabled: boolean; onPick: (file: File) => void; onRemove: () => void }) {
    const label = PHOTO_ANGLE_LABELS[slot] ?? slot;
    return (
        <div className="space-y-1">
            <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40">
                {state.uploading ? (
                    <span className="inline-flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Enviando…
                    </span>
                ) : state.url ? (
                    <>
                        {/* Blob/remote URL thumbnails: next/image would need every storage host configured. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={state.url} alt={`Foto de ${label.toLowerCase()}`} className="h-full w-full object-cover" />
                        <button
                            type="button"
                            onClick={onRemove}
                            disabled={disabled}
                            className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                            aria-label={`Remover foto de ${label.toLowerCase()}`}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </>
                ) : (
                    <label
                        className={cn(
                            'flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
                            disabled && 'pointer-events-none opacity-60'
                        )}
                    >
                        <Camera className="h-5 w-5" />
                        Adicionar
                        <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            disabled={disabled}
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = '';
                                if (file) onPick(file);
                            }}
                        />
                    </label>
                )}
            </div>
            <p className="text-center text-xs font-medium text-muted-foreground">{label}</p>
            {state.error && <p className="text-center text-xs text-red-600 dark:text-red-400">{state.error}</p>}
        </div>
    );
}

/**
 * Records (or edits) an assessment: date, weight, body fat, circumferences, front/side/back
 * photos and notes. Blank fields are simply not measured.
 */
export function AssessmentDialog({
    open,
    onOpenChange,
    studentId,
    studentName,
    assessment,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentId: string;
    studentName: string;
    /** Null to record a new one. */
    assessment: Assessment | null;
    onSaved: (assessment: Assessment) => void;
}) {
    const { toast } = useToast();
    const [date, setDate] = useState(todayInput());
    const [values, setValues] = useState<Values>(emptyValues);
    const [notes, setNotes] = useState('');
    const [slots, setSlots] = useState(emptySlots);
    const [removedIds, setRemovedIds] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setDate(assessment ? toDateInputValue(assessment.date) : todayInput());
        setValues(
            assessment
                ? (Object.fromEntries(ASSESSMENT_MEASURES.map((measure) => [measure.key, toText(assessment[measure.key])])) as Values)
                : emptyValues()
        );
        setNotes(assessment?.notes ?? '');
        const next = emptySlots();
        for (const photo of assessment?.photos ?? []) {
            const slot = photo.angle as Slot;
            if (PHOTO_SLOTS.includes(slot) && !next[slot].url) next[slot] = { savedId: photo.id, url: photo.url };
        }
        setSlots(next);
        setRemovedIds([]);
        setErrors({});
        setFormError(null);
        // Reset only when the dialog opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const uploading = PHOTO_SLOTS.some((slot) => slots[slot].uploading);
    const busy = saving || uploading;

    const setValue = (key: AssessmentMeasureKey) => (event: React.ChangeEvent<HTMLInputElement>) =>
        setValues((current) => ({ ...current, [key]: event.target.value }));

    // A saved photo is removed when the assessment is saved; an upload from this dialog goes right away.
    const dropSlot = (slot: Slot) => {
        const { savedId, url, isNew } = slots[slot];
        if (savedId) setRemovedIds((current) => [...current, savedId]);
        if (isNew && url) discardUploadedPhoto(url);
    };

    const removePhoto = (slot: Slot) => {
        dropSlot(slot);
        setSlots((current) => ({ ...current, [slot]: {} }));
    };

    const pickPhoto = async (slot: Slot, file: File) => {
        dropSlot(slot);
        setSlots((current) => ({ ...current, [slot]: { uploading: true } }));
        try {
            const url = await uploadProgressPhoto(file);
            setSlots((current) => ({ ...current, [slot]: { url, isNew: true } }));
        } catch (error) {
            setSlots((current) => ({ ...current, [slot]: { error: errorMessage(error) } }));
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy) return;
        const nextErrors: Record<string, string> = {};
        if (!date) nextErrors.date = 'Informe a data';
        else if (date > todayInput()) nextErrors.date = 'A data não pode ser futura';

        const measures: Partial<Record<AssessmentMeasureKey, number | null>> = {};
        for (const measure of ASSESSMENT_MEASURES) {
            const raw = values[measure.key].trim();
            if (!raw) {
                measures[measure.key] = null;
                continue;
            }
            const value = parseDecimalInput(raw);
            if (value === null || !Number.isFinite(value) || value < measure.min || value > measure.max) {
                nextErrors[measure.key] = `Entre ${measure.min} e ${measure.max}`;
            } else {
                measures[measure.key] = value;
            }
        }
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        const photos = PHOTO_SLOTS.flatMap((slot) => (slots[slot].isNew && slots[slot].url ? [{ url: slots[slot].url!, angle: slot }] : []));
        const keepsPhotos = PHOTO_SLOTS.some((slot) => slots[slot].savedId);
        const hasContent = Object.values(measures).some((value) => value != null) || photos.length > 0 || keepsPhotos || notes.trim();
        if (!hasContent) {
            setFormError('Registre pelo menos uma medida, uma foto ou uma observação.');
            return;
        }

        setSaving(true);
        setFormError(null);
        try {
            const body = { date, ...measures, notes: notes.trim() || null, photos, ...(assessment ? { removePhotoIds: removedIds } : {}) };
            const result = await requestJson<{ data: Assessment }>(
                assessment ? `/api/students/${studentId}/assessments/${assessment.id}` : `/api/students/${studentId}/assessments`,
                { method: assessment ? 'PUT' : 'POST', body }
            );
            toast.success(assessment ? 'Avaliação atualizada' : 'Avaliação registrada', studentName);
            onSaved(result.data);
            onOpenChange(false);
        } catch (error) {
            setFormError(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    /** Closing without saving throws away the photos uploaded in this dialog. */
    const cancel = () => {
        for (const slot of PHOTO_SLOTS) {
            const { url, isNew } = slots[slot];
            if (isNew && url) discardUploadedPhoto(url);
        }
        onOpenChange(false);
    };

    const measureField = (key: AssessmentMeasureKey, label: string, placeholder?: string) => (
        <Field key={key} label={label} htmlFor={`assessment-${key}`} error={errors[key]}>
            <input
                id={`assessment-${key}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={values[key]}
                onChange={setValue(key)}
                placeholder={placeholder}
                className={inputClass}
            />
        </Field>
    );

    return (
        <Dialog open={open} onOpenChange={(next) => !busy && (next ? onOpenChange(true) : cancel())}>
            <DialogContent className="flex max-h-[92dvh] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0">
                <DialogHeader className="border-b border-border px-5 py-4 text-left">
                    <DialogTitle className="text-base font-bold">{assessment ? 'Editar avaliação' : 'Nova avaliação'}</DialogTitle>
                    <DialogDescription>{studentName} · deixe em branco o que não mediu.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        <div className="grid grid-cols-3 gap-3">
                            <Field label="Data" htmlFor="assessment-date" error={errors.date}>
                                <input
                                    id="assessment-date"
                                    type="date"
                                    max={todayInput()}
                                    value={date}
                                    onChange={(event) => setDate(event.target.value)}
                                    className={inputClass}
                                />
                            </Field>
                            {measureField('weight', 'Peso (kg)', '72,5')}
                            {measureField('bodyFatPercentage', '% de gordura', '18')}
                        </div>

                        <fieldset className="space-y-2">
                            <legend className="text-xs font-semibold text-muted-foreground">Circunferências (cm)</legend>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                                {CIRCUMFERENCES.map((measure) => measureField(measure.key, SHORT_LABEL[measure.key] ?? measure.label))}
                            </div>
                        </fieldset>

                        <fieldset className="space-y-2">
                            <legend className="text-xs font-semibold text-muted-foreground">Fotos</legend>
                            <div className="grid grid-cols-3 gap-3">
                                {PHOTO_SLOTS.map((slot) => (
                                    <PhotoSlot
                                        key={slot}
                                        slot={slot}
                                        state={slots[slot]}
                                        disabled={saving}
                                        onPick={(file) => void pickPhoto(slot, file)}
                                        onRemove={() => removePhoto(slot)}
                                    />
                                ))}
                            </div>
                        </fieldset>

                        <Field label="Observações" htmlFor="assessment-notes">
                            <textarea
                                id="assessment-notes"
                                rows={3}
                                value={notes}
                                maxLength={2000}
                                onChange={(event) => setNotes(event.target.value)}
                                placeholder="Ex.: protocolo de 7 dobras; aluno relatou dor no joelho direito"
                                className={textareaClass}
                            />
                        </Field>
                        <FormError message={formError} />
                    </div>
                    <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
                        <button type="button" onClick={cancel} className={smallButtonClass} disabled={busy}>
                            Cancelar
                        </button>
                        <button type="submit" className={primarySmallButtonClass} disabled={busy}>
                            {(saving || uploading) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {uploading ? 'Enviando fotos…' : assessment ? 'Salvar alterações' : 'Salvar avaliação'}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
