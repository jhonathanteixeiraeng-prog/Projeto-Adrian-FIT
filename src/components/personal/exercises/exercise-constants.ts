import { getEmbedVideoUrl } from '@/lib/video';

export const MUSCLE_GROUPS = ['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Pernas', 'Glúteos', 'Core', 'Panturrilha', 'Antebraço', 'Cardio'];

export const DIFFICULTIES = ['INICIANTE', 'INTERMEDIARIO', 'AVANCADO'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABELS: Record<string, string> = {
    INICIANTE: 'Iniciante',
    INTERMEDIARIO: 'Intermediário',
    AVANCADO: 'Avançado',
};

export const DIFFICULTY_BADGE: Record<string, string> = {
    INICIANTE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    INTERMEDIARIO: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    AVANCADO: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export const EQUIPMENT_GROUPS: { label: string; items: string[] }[] = [
    { label: 'Pesos livres', items: ['Barra Reta', 'Barra W', 'Barra H (Triceps)', 'Halteres', 'Kettlebell', 'Anilhas'] },
    {
        label: 'Máquinas de pernas',
        items: [
            'Leg Press 45°',
            'Leg Press Horizontal',
            'Cadeira Extensora',
            'Mesa Flexora',
            'Cadeira Flexora',
            'Cadeira Adutora',
            'Cadeira Abdutora',
            'Hack Machine',
            'Smith Machine',
            'Panturrilha Sentado',
            'Panturrilha em Pé',
        ],
    },
    {
        label: 'Máquinas superiores',
        items: ['Supino Máquina', 'Chest Press', 'Fly Machine (Peck Deck)', 'Pulldown', 'Remada Máquina', 'Shoulder Press Máquina', 'Crucifixo Máquina'],
    },
    { label: 'Cabos e polias', items: ['Cross Over', 'Polia Alta', 'Polia Baixa', 'Polia Dupla', 'Cabo (Geral)'] },
    {
        label: 'Bancos e acessórios',
        items: [
            'Banco Reto',
            'Banco Inclinado',
            'Banco Declinado',
            'Banco Scott',
            'Banco Romano',
            'GHD (Glute Ham Developer)',
            'Prancha de Abdominais',
            'Rolo de Abdominais',
            'Bola Suíça',
            'Bosu',
            'TRX / Suspensão',
            'Elástico / Resistance Band',
            'Corda de Pular',
        ],
    },
    { label: 'Cardio', items: ['Esteira', 'Bicicleta Ergométrica', 'Elíptico', 'Remo Ergométrico'] },
    { label: 'Corpo livre', items: ['Peso Corporal', 'Barra Fixa', 'Paralelas'] },
];

export const EQUIPMENTS = EQUIPMENT_GROUPS.flatMap((group) => group.items);

export function difficultyLabel(value: string | null | undefined) {
    return (value && DIFFICULTY_LABELS[value]) || value || '—';
}

/** Distinct values found in the data merged with the known list, sorted pt-BR. */
export function mergeOptions(known: string[], values: Array<string | null | undefined>): string[] {
    const set = new Set(known);
    values.forEach((value) => {
        if (value && value.trim()) set.add(value.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Preview image for an exercise: its own thumbnail, else the YouTube still (no iframe needed). */
export function getExerciseThumbnail(exercise: { thumbnailUrl?: string | null; videoUrl?: string | null }): string | null {
    if (exercise.thumbnailUrl) return exercise.thumbnailUrl;
    const embed = getEmbedVideoUrl(exercise.videoUrl);
    if (!embed) return null;
    try {
        const url = new URL(embed);
        if (!url.hostname.endsWith('youtube.com')) return null;
        const id = url.pathname.split('/').filter(Boolean).pop();
        return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
    } catch {
        return null;
    }
}
