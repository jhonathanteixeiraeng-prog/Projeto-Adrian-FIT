import type { GroupInfo } from '@/lib/workout-groups';

/**
 * How supersets (bi-set, tri-set, circuito) look everywhere they are shown — the editor, the student
 * profile, the template preview and the student pages: a bracket in the group's color, "A1"/"A2"
 * pills before the names and a "Bi-set A" chip on the first exercise.
 */
export interface GroupTone {
    /** Bracket (border color). */
    border: string;
    /** Tinted pill: "A1", "A2"… */
    pill: string;
    /** Outlined chip: "Bi-set A" (add `border`). */
    chip: string;
}

// Groups next to each other get different colors (A, B, C…).
const TONES: GroupTone[] = [
    { border: 'border-[#F88022]', pill: 'bg-[#F88022]/15 text-[#F88022]', chip: 'border-[#F88022]/40 text-[#F88022]' },
    {
        border: 'border-sky-500',
        pill: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
        chip: 'border-sky-500/40 text-sky-600 dark:text-sky-400',
    },
    {
        border: 'border-violet-500',
        pill: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
        chip: 'border-violet-500/40 text-violet-600 dark:text-violet-400',
    },
    {
        border: 'border-emerald-500',
        pill: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        chip: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
    },
    {
        border: 'border-rose-500',
        pill: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
        chip: 'border-rose-500/40 text-rose-600 dark:text-rose-400',
    },
];

export function groupTone(group: Pick<GroupInfo, 'letter'>): GroupTone {
    const index = Math.max(0, group.letter.charCodeAt(0) - 65);
    return TONES[index % TONES.length];
}

/** "A1", "B2"… */
export function groupPositionLabel(group: Pick<GroupInfo, 'letter' | 'position'>): string {
    return `${group.letter}${group.position}`;
}

/** "Bi-set A", "Circuito C". */
export function groupChipLabel(group: Pick<GroupInfo, 'label' | 'letter'>): string {
    return `${group.label} ${group.letter}`;
}

/** "No bi-set, o descanso vem depois do último exercício". */
export function groupRestHint(group: Pick<GroupInfo, 'label'>): string {
    return `No ${group.label.toLowerCase()}, o descanso vem depois do último exercício`;
}

/** Consecutive runs to render: the members of a group together, every ungrouped item on its own. */
export function groupRuns(infos: Array<GroupInfo | null>): Array<{ group: GroupInfo | null; indexes: number[] }> {
    const runs: Array<{ group: GroupInfo | null; indexes: number[] }> = [];
    infos.forEach((info, index) => {
        const last = runs[runs.length - 1];
        if (info && !info.isFirst && last?.group?.groupId === info.groupId) last.indexes.push(index);
        else runs.push({ group: info, indexes: [index] });
    });
    return runs;
}
