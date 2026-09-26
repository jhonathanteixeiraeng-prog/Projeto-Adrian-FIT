/**
 * Quantidade × unidade no editor de dieta.
 *
 * Todo alimento guarda macros por "porção base" (texto em `portion`, ex.: "100g",
 * "1 unidade (50g)", "2 fatias") e `quantity` = multiplicador dessa porção (formato canônico
 * do diet-normalizer, lido pelo app do aluno e pelo iOS). O editor deixa o personal digitar em
 * g/ml (quando a porção tem massa) ou na medida caseira da porção, e converte para o multiplicador.
 */

export type UnitKey = 'g' | 'ml' | 'un' | 'x';

export interface PortionInfo {
    /** Massa/volume de uma porção base, quando conhecida ("100g", "(50g)"). */
    mass: { amount: number; unit: 'g' | 'ml' } | null;
    /** Medida caseira de uma porção base ("2 fatias" → 2 × fatia). */
    household: { count: number; label: string } | null;
}

export interface UnitOption {
    key: UnitKey;
    label: string;
    /** Quanto dessa unidade existe em uma porção base. */
    perPortion: number;
}

const PLURALS: Record<string, string> = {
    colheres: 'colher',
    unidades: 'unidade',
    fatias: 'fatia',
    conchas: 'concha',
    xicaras: 'xícara',
    'xícaras': 'xícara',
    copos: 'copo',
    potes: 'pote',
    pedacos: 'pedaço',
    'pedaços': 'pedaço',
    files: 'filé',
    'filés': 'filé',
    bifes: 'bife',
    postas: 'posta',
    latas: 'lata',
    buques: 'buquê',
    'buquês': 'buquê',
    espigas: 'espiga',
    ovos: 'ovo',
    scoops: 'scoop',
    porcoes: 'porção',
    'porções': 'porção',
    punhados: 'punhado',
    pegadores: 'pegador',
    pratos: 'prato',
    gomos: 'gomo',
};

function singularize(label: string) {
    const [first, ...rest] = label.split(/\s+/);
    return [PLURALS[first] ?? first, ...rest].join(' ');
}

const portionCache = new Map<string, PortionInfo>();

/** Mesmas regras de leitura de porção do diet-normalizer (massa entre parênteses no fim, ou "100g"). */
export function describePortion(portion: string | null | undefined): PortionInfo {
    const raw = String(portion ?? '').trim();
    const cached = portionCache.get(raw);
    if (cached) return cached;

    const text = raw.replace(/,/g, '.').toLowerCase();
    let info: PortionInfo;

    const massOnly = text.match(/^(\d+(?:\.\d+)?)\s*(g|gramas?|ml)$/);
    if (!text) {
        info = { mass: { amount: 100, unit: 'g' }, household: null };
    } else if (massOnly && parseFloat(massOnly[1]) > 0) {
        info = { mass: { amount: parseFloat(massOnly[1]), unit: massOnly[2] === 'ml' ? 'ml' : 'g' }, household: null };
    } else {
        const paren = text.match(/\((\d+(?:\.\d+)?)\s*(g|ml)\)$/);
        const massAmount = paren ? parseFloat(paren[1]) : 0;
        const mass = paren && massAmount > 0 ? { amount: massAmount, unit: paren[2] as 'g' | 'ml' } : null;
        const householdText = (paren ? text.slice(0, paren.index) : text).trim();
        const lead = householdText.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
        let household: PortionInfo['household'] = null;
        if (lead) {
            const count = parseFloat(lead[1]);
            const label = lead[2].trim();
            if (count > 0) household = { count, label: label ? singularize(label) : 'porção' };
        } else if (householdText) {
            household = { count: 1, label: householdText };
        }
        info = { mass, household };
    }

    portionCache.set(raw, info);
    return info;
}

export function unitOptions(info: PortionInfo): UnitOption[] {
    const options: UnitOption[] = [];
    if (info.mass) options.push({ key: info.mass.unit, label: info.mass.unit, perPortion: info.mass.amount });
    if (info.household) options.push({ key: 'un', label: info.household.label, perPortion: info.household.count });
    if (options.length === 0) options.push({ key: 'x', label: 'porção', perPortion: 1 });
    return options;
}

/** Unidade salva quando ainda válida; senão a medida caseira (como o aluno vê) ou a massa. */
export function resolveUnit(info: PortionInfo, preferred?: string | null): UnitOption {
    const options = unitOptions(info);
    return (
        options.find((option) => option.key === preferred) ??
        options.find((option) => option.key === 'un') ??
        options[0]
    );
}

export function amountToQuantity(amount: number, option: UnitOption) {
    return option.perPortion > 0 ? amount / option.perPortion : amount;
}

export function quantityToAmount(quantity: number, option: UnitOption) {
    return quantity * option.perPortion;
}

/** Aceita "150", "1,5" e "1.5", além de milhares ("2.000", "1.500"). Vazio ou inválido → NaN. */
export function parseAmount(text: string): number {
    let cleaned = text.trim();
    if (!cleaned) return NaN;
    // Thousands only when the first group doesn't start with 0 ("0.250" is 0,25, not 250).
    if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
        cleaned = cleaned.replace(',', '.');
    }
    if (!/^(\d+\.?\d*|\.\d+)$/.test(cleaned)) return NaN;
    return Number(cleaned);
}

export function formatAmount(value: number, unit: UnitKey): string {
    if (!Number.isFinite(value)) return '';
    const decimals = unit === 'g' || unit === 'ml' ? (value >= 10 ? 0 : 1) : 2;
    return String(Number(value.toFixed(decimals))).replace('.', ',');
}

const SINGULAR_TO_PLURAL: Record<string, string> = {
    ...Object.fromEntries(Object.entries(PLURALS).map(([plural, singular]) => [singular, plural])),
    'pão': 'pães',
    'grão': 'grãos',
};

const PREPOSITIONS = new Set(['de', 'do', 'da', 'dos', 'das', 'com', 'sem', 'em', 'para']);

function pluralWord(word: string): string {
    const known = SINGULAR_TO_PLURAL[word.toLowerCase()];
    if (known) return known;
    if (/ão$/.test(word)) return word.replace(/ão$/, 'ões');
    if (/ês$/.test(word)) return word.replace(/ês$/, 'eses');
    if (/[aeo]l$/.test(word)) return word.replace(/l$/, 'is');
    if (/[rz]$/.test(word)) return `${word}es`;
    if (/[aeiouáéêóô]$/.test(word)) return `${word}s`;
    return word;
}

/**
 * Household measure in the plural: the noun and an adjective right after it change
 * ("unidade média" → "unidades médias", "pão francês" → "pães franceses"), a complement
 * doesn't ("colher de sopa" → "colheres de sopa").
 */
function pluralizeLabel(label: string): string {
    const [first, second, ...rest] = label.split(/\s+/);
    const words = [pluralWord(first)];
    if (second !== undefined) words.push(PREPOSITIONS.has(second.toLowerCase()) || second.startsWith('(') ? second : pluralWord(second));
    return [...words, ...rest].join(' ');
}

/**
 * Amount as the student reads it, in the unit the trainer typed: "150 g", "200 ml",
 * "2 fatias (50 g)", "1 unidade", "1,5 porções". Falls back to the base portion text.
 */
export function describeFoodAmount(food: { portion?: string | null; quantity: number; displayUnit?: string | null }): string {
    const info = describePortion(food.portion);
    const option = resolveUnit(info, food.displayUnit);
    const amount = quantityToAmount(food.quantity, option);
    if (!Number.isFinite(amount) || amount <= 0) return (food.portion ?? '').trim();

    if (option.key === 'g' || option.key === 'ml') return `${formatAmount(amount, option.key)} ${option.key}`;
    const count = formatAmount(amount, option.key);
    if (option.key === 'x') return `${count} ${amount > 1 ? 'porções' : 'porção'}`;

    const text = `${count} ${amount > 1 ? pluralizeLabel(option.label) : option.label}`;
    if (!info.mass) return text;
    const mass = food.quantity * info.mass.amount;
    return `${text} (${formatAmount(mass, info.mass.unit)} ${info.mass.unit})`;
}

const integerFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const oneDecimalFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function formatKcal(value: number) {
    return integerFormat.format(Math.round(Number.isFinite(value) ? value : 0));
}

/** Gramas de macro: uma casa decimal abaixo de 10 g, inteiro acima. */
export function formatGrams(value: number) {
    const safe = Number.isFinite(value) ? value : 0;
    return safe < 10 ? oneDecimalFormat.format(safe) : integerFormat.format(Math.round(safe));
}

export function formatInteger(value: number) {
    return integerFormat.format(Math.round(value));
}
