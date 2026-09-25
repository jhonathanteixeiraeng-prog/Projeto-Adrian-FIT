'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Columns2, ImageOff } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { cn } from '@/lib/utils';
import { PHOTO_ANGLE_LABELS, formatDate, formatDelta, formatNumber } from './lib';
import type { Checkin, ProgressPhoto } from './types';
import { Field, selectClass, smallButtonClass } from './ui';

type MeasureKey =
    | 'waist'
    | 'abdomen'
    | 'hips'
    | 'chest'
    | 'armRight'
    | 'armLeft'
    | 'thighRight'
    | 'thighLeft'
    | 'calfRight'
    | 'calfLeft'
    | 'bodyFatPercentage';

export const MEASURES: Array<{ key: MeasureKey; label: string; short: string; unit: string }> = [
    { key: 'waist', label: 'Cintura', short: 'Cintura', unit: ' cm' },
    { key: 'abdomen', label: 'Abdômen', short: 'Abdômen', unit: ' cm' },
    { key: 'hips', label: 'Quadril', short: 'Quadril', unit: ' cm' },
    { key: 'chest', label: 'Tórax / peitoral', short: 'Tórax', unit: ' cm' },
    { key: 'armRight', label: 'Braço direito', short: 'Braço D', unit: ' cm' },
    { key: 'armLeft', label: 'Braço esquerdo', short: 'Braço E', unit: ' cm' },
    { key: 'thighRight', label: 'Coxa direita', short: 'Coxa D', unit: ' cm' },
    { key: 'thighLeft', label: 'Coxa esquerda', short: 'Coxa E', unit: ' cm' },
    { key: 'calfRight', label: 'Panturrilha direita', short: 'Pant. D', unit: ' cm' },
    { key: 'calfLeft', label: 'Panturrilha esquerda', short: 'Pant. E', unit: ' cm' },
    { key: 'bodyFatPercentage', label: '% de gordura', short: '% BF', unit: '%' },
];

function Delta({ current, previous, unit = '' }: { current: number | null | undefined; previous: number | null | undefined; unit?: string }) {
    const text = formatDelta(current, previous, unit);
    if (!text || text.startsWith('0')) return null;
    return <span className="ml-1 text-xs font-normal text-muted-foreground">{text}</span>;
}

/** Latest measurements with the change since the first check-in. */
export function MeasurementsSummary({ checkins, firstCheckin }: { checkins: Checkin[]; firstCheckin: Checkin | null }) {
    const latest = checkins.find((checkin) => MEASURES.some((measure) => checkin[measure.key] != null));
    if (!latest) return null;
    const baseline = [...checkins].reverse().find((checkin) => MEASURES.some((measure) => checkin[measure.key] != null));
    const reference = firstCheckin && MEASURES.some((measure) => firstCheckin[measure.key] != null) ? firstCheckin : baseline;
    const items = MEASURES.filter((measure) => latest[measure.key] != null);

    return (
        <div>
            <p className="mb-2 text-xs text-muted-foreground">
                Medidas de {formatDate(latest.date)}
                {reference && reference.id !== latest.id && ` · variação desde ${formatDate(reference.date)}`}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {items.map((measure) => (
                    <div key={measure.key} className="rounded-xl border border-border bg-muted/40 px-3 py-2">
                        <p className="text-xs text-muted-foreground">{measure.label}</p>
                        <p className="font-bold text-foreground">
                            {formatNumber(latest[measure.key], measure.unit)}
                            {reference && reference.id !== latest.id && (
                                <Delta current={latest[measure.key]} previous={reference[measure.key]} unit={measure.unit.trim() === '%' ? ' p.p.' : ' cm'} />
                            )}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Dense check-in history with the change against the previous check-in. */
export function CheckinsTable({ checkins }: { checkins: Checkin[] }) {
    const columns = MEASURES.filter((measure) => checkins.some((checkin) => checkin[measure.key] != null));
    const hasSleep = checkins.some((checkin) => checkin.sleepHours != null);
    const hasWellbeing = checkins.some((checkin) => checkin.energyLevel != null);

    return (
        <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                    <tr>
                        <th scope="col" className="px-3 py-2 font-semibold">Data</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Peso</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Treino</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Dieta</th>
                        {hasSleep && <th scope="col" className="px-3 py-2 font-semibold">Sono</th>}
                        {hasWellbeing && (
                            <th scope="col" className="px-3 py-2 font-semibold" title="Energia / fome / estresse (1 a 5)">
                                E / F / S
                            </th>
                        )}
                        {columns.map((measure) => (
                            <th key={measure.key} scope="col" className="px-3 py-2 font-semibold" title={measure.label}>
                                {measure.short}
                            </th>
                        ))}
                        <th scope="col" className="px-3 py-2 font-semibold">Observações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                    {checkins.map((checkin, index) => {
                        const previous = checkins[index + 1];
                        const adherenceTone = (value: number) =>
                            value >= 80 ? 'text-emerald-600 dark:text-emerald-400' : value >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
                        return (
                            <tr key={checkin.id} className="align-top hover:bg-muted/30">
                                <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">{formatDate(checkin.date)}</td>
                                <td className="whitespace-nowrap px-3 py-2 font-semibold text-foreground">
                                    {formatNumber(checkin.weight, ' kg')}
                                    <Delta current={checkin.weight} previous={previous?.weight} />
                                </td>
                                <td className={cn('whitespace-nowrap px-3 py-2 font-semibold', adherenceTone(checkin.workoutAdherence))}>
                                    {checkin.workoutAdherence}%
                                </td>
                                <td className={cn('whitespace-nowrap px-3 py-2 font-semibold', adherenceTone(checkin.dietAdherence))}>
                                    {checkin.dietAdherence}%
                                </td>
                                {hasSleep && <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatNumber(checkin.sleepHours, ' h')}</td>}
                                {hasWellbeing && (
                                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                                        {checkin.energyLevel ?? '—'} / {checkin.hungerLevel ?? '—'} / {checkin.stressLevel ?? '—'}
                                    </td>
                                )}
                                {columns.map((measure) => (
                                    <td key={measure.key} className="whitespace-nowrap px-3 py-2 text-foreground">
                                        {formatNumber(checkin[measure.key])}
                                        <Delta current={checkin[measure.key]} previous={previous?.[measure.key]} />
                                    </td>
                                ))}
                                <td className="max-w-[260px] px-3 py-2 text-xs text-muted-foreground">
                                    {checkin.notes ? (
                                        <span className="line-clamp-2" title={checkin.notes}>
                                            {checkin.notes}
                                        </span>
                                    ) : (
                                        '—'
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

const photoLabel = (photo: ProgressPhoto) =>
    `${formatDate(photo.createdAt)} · ${PHOTO_ANGLE_LABELS[photo.angle] ?? photo.angle}${photo.weight ? ` · ${formatNumber(photo.weight, ' kg')}` : ''}`;

function PhotoLightbox({ photos, index, onIndexChange, onClose }: { photos: ProgressPhoto[]; index: number | null; onIndexChange: (index: number) => void; onClose: () => void }) {
    const photo = index !== null ? photos[index] : null;
    const go = (delta: number) => {
        if (index === null) return;
        const next = index + delta;
        if (next >= 0 && next < photos.length) onIndexChange(next);
    };
    return (
        <Dialog open={photo !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="max-w-3xl rounded-2xl border-border bg-card"
                onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft') {
                        event.preventDefault();
                        go(-1);
                    } else if (event.key === 'ArrowRight') {
                        event.preventDefault();
                        go(1);
                    }
                }}
            >
                {photo && (
                    <>
                        <DialogHeader className="text-left">
                            <DialogTitle className="text-base font-bold">{photoLabel(photo)}</DialogTitle>
                            <DialogDescription>
                                Foto {index! + 1} de {photos.length} · use ← → para navegar
                            </DialogDescription>
                        </DialogHeader>
                        <div className="relative flex items-center justify-center rounded-xl bg-black">
                            <img src={photo.url} alt={photoLabel(photo)} className="max-h-[70vh] w-auto object-contain" />
                            <button
                                type="button"
                                onClick={() => go(-1)}
                                disabled={index === 0}
                                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition-opacity hover:bg-black/80 disabled:opacity-30"
                                aria-label="Foto anterior"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => go(1)}
                                disabled={index === photos.length - 1}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition-opacity hover:bg-black/80 disabled:opacity-30"
                                aria-label="Próxima foto"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>
                        {photo.notes && <p className="text-sm text-muted-foreground">{photo.notes}</p>}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function defaultComparison(photos: ProgressPhoto[]): [string, string] {
    if (photos.length < 2) return [photos[0]?.id ?? '', photos[0]?.id ?? ''];
    const angle = photos.some((photo) => photo.angle === 'FRONT') ? 'FRONT' : photos[0].angle;
    const sameAngle = photos.filter((photo) => photo.angle === angle);
    const pool = sameAngle.length >= 2 ? sameAngle : photos;
    // photos arrive newest first
    return [pool[pool.length - 1].id, pool[0].id];
}

function PhotoCompareDialog({ open, onOpenChange, photos }: { open: boolean; onOpenChange: (open: boolean) => void; photos: ProgressPhoto[] }) {
    const [ids, setIds] = useState<[string, string]>(() => defaultComparison(photos));

    // Reset only when opening, so a background refresh doesn't undo the chosen dates.
    useEffect(() => {
        if (open) setIds(defaultComparison(photos));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const pick = (slot: 0 | 1) => (event: React.ChangeEvent<HTMLSelectElement>) =>
        setIds((current) => (slot === 0 ? [event.target.value, current[1]] : [current[0], event.target.value]));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl rounded-2xl border-border bg-card">
                <DialogHeader className="text-left">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <Columns2 className="h-4 w-4 text-[#F88022]" />
                        Comparar fotos
                    </DialogTitle>
                    <DialogDescription>Escolha duas datas para ver lado a lado.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    {([0, 1] as const).map((slot) => {
                        const photo = photos.find((item) => item.id === ids[slot]) ?? null;
                        return (
                            <div key={slot} className="space-y-2">
                                <Field label={slot === 0 ? 'Antes' : 'Depois'} htmlFor={`compare-${slot}`}>
                                    <select id={`compare-${slot}`} value={ids[slot]} onChange={pick(slot)} className={selectClass}>
                                        {photos.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {photoLabel(item)}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-black">
                                    {photo ? (
                                        <img src={photo.url} alt={photoLabel(photo)} className="h-full w-full object-contain" />
                                    ) : (
                                        <ImageOff className="h-8 w-8 text-white/40" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function PhotoGallery({ photos, total }: { photos: ProgressPhoto[]; total: number }) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [comparing, setComparing] = useState(false);
    const [angle, setAngle] = useState('ALL');
    const angles = useMemo(() => Array.from(new Set(photos.map((photo) => photo.angle))), [photos]);
    const visible = angle === 'ALL' ? photos : photos.filter((photo) => photo.angle === angle);

    if (photos.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                <Camera className="mx-auto mb-2 h-8 w-8 opacity-50" />
                O aluno ainda não enviou fotos de evolução.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar fotos por ângulo">
                    {['ALL', ...angles].map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setAngle(value)}
                            aria-pressed={angle === value}
                            className={cn(
                                'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40',
                                angle === value ? 'bg-[#F88022]/15 text-[#F88022]' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            {value === 'ALL' ? 'Todas' : PHOTO_ANGLE_LABELS[value] ?? value}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    {total > photos.length && (
                        <span className="text-xs text-muted-foreground">
                            Últimas {photos.length} de {total}
                        </span>
                    )}
                    <button type="button" onClick={() => setComparing(true)} disabled={photos.length < 2} className={smallButtonClass}>
                        <Columns2 className="h-3.5 w-3.5" />
                        Comparar
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
                {visible.map((photo) => (
                    <button
                        key={photo.id}
                        type="button"
                        onClick={() => setLightboxIndex(photos.indexOf(photo))}
                        className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]"
                        aria-label={`Ampliar foto de ${photoLabel(photo)}`}
                    >
                        <img
                            src={photo.url}
                            alt={photoLabel(photo)}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4 text-left text-xs font-semibold text-white">
                            {formatDate(photo.createdAt)}
                            <span className="block font-normal text-white/80">{PHOTO_ANGLE_LABELS[photo.angle] ?? photo.angle}</span>
                        </span>
                    </button>
                ))}
            </div>
            <PhotoLightbox photos={photos} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} />
            <PhotoCompareDialog open={comparing} onOpenChange={setComparing} photos={photos} />
        </div>
    );
}
