import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
    createDietPlanForStudent,
    defaultPlanDates,
    getStudentDietEditorView,
    normalizeFoodForStorage,
    parseDateInput,
    toPositiveInt,
} from '@/lib/diet-plans';

type NutritionInfo = {
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
};

function parseFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.replace(',', '.').trim();
    if (!normalized) {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFoodName(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

async function resolveNutritionInfo(foodName: string, userId: string): Promise<NutritionInfo | null> {
    const normalizedName = normalizeFoodName(foodName);
    if (!normalizedName) return null;

    // 1) Try local DB first.
    const localCandidates = await prisma.food.findMany({
        where: {
            name: {
                contains: foodName.trim(),
            },
        },
        take: 20,
    });

    const exactLocal =
        localCandidates.find((f) => normalizeFoodName(f.name) === normalizedName) ||
        localCandidates[0];

    if (exactLocal) {
        return {
            name: exactLocal.name,
            portion: exactLocal.portion || '100g',
            calories: Number(exactLocal.calories) || 0,
            protein: Number(exactLocal.protein) || 0,
            carbs: Number(exactLocal.carbs) || 0,
            fat: Number(exactLocal.fat) || 0,
        };
    }

    // 2) Fallback to OpenFoodFacts.
    try {
        const offResponse = await fetch(
            `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(foodName)}&search_simple=1&action=process&json=1&page_size=20`
        );

        if (!offResponse.ok) return null;

        const offData = await offResponse.json();
        if (!offData?.products || !Array.isArray(offData.products)) return null;

        const candidates = offData.products
            .filter((p: any) => p?.product_name && p?.nutriments)
            .map((p: any) => ({
                name: String(p.product_name),
                portion: '100g',
                calories: Number(p.nutriments['energy-kcal_100g'] || 0),
                protein: Number(p.nutriments.proteins_100g || 0),
                carbs: Number(p.nutriments.carbohydrates_100g || 0),
                fat: Number(p.nutriments.fat_100g || 0),
            }))
            .filter((p: NutritionInfo) => p.calories > 0);

        if (candidates.length === 0) return null;

        const exactExternal =
            candidates.find((c: NutritionInfo) => normalizeFoodName(c.name) === normalizedName) ||
            candidates[0];

        // Persist for future use.
        await prisma.food.create({
            data: {
                name: exactExternal.name,
                portion: exactExternal.portion,
                calories: exactExternal.calories,
                protein: exactExternal.protein,
                carbs: exactExternal.carbs,
                fat: exactExternal.fat,
                isSystem: false,
                createdById: userId,
            },
        });

        return exactExternal;
    } catch (error) {
        console.error('Nutrition lookup failed:', error);
        return null;
    }
}

// GET /api/students/[id]/diet-plans - List diet plans for student
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const studentId = params.id;

        // Verify student belongs to this personal
        const student = await prisma.student.findFirst({
            where: {
                id: studentId,
                personalId: session.user.personalId,
            },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        // ?view=editor: dados enxutos para o editor de dieta (perfil nutricional, histórico de planos
        // e, com ?planId= ou ?active=1, o plano completo normalizado). Sem o parâmetro, formato original.
        if (request.nextUrl.searchParams.get('view') === 'editor') {
            return NextResponse.json({
                success: true,
                data: await getStudentDietEditorView(studentId, session.user.personalId, {
                    planId: request.nextUrl.searchParams.get('planId'),
                    active: request.nextUrl.searchParams.get('active') === '1',
                }),
            });
        }

        const dietPlans = await prisma.dietPlan.findMany({
            where: { studentId },
            include: {
                meals: {
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, data: dietPlans });
    } catch (error) {
        console.error('Error fetching diet plans:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar planos alimentares' },
            { status: 500 }
        );
    }
}

// POST /api/students/[id]/diet-plans - Create diet plan for student
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const studentId = params.id;

        // Verify student belongs to this personal
        const student = await prisma.student.findFirst({
            where: {
                id: studentId,
                personalId: session.user.personalId,
            },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { title, calories, protein, carbs, fat, meals } = body;

        if (!title || typeof title !== 'string' || !title.trim()) {
            return NextResponse.json(
                { success: false, error: 'Título é obrigatório' },
                { status: 400 }
            );
        }

        const defaults = defaultPlanDates();
        const startDate = parseDateInput(body.startDate) ?? defaults.startDate;
        const endDate = parseDateInput(body.endDate) ?? defaults.endDate;
        if (endDate < startDate) {
            return NextResponse.json(
                { success: false, error: 'A data de término deve ser posterior à data de início' },
                { status: 400 }
            );
        }

        // Prepare meals - foods is stored as JSON string in schema
        // Enrich each manually entered food with nutrition from local DB or internet.
        const nutritionCache = new Map<string, NutritionInfo | null>();
        const preparedMeals = await Promise.all(
            (meals || []).map(async (meal: any, mealIndex: number) => {
                const validFoods = await Promise.all(
                    (meal.foods || meal.items || [])
                        .filter((food: any) => food.name && food.name.trim() !== '')
                        .map(async (food: any) => {
                            const cacheKey = normalizeFoodName(food.name || '');
                            const providedCalories = parseFiniteNumber(food.calories);
                            const providedProtein = parseFiniteNumber(food.protein);
                            const providedCarbs = parseFiniteNumber(food.carbs);
                            const providedFat = parseFiniteNumber(food.fat);
                            const providedPortion =
                                typeof food.portion === 'string' && food.portion.trim()
                                    ? food.portion.trim()
                                    : null;

                            const hasProvidedNutrition =
                                providedCalories !== null &&
                                providedProtein !== null &&
                                providedCarbs !== null &&
                                providedFat !== null;

                            let nutrition: NutritionInfo | null = null;

                            // Keep explicitly provided nutrition/portion (generated or selected foods).
                            // Resolve from DB/internet only when data is missing.
                            if (!hasProvidedNutrition || !providedPortion) {
                                if (!nutritionCache.has(cacheKey)) {
                                    nutritionCache.set(cacheKey, await resolveNutritionInfo(food.name, session.user.id));
                                }
                                nutrition = nutritionCache.get(cacheKey) ?? null;
                            }

                            const rawFood = {
                                foodId: food.foodId,
                                name: food.name,
                                quantity: food.quantity || '',
                                notes: food.notes || '',
                                substitutionNote: food.substitutionNote || food.substitutionText || '',
                                displayUnit: food.displayUnit,
                                source: food.source,
                                portion: providedPortion ?? nutrition?.portion ?? null,
                                calories: providedCalories ?? nutrition?.calories ?? null,
                                protein: providedProtein ?? nutrition?.protein ?? null,
                                carbs: providedCarbs ?? nutrition?.carbs ?? null,
                                fat: providedFat ?? nutrition?.fat ?? null,
                            };
                            return normalizeFoodForStorage(rawFood);
                        })
                );

                return {
                    name: meal.name || `Refeição ${mealIndex + 1}`,
                    time: meal.time || '12:00',
                    order: mealIndex,
                    notes: meal.notes || '',
                    foods: JSON.stringify(validFoods),
                };
            })
        );

        // Desativa os planos ativos e cria o novo na mesma transação.
        const dietPlan = await createDietPlanForStudent({
            personalId: session.user.personalId,
            studentId,
            title: title.trim(),
            startDate,
            endDate,
            active: body.active !== false,
            notifyStudent: body.notifyStudent === true,
            calories: toPositiveInt(calories),
            protein: toPositiveInt(protein),
            carbs: toPositiveInt(carbs),
            fat: toPositiveInt(fat),
            meals: preparedMeals,
        });

        return NextResponse.json({
            success: true,
            data: dietPlan,
            message: 'Plano alimentar criado com sucesso!',
        });
    } catch (error: any) {
        console.error('Error creating diet plan:', error);

        let errorMessage = 'Erro ao criar plano alimentar';
        if (error.code === 'P2002') {
            errorMessage = 'Já existe um plano alimentar com esses dados';
        }

        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
