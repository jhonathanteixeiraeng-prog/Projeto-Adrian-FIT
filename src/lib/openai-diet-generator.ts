import { z } from 'zod';

const generatedFoodSchema = z.object({
    name: z.string().trim().min(1).max(120),
    portion: z.string().trim().min(1).max(80),
    quantity: z.number().positive().max(20),
    calories: z.number().positive().max(2000),
    protein: z.number().nonnegative().max(300),
    carbs: z.number().nonnegative().max(500),
    fat: z.number().nonnegative().max(250),
    notes: z.string().trim().max(240),
});

const generatedMealSchema = z.object({
    name: z.string().trim().min(1).max(80),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    foods: z.array(generatedFoodSchema).min(1).max(12),
});

export const generatedDietSchema = z.object({
    title: z.string().trim().min(1).max(120),
    meals: z.array(generatedMealSchema).min(2).max(8),
    warnings: z.array(z.string().trim().min(1).max(300)).max(8),
});

export type GeneratedDiet = z.infer<typeof generatedDietSchema>;

export interface DietGenerationContext {
    student: {
        name: string;
        age: number | null;
        gender: string | null;
        height: number | null;
        weight: number | null;
        goal: string | null;
        activityLevel: string | null;
        restrictions: string | null;
        medications: string | null;
        notes: string | null;
    };
    trainerNotes: string;
    requiredFoods: string;
    mealCount: number;
}

const dietJsonSchema = {
    type: 'object',
    properties: {
        title: {
            type: 'string',
            description: 'Título curto do plano alimentar em português do Brasil.',
        },
        meals: {
            type: 'array',
            description: 'Refeições em ordem cronológica, exatamente na quantidade solicitada.',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    time: {
                        type: 'string',
                        description: 'Horário no formato HH:MM, em 24 horas.',
                    },
                    foods: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                portion: {
                                    type: 'string',
                                    description: 'Porção base mensurável, como 100g, 1 unidade (50g) ou 1 colher (15ml).',
                                },
                                quantity: {
                                    type: 'number',
                                    description: 'Multiplicador positivo da porção base.',
                                },
                                calories: {
                                    type: 'number',
                                    description: 'Quilocalorias da porção base, antes de multiplicar por quantity.',
                                    minimum: 1,
                                    maximum: 2000,
                                },
                                protein: {
                                    type: 'number',
                                    description: 'Proteínas em gramas da porção base.',
                                },
                                carbs: {
                                    type: 'number',
                                    description: 'Carboidratos em gramas da porção base.',
                                },
                                fat: {
                                    type: 'number',
                                    description: 'Gorduras em gramas da porção base.',
                                },
                                notes: {
                                    type: 'string',
                                    description: 'Orientação curta de preparo ou uso; string vazia quando desnecessária.',
                                },
                            },
                            required: ['name', 'portion', 'quantity', 'calories', 'protein', 'carbs', 'fat', 'notes'],
                            additionalProperties: false,
                        },
                    },
                },
                required: ['name', 'time', 'foods'],
                additionalProperties: false,
            },
        },
        warnings: {
            type: 'array',
            description: 'Alertas objetivos para revisão do personal; lista vazia quando não houver conflito ou risco identificável.',
            items: { type: 'string' },
        },
    },
    required: ['title', 'meals', 'warnings'],
    additionalProperties: false,
} as const;

function extractOutputText(response: unknown): string | null {
    if (!response || typeof response !== 'object') return null;
    const output = (response as { output?: unknown }).output;
    if (!Array.isArray(output)) return null;

    for (const item of output) {
        if (!item || typeof item !== 'object') continue;
        const content = (item as { content?: unknown }).content;
        if (!Array.isArray(content)) continue;
        for (const part of content) {
            if (
                part &&
                typeof part === 'object' &&
                (part as { type?: unknown }).type === 'output_text' &&
                typeof (part as { text?: unknown }).text === 'string'
            ) {
                return (part as { text: string }).text;
            }
        }
    }

    return null;
}

export async function generateDietWithOpenAI(context: DietGenerationContext): Promise<GeneratedDiet> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
    }

    const model = process.env.OPENAI_DIET_MODEL || 'gpt-5.4-mini';
    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            store: false,
            reasoning: { effort: 'low' },
            input: [
                {
                    role: 'system',
                    content: [
                        'Você auxilia um personal trainer a criar um rascunho de plano alimentar em português do Brasil.',
                        'O plano sempre será revisado por um profissional antes de ser salvo ou entregue ao aluno.',
                        'Respeite integralmente alergias, restrições, medicamentos, observações e alimentos obrigatórios informados.',
                        'Inclua todos os alimentos obrigatórios pelo menos uma vez, distribuídos de maneira coerente.',
                        'Use medidas práticas e porções base claras. calories, protein, carbs e fat devem corresponder somente à porção base; quantity é o multiplicador dessa porção.',
                        'Use valores nutricionais plausíveis e consistentes entre calorias e macronutrientes.',
                        'Não invente diagnóstico, doença, alergia ou medicamento. Quando houver conflito, ambiguidade ou possível risco, registre em warnings e escolha a opção mais conservadora.',
                        `Gere exatamente ${context.mealCount} refeições, em ordem cronológica.`,
                    ].join(' '),
                },
                {
                    role: 'user',
                    content: JSON.stringify(context),
                },
            ],
            text: {
                format: {
                    type: 'json_schema',
                    name: 'diet_plan',
                    description: 'Rascunho estruturado de plano alimentar para revisão do personal trainer.',
                    strict: true,
                    schema: dietJsonSchema,
                },
            },
        }),
        signal: AbortSignal.timeout(60_000),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const apiMessage = payload && typeof payload === 'object'
            ? (payload as { error?: { message?: string } }).error?.message
            : undefined;
        console.error('OpenAI diet generation failed:', response.status, apiMessage || 'Unknown error');
        throw new Error('OPENAI_REQUEST_FAILED');
    }

    const outputText = extractOutputText(payload);
    if (!outputText) {
        throw new Error('OPENAI_EMPTY_RESPONSE');
    }

    const parsed = generatedDietSchema.parse(JSON.parse(outputText));
    if (parsed.meals.length !== context.mealCount) {
        throw new Error('OPENAI_INVALID_MEAL_COUNT');
    }

    return parsed;
}
