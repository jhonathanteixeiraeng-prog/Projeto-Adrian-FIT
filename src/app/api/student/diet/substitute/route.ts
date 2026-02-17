import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

function normalizeText(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function toNumber(value: unknown, fallback = 0) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : fallback;
    }

    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value.replace(',', '.').trim();
    if (!normalized) return fallback;

    const direct = Number(normalized);
    if (Number.isFinite(direct)) return direct;

    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) return fallback;

    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number, decimals = 1) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function parsePortionInfo(portion?: string) {
    const raw = String(portion || '100g').replace(',', '.').trim();
    const parenthesisMatch = raw.match(/\((\d+(?:\.\d+)?)\s*(g|ml)\)/i);
    if (parenthesisMatch) {
        return {
            baseAmount: toNumber(parenthesisMatch[1], 1),
            unit: parenthesisMatch[2].toLowerCase(),
            hasNumericBase: true,
        };
    }

    const baseMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (baseMatch) {
        return {
            baseAmount: toNumber(baseMatch[1], 1),
            unit: (baseMatch[2] || 'unidade').trim() || 'unidade',
            hasNumericBase: true,
        };
    }

    return { baseAmount: 1, unit: 'unidade', hasNumericBase: false };
}

function parseQuantityFactor(quantity: unknown, portion?: string) {
    if (typeof quantity === 'number') {
        return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
    }

    if (typeof quantity !== 'string') {
        return 0;
    }

    const input = quantity.replace(',', '.').trim().toLowerCase();
    if (!input) return 0;

    const { baseAmount } = parsePortionInfo(portion);

    const malformedMass = input.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(g|ml)\b/);
    if (malformedMass) {
        const first = toNumber(malformedMass[1], 0);
        const second = toNumber(malformedMass[2], 0);
        const amount = first * second;
        return baseAmount > 0 ? amount / baseAmount : amount;
    }

    const malformedUnit = input.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(unidade|unidades|fatia|fatias|colher|colheres|scoop|copo|copos)\b/);
    if (malformedUnit) {
        const first = toNumber(malformedUnit[1], 0);
        const second = toNumber(malformedUnit[2], 0);
        return first * second;
    }

    const amount = toNumber(input, 0);
    if (amount <= 0) return 0;

    if (input.includes('x')) return amount;

    if (/\b(g|ml)\b/.test(input)) {
        return baseAmount > 0 ? amount / baseAmount : amount;
    }

    if (/\b(unidade|unidades|fatia|fatias|colher|colheres|scoop|copo|copos)\b/.test(input)) {
        return amount;
    }

    if (baseAmount >= 20) {
        return amount / baseAmount;
    }

    return amount;
}

function formatAmount(value: number) {
    if (!Number.isFinite(value)) return '0';
    const rounded = round(value, 1);
    return Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatQuantityFromFactor(factor: number, portion?: string) {
    const parsedPortion = parsePortionInfo(portion);
    const safeFactor = Math.max(factor, 0.1);

    if (!parsedPortion.hasNumericBase) {
        return `${formatAmount(safeFactor)}x ${String(portion || 'porção')}`;
    }

    const total = safeFactor * parsedPortion.baseAmount;
    const unit = parsedPortion.unit.toLowerCase();

    if (/^unidade(s)?$/.test(unit)) {
        const label = Math.abs(total - 1) < 0.001 ? 'unidade' : 'unidades';
        return `${formatAmount(total)} ${label}`;
    }

    if (/^fatia(s)?$/.test(unit)) {
        const label = Math.abs(total - 1) < 0.001 ? 'fatia' : 'fatias';
        return `${formatAmount(total)} ${label}`;
    }

    return `${formatAmount(total)} ${parsedPortion.unit}`;
}

function calculateTotals(perUnit: { calories: number; protein: number; carbs: number; fat: number }, factor: number) {
    return {
        calories: perUnit.calories * factor,
        protein: perUnit.protein * factor,
        carbs: perUnit.carbs * factor,
        fat: perUnit.fat * factor,
    };
}

function relativeDiff(current: number, target: number, floor = 1) {
    const denominator = Math.max(Math.abs(target), floor);
    return Math.abs(current - target) / denominator;
}

function findBestFactor(
    targetTotals: { calories: number; protein: number; carbs: number; fat: number },
    newFoodPerUnit: { calories: number; protein: number; carbs: number; fat: number }
) {
    const candidates = new Set<number>();

    if (newFoodPerUnit.calories > 0) candidates.add(targetTotals.calories / newFoodPerUnit.calories);
    if (newFoodPerUnit.protein > 0) candidates.add(targetTotals.protein / newFoodPerUnit.protein);
    if (newFoodPerUnit.carbs > 0) candidates.add(targetTotals.carbs / newFoodPerUnit.carbs);
    if (newFoodPerUnit.fat > 0) candidates.add(targetTotals.fat / newFoodPerUnit.fat);

    const arr = Array.from(candidates).filter((v) => Number.isFinite(v) && v > 0);
    const avg = arr.length > 0 ? arr.reduce((acc, v) => acc + v, 0) / arr.length : 1;
    arr.push(avg, 1);

    let bestFactor = 1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const factor of arr) {
        const safeFactor = Math.max(0.1, Math.min(factor, 20));
        const totals = calculateTotals(newFoodPerUnit, safeFactor);
        const score =
            (relativeDiff(totals.calories, targetTotals.calories, 50) * 0.45) +
            (relativeDiff(totals.protein, targetTotals.protein, 8) * 0.2) +
            (relativeDiff(totals.carbs, targetTotals.carbs, 8) * 0.2) +
            (relativeDiff(totals.fat, targetTotals.fat, 5) * 0.15);

        if (score < bestScore) {
            bestScore = score;
            bestFactor = safeFactor;
        }
    }

    return round(bestFactor, 2);
}

async function persistExternalFoodIfNeeded(food: any, userId: string) {
    const name = String(food?.name || '').trim();
    if (!name) return;

    const normalized = normalizeText(name);
    const candidates = await prisma.food.findMany({
        where: { name: { contains: name } },
        take: 20,
    });

    const exists = candidates.some((f) => normalizeText(f.name) === normalized);
    if (exists) return;

    try {
        await prisma.food.create({
            data: {
                name,
                portion: String(food?.portion || '100g'),
                calories: toNumber(food?.calories, 0),
                protein: toNumber(food?.protein, 0),
                carbs: toNumber(food?.carbs, 0),
                fat: toNumber(food?.fat, 0),
                isSystem: false,
                createdById: userId,
            },
        });
    } catch (error) {
        console.error('Erro ao salvar alimento externo no banco:', error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { mealId, originalFoodIndex, originalFood, newFood } = body;

        // originalFood and newFood expected to be full objects with name, calories, macros, quantity/portion

        if (!mealId || originalFoodIndex === undefined || !originalFood || !newFood) {
            return NextResponse.json(
                { success: false, error: 'Dados incompletos' },
                { status: 400 }
            );
        }

        const student = await prisma.student.findUnique({
            where: { userId: session.user.id },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Estudante não encontrado' },
                { status: 404 }
            );
        }

        // 2. Fetch current meal to update
        const meal = await prisma.dietMeal.findFirst({
            where: {
                id: mealId,
                dietPlan: {
                    studentId: student.id,
                    active: true,
                },
            },
        });

        if (!meal) {
            return NextResponse.json(
                { success: false, error: 'Refeição não encontrada para este aluno' },
                { status: 404 }
            );
        }

        let foods: any[] = [];
        try {
            foods = typeof meal.foods === 'string' ? JSON.parse(meal.foods) : (meal.foods as any[]);
        } catch (error) {
            console.error('Erro ao ler alimentos da refeição:', error);
            foods = [];
        }

        // Safety check index
        if (originalFoodIndex < 0 || originalFoodIndex >= foods.length) {
            return NextResponse.json(
                { success: false, error: 'Índice do alimento inválido' },
                { status: 400 }
            );
        }

        const currentFood = foods[originalFoodIndex] || {};
        const originalPerUnit = {
            calories: toNumber(currentFood?.calories ?? originalFood?.calories, 0),
            protein: toNumber(currentFood?.protein ?? originalFood?.protein, 0),
            carbs: toNumber(currentFood?.carbs ?? originalFood?.carbs, 0),
            fat: toNumber(currentFood?.fat ?? originalFood?.fat, 0),
        };
        const originalFactor = parseQuantityFactor(
            originalFood?.quantity ?? currentFood?.quantity ?? '',
            originalFood?.portion ?? currentFood?.portion
        ) || 1;

        const targetTotals = {
            calories: toNumber(originalFood?.totalCalories, originalPerUnit.calories * originalFactor),
            protein: toNumber(originalFood?.totalProtein, originalPerUnit.protein * originalFactor),
            carbs: toNumber(originalFood?.totalCarbs, originalPerUnit.carbs * originalFactor),
            fat: toNumber(originalFood?.totalFat, originalPerUnit.fat * originalFactor),
        };

        const newFoodPerUnit = {
            calories: toNumber(newFood?.calories, 0),
            protein: toNumber(newFood?.protein, 0),
            carbs: toNumber(newFood?.carbs, 0),
            fat: toNumber(newFood?.fat, 0),
        };

        if (newFoodPerUnit.calories <= 0) {
            return NextResponse.json(
                { success: false, error: 'Não foi possível calcular a substituição: calorias do novo alimento inválidas.' },
                { status: 400 }
            );
        }

        const bestFactor = findBestFactor(targetTotals, newFoodPerUnit);
        const matchedTotals = calculateTotals(newFoodPerUnit, bestFactor);
        const formattedQuantity = formatQuantityFromFactor(bestFactor, newFood?.portion || '100g');

        if (newFood?.source === 'external') {
            await persistExternalFoodIfNeeded(newFood, session.user.id);
        }

        // 3. Update foods array
        const newFoodItem = {
            name: newFood.name,
            quantity: formattedQuantity,
            portion: String(newFood?.portion || '100g'),
            calories: round(newFoodPerUnit.calories, 2),
            protein: round(newFoodPerUnit.protein, 2),
            carbs: round(newFoodPerUnit.carbs, 2),
            fat: round(newFoodPerUnit.fat, 2),
            source: newFood?.source || 'external',
            isSubstitution: true,
            originalName: originalFood?.name || currentFood?.name || '',
            substitutionMeta: {
                factor: bestFactor,
                targetCalories: round(targetTotals.calories, 1),
                targetProtein: round(targetTotals.protein, 1),
                targetCarbs: round(targetTotals.carbs, 1),
                targetFat: round(targetTotals.fat, 1),
                matchedCalories: round(matchedTotals.calories, 1),
                matchedProtein: round(matchedTotals.protein, 1),
                matchedCarbs: round(matchedTotals.carbs, 1),
                matchedFat: round(matchedTotals.fat, 1),
            },
        };

        foods[originalFoodIndex] = newFoodItem;

        // 4. Save to DB
        await prisma.dietMeal.update({
            where: { id: mealId },
            data: {
                foods: JSON.stringify(foods)
            }
        });

        // 5. Log History (optional, don't break the main flow if this fails)
        try {
            const diff = matchedTotals.calories - targetTotals.calories;
            await prisma.foodSubstitutionHistory.create({
                data: {
                    studentId: student.id,
                    mealId: mealId,
                    originalFood: originalFood?.name || currentFood?.name || 'Alimento original',
                    originalAmount: originalFood?.quantity || originalFood?.portion || currentFood?.quantity || currentFood?.portion || '?',
                    newFood: newFood?.name || 'Alimento substituído',
                    newAmount: formattedQuantity,
                    caloriesDiff: isNaN(diff) ? 0 : diff
                }
            });
            console.log('History logged successfully');
        } catch (historyError) {
            console.error('Error logging substitution history:', historyError);
        }

        return NextResponse.json({
            success: true,
            data: {
                updatedMeal: { ...meal, foods },
                substitution: {
                    quantity: formattedQuantity,
                    factor: bestFactor,
                    targetTotals: {
                        calories: round(targetTotals.calories, 1),
                        protein: round(targetTotals.protein, 1),
                        carbs: round(targetTotals.carbs, 1),
                        fat: round(targetTotals.fat, 1),
                    },
                    matchedTotals: {
                        calories: round(matchedTotals.calories, 1),
                        protein: round(matchedTotals.protein, 1),
                        carbs: round(matchedTotals.carbs, 1),
                        fat: round(matchedTotals.fat, 1),
                    },
                }
            }
        });

    } catch (error: any) {
        console.error('Substitution Error:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao realizar substituição: ' + error.message, stack: error.stack },
            { status: 500 }
        );
    }
}
