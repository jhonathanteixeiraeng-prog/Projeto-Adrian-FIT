'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, ImageOff, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { LibraryExercise } from '@/components/personal/workout-editor/editor-state';
import {
    DIFFICULTIES,
    DIFFICULTY_LABELS,
    EQUIPMENT_GROUPS,
    EQUIPMENTS,
    MUSCLE_GROUPS,
    getExerciseThumbnail,
    mergeOptions,
} from './exercise-constants';

export const fieldClass =
    'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60';

const OTHER = '__other__';

interface ExerciseFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Edit mode when provided. */
    exercise?: LibraryExercise | null;
    initialName?: string;
    /** "quick" = name, muscle group and equipment only (used inside the workout editor). */
    variant?: 'full' | 'quick';
    /** Values already used in the library, merged with the known lists. */
    knownMuscleGroups?: string[];
    knownEquipments?: string[];
    onSaved: (exercise: LibraryExercise, mode: 'create' | 'update') => void;
}

interface FormState {
    name: string;
    muscleGroup: string;
    equipment: string;
    customEquipment: string;
    difficulty: string;
    videoUrl: string;
    instructions: string;
    tips: string;
}

function initialForm(exercise: LibraryExercise | null | undefined, initialName: string, equipments: string[]): FormState {
    const equipment = exercise?.equipment?.trim() ?? '';
    const isKnown = !equipment || equipments.includes(equipment);
    return {
        name: exercise?.name ?? initialName,
        muscleGroup: exercise?.muscleGroup ?? '',
        equipment: isKnown ? equipment : OTHER,
        customEquipment: isKnown ? '' : equipment,
        difficulty: exercise?.difficulty ?? 'INICIANTE',
        videoUrl: exercise?.videoUrl ?? '',
        instructions: exercise?.instructions ?? '',
        tips: exercise?.tips ?? '',
    };
}

export function ExerciseFormDialog({
    open,
    onOpenChange,
    exercise,
    initialName = '',
    variant = 'full',
    knownMuscleGroups = [],
    knownEquipments = [],
    onSaved,
}: ExerciseFormDialogProps) {
    const isEdit = Boolean(exercise);
    const muscleOptions = useMemo(() => mergeOptions(MUSCLE_GROUPS, knownMuscleGroups), [knownMuscleGroups]);
    const extraEquipments = useMemo(
        () => mergeOptions([], knownEquipments).filter((item) => !EQUIPMENTS.includes(item)),
        [knownEquipments]
    );
    const allEquipments = useMemo(() => [...EQUIPMENTS, ...extraEquipments], [extraEquipments]);

    const [form, setForm] = useState<FormState>(() => initialForm(exercise, initialName, allEquipments));
    const [error, setError] = useState<string | null>(null);
    const [fieldError, setFieldError] = useState<keyof FormState | null>(null);
    const [saving, setSaving] = useState(false);
    const nameRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setForm(initialForm(exercise, initialName, allEquipments));
        setError(null);
        setFieldError(null);
        // Reset only when the dialog opens (or targets another exercise), not on every prop change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, exercise?.id]);

    const update = (patch: Partial<FormState>) => {
        setForm((current) => ({ ...current, ...patch }));
        if (error) setError(null);
        if (fieldError && fieldError in patch) setFieldError(null);
    };

    const thumbnail = getExerciseThumbnail({ videoUrl: form.videoUrl });

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (saving) return;
        const name = form.name.trim();
        if (!name) {
            setError('Informe o nome do exercício.');
            setFieldError('name');
            nameRef.current?.focus();
            return;
        }
        if (!form.muscleGroup) {
            setError('Selecione o grupo muscular.');
            setFieldError('muscleGroup');
            return;
        }
        const equipment = form.equipment === OTHER ? form.customEquipment.trim() : form.equipment;
        const body: Record<string, unknown> = { name, muscleGroup: form.muscleGroup, equipment };
        if (variant === 'full') {
            Object.assign(body, {
                difficulty: form.difficulty,
                videoUrl: form.videoUrl.trim(),
                instructions: form.instructions.trim(),
                tips: form.tips.trim(),
            });
        }

        setSaving(true);
        try {
            const response = await fetch(isEdit ? `/api/exercises/${exercise!.id}` : '/api/exercises', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || result?.success === false) {
                const message = result?.error || 'Não foi possível salvar o exercício.';
                setError(message);
                if (response.status === 409) {
                    setFieldError('name');
                    nameRef.current?.focus();
                } else if (/v[íi]deo/i.test(message)) {
                    setFieldError('videoUrl');
                }
                return;
            }
            onSaved(result as LibraryExercise, isEdit ? 'update' : 'create');
            onOpenChange(false);
        } catch {
            setError('Erro de conexão. Verifique sua internet e tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    const labelClass = 'mb-1.5 block text-sm font-medium text-foreground';

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
            <DialogContent
                className="max-h-[92dvh] max-w-lg overflow-y-auto rounded-2xl border-border bg-card p-0"
                onOpenAutoFocus={(event) => {
                    // Name already typed in the editor search → start at the muscle group.
                    event.preventDefault();
                    const target = initialName.trim() && !isEdit ? document.getElementById('exercise-form-muscle') : nameRef.current;
                    (target as HTMLElement | null)?.focus();
                }}
            >
                <form onSubmit={submit} className="flex flex-col">
                    <DialogHeader className="border-b border-border px-5 py-4 text-left">
                        <DialogTitle className="text-base font-bold">
                            {isEdit ? 'Editar exercício' : variant === 'quick' ? 'Criar exercício rápido' : 'Novo exercício'}
                        </DialogTitle>
                        <DialogDescription>
                            {variant === 'quick'
                                ? 'O exercício entra na sua biblioteca e já é adicionado ao treino.'
                                : 'Os exercícios que você cria ficam na sua biblioteca pessoal.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 px-5 py-4">
                        {isEdit && exercise?.personalId === null && (
                            <p className="flex items-start gap-2 rounded-xl bg-blue-500/10 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                                <Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                Exercício da biblioteca global: as alterações aparecem para todos os personais.
                            </p>
                        )}

                        <div>
                            <label htmlFor="exercise-form-name" className={labelClass}>
                                Nome do exercício <span className="text-primary">*</span>
                            </label>
                            <input
                                id="exercise-form-name"
                                ref={nameRef}
                                value={form.name}
                                onChange={(event) => update({ name: event.target.value })}
                                placeholder="Ex.: Supino reto com halteres"
                                maxLength={120}
                                className={cn(fieldClass, fieldError === 'name' && 'border-red-500 focus:border-red-500 focus:ring-red-500/25')}
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label htmlFor="exercise-form-muscle" className={labelClass}>
                                    Grupo muscular <span className="text-primary">*</span>
                                </label>
                                <select
                                    id="exercise-form-muscle"
                                    value={form.muscleGroup}
                                    onChange={(event) => update({ muscleGroup: event.target.value })}
                                    className={cn(fieldClass, fieldError === 'muscleGroup' && 'border-red-500')}
                                >
                                    <option value="">Selecione</option>
                                    {muscleOptions.map((group) => (
                                        <option key={group} value={group}>
                                            {group}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {variant === 'full' ? (
                                <div>
                                    <label htmlFor="exercise-form-difficulty" className={labelClass}>
                                        Dificuldade
                                    </label>
                                    <select
                                        id="exercise-form-difficulty"
                                        value={form.difficulty}
                                        onChange={(event) => update({ difficulty: event.target.value })}
                                        className={fieldClass}
                                    >
                                        {DIFFICULTIES.map((difficulty) => (
                                            <option key={difficulty} value={difficulty}>
                                                {DIFFICULTY_LABELS[difficulty]}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <EquipmentField form={form} update={update} extra={extraEquipments} labelClass={labelClass} />
                            )}
                        </div>

                        {variant === 'full' && (
                            <>
                                <EquipmentField form={form} update={update} extra={extraEquipments} labelClass={labelClass} />

                                <div>
                                    <label htmlFor="exercise-form-video" className={labelClass}>
                                        Vídeo (YouTube, Vimeo ou link direto)
                                    </label>
                                    <div className="flex gap-3">
                                        <input
                                            id="exercise-form-video"
                                            value={form.videoUrl}
                                            onChange={(event) => update({ videoUrl: event.target.value })}
                                            placeholder="https://www.youtube.com/watch?v=…"
                                            inputMode="url"
                                            className={cn(fieldClass, 'flex-1', fieldError === 'videoUrl' && 'border-red-500')}
                                        />
                                        <div className="flex h-10 w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                                            {thumbnail ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <ImageOff className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="exercise-form-instructions" className={labelClass}>
                                        Instruções de execução
                                    </label>
                                    <textarea
                                        id="exercise-form-instructions"
                                        rows={3}
                                        value={form.instructions}
                                        onChange={(event) => update({ instructions: event.target.value })}
                                        placeholder="Como executar o exercício corretamente…"
                                        className={cn(fieldClass, 'resize-y')}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="exercise-form-tips" className={labelClass}>
                                        Dicas e observações
                                    </label>
                                    <textarea
                                        id="exercise-form-tips"
                                        rows={2}
                                        value={form.tips}
                                        onChange={(event) => update({ tips: event.target.value })}
                                        placeholder="Erros comuns, variações, cuidados…"
                                        className={cn(fieldClass, 'resize-y')}
                                    />
                                </div>
                            </>
                        )}

                        {error && (
                            <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                                {error}
                            </p>
                        )}
                    </div>

                    <DialogFooter className="gap-2 border-t border-border px-5 py-3 sm:space-x-0">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                            className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isEdit ? 'Salvar alterações' : variant === 'quick' ? 'Criar e adicionar' : 'Criar exercício'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EquipmentField({
    form,
    update,
    extra,
    labelClass,
}: {
    form: FormState;
    update: (patch: Partial<FormState>) => void;
    extra: string[];
    labelClass: string;
}) {
    return (
        <div className="space-y-2">
            <div>
                <label htmlFor="exercise-form-equipment" className={labelClass}>
                    Equipamento
                </label>
                <select
                    id="exercise-form-equipment"
                    value={form.equipment}
                    onChange={(event) => update({ equipment: event.target.value, customEquipment: '' })}
                    className={fieldClass}
                >
                    <option value="">Sem equipamento definido</option>
                    {EQUIPMENT_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                            {group.items.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                    {extra.length > 0 && (
                        <optgroup label="Já usados na biblioteca">
                            {extra.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </optgroup>
                    )}
                    <option value={OTHER}>Outro (digitar)…</option>
                </select>
            </div>
            {form.equipment === OTHER && (
                <input
                    aria-label="Nome do equipamento"
                    value={form.customEquipment}
                    onChange={(event) => update({ customEquipment: event.target.value })}
                    placeholder="Ex.: Máquina de glúteos"
                    maxLength={80}
                    className={fieldClass}
                    autoFocus
                />
            )}
        </div>
    );
}
