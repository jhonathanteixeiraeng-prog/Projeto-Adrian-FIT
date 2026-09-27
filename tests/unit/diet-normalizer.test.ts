import { describe, expect, it } from 'vitest';
import {
    normalizeDietFood,
    normalizeDietMeal,
    normalizeDietPlan,
    withUnambiguousQuantity,
} from '@/lib/diet-normalizer';

describe('diet normalizer: normalizeDietFood', () => {
    it('provides safe defaults for empty, null, or undefined raw food objects', () => {
        const food = normalizeDietFood(null);
        expect(food.name).toBe('Alimento');
        expect(food.portion).toBe('100g');
        expect(food.quantity).toBe(1);
        expect(food.calories).toBe(0);
        expect(food.totalCalories).toBe(0);
    });

    it('estimates calories from protein, carbs, and fat when calories are 0', () => {
        const food = normalizeDietFood({
            name: 'Mix de macros',
            portion: '1 porção',
            quantity: 1,
            calories: 0,
            protein: 20, // 20 * 4 = 80
            carbs: 30,   // 30 * 4 = 120
            fat: 10,     // 10 * 9 = 90 -> total = 290
        });
        expect(food.calories).toBe(290);
        expect(food.totalCalories).toBe(290);
    });

    it('handles mass units: g, grama, gramas, ml, and mg', () => {
        // Grams with plural "gramas"
        const foodGramas = normalizeDietFood({
            name: 'Arroz',
            portion: '100g',
            quantity: '150 gramas',
            calories: 130,
            protein: 2.5,
            carbs: 28,
            fat: 0.3,
        });
        expect(foodGramas.quantity).toBe(1.5);
        expect(foodGramas.totalCalories).toBe(195);

        // Gram with singular "grama"
        const foodGrama = normalizeDietFood({
            name: 'Arroz',
            portion: '100g',
            quantity: '150 grama',
            calories: 130,
        });
        expect(foodGrama.quantity).toBe(1.5);

        // Milliliters (ml)
        const foodMl = normalizeDietFood({
            name: 'Leite',
            portion: '100ml',
            quantity: '200ml',
            calories: 60,
        });
        expect(foodMl.quantity).toBe(2);
        expect(foodMl.totalCalories).toBe(120);

        // Milligrams (mg)
        const foodMg = normalizeDietFood({
            name: 'Vitamina',
            portion: '100mg',
            quantity: '200mg',
            calories: 10,
        });
        expect(foodMg.quantity).toBe(2);
        expect(foodMg.totalCalories).toBe(20);
    });

    it('handles comma decimals in quantity string', () => {
        const food = normalizeDietFood({
            name: 'Banana',
            portion: '1 unidade',
            quantity: '1,5 unidades',
            calories: 90,
        });
        expect(food.quantity).toBe(1.5);
        expect(food.totalCalories).toBe(135);
    });

    it('infers grams when quantity is a number or string >= 10 on a 100g mass portion', () => {
        const fromString = normalizeDietFood({
            name: 'Frango',
            portion: '100g',
            quantity: '150',
            calories: 165,
        });
        expect(fromString.quantity).toBe(1.5);
        expect(fromString.totalCalories).toBe(247.5);

        const fromNumber = normalizeDietFood({
            name: 'Frango',
            portion: '100g',
            quantity: 150,
            calories: 165,
        });
        expect(fromNumber.quantity).toBe(1.5);
        expect(fromNumber.totalCalories).toBe(247.5);
    });

    it('treats small numbers (< 10) as direct multiplier on 100g portion', () => {
        const food = normalizeDietFood({
            name: 'Frango',
            portion: '100g',
            quantity: 2,
            calories: 165,
        });
        expect(food.quantity).toBe(2);
        expect(food.totalCalories).toBe(330);
    });

    it('safeguards against total macros dropping to 0 when base nutrition exists', () => {
        const food = normalizeDietFood({
            name: 'Whey',
            portion: '1 scoop (30g)',
            quantity: 0, // Invalid/zero quantity
            calories: 120,
            protein: 24,
            carbs: 2,
            fat: 1,
        });
        // parseQuantity defaults invalid/0 to 1
        expect(food.quantity).toBe(1);
        expect(food.totalCalories).toBe(120);
    });

    // Was the round 7 SUSPEITO: "2.000g" read as 2 g (0.02 portions). Brazilian thousands now read like the
    // diet editor's parseAmount.
    it('parses Brazilian dot-thousands notation "2.000g" as 2000g (20 portions of 100g)', () => {
        const food = normalizeDietFood({
            name: 'Arroz cozido',
            portion: '100g',
            quantity: '2.000g',
            calories: 130,
        });
        expect(food.quantity).toBe(20);
        expect(food.totalCalories).toBe(2600);
    });

    it('reads Brazilian thousands in quantities and portions, and keeps decimals that are not thousands', () => {
        expect(normalizeDietFood({ name: 'Água', portion: '100ml', quantity: '2.000 ml', calories: 0 }).quantity).toBe(20);
        expect(normalizeDietFood({ name: 'Arroz', portion: '100g', quantity: '1.500,5g', calories: 100 }).quantity).toBeCloseTo(15.005);

        const juice = normalizeDietFood({ name: 'Suco', portion: '1.000ml', quantity: '500 ml', calories: 400 });
        expect(juice.quantity).toBe(0.5);
        expect(juice.totalCalories).toBe(200);

        // A dot not followed by exactly three digits, or a first group starting with 0, is a decimal.
        expect(normalizeDietFood({ name: 'Arroz', portion: '100g', quantity: '150.5g', calories: 100 }).quantity).toBeCloseTo(1.505);
        expect(normalizeDietFood({ name: 'Arroz', portion: '100g', quantity: '0.250g', calories: 100 }).quantity).toBeCloseTo(0.0025);
    });
});

describe('diet normalizer: withUnambiguousQuantity', () => {
    it('leaves foods with quantity <= 20 unchanged', () => {
        const food = {
            portion: '100g',
            quantity: 2,
            calories: 130,
            protein: 2.5,
            carbs: 28,
            fat: 0.3,
        };
        expect(withUnambiguousQuantity(food)).toEqual(food);
    });

    it('rewrites legacy mass quantities (> 20) to unambiguous 100g base', () => {
        const legacyFood = {
            portion: '1g',
            quantity: 150,
            calories: 1.3,
            protein: 0.025,
            carbs: 0.28,
            fat: 0.003,
        };
        const rewritten = withUnambiguousQuantity(legacyFood);
        expect(rewritten.portion).toBe('100g');
        expect(rewritten.quantity).toBe(1.5);
        expect(rewritten.calories).toBe(130);
    });

    it('rewrites large quantities (> 2000) to 1000mg / 1000g base', () => {
        const largeSupplement = {
            portion: '1mg',
            quantity: 5000,
            calories: 0.001,
            protein: 0,
            carbs: 0,
            fat: 0,
        };
        const rewritten = withUnambiguousQuantity(largeSupplement);
        expect(rewritten.portion).toBe('1000mg');
        expect(rewritten.quantity).toBe(5);
        expect(rewritten.calories).toBe(1);
    });

    it('ignores non-mass portions even if quantity > 20', () => {
        const householdFood = {
            portion: '1 fatia',
            quantity: 25,
            calories: 70,
            protein: 2,
            carbs: 14,
            fat: 1,
        };
        expect(withUnambiguousQuantity(householdFood)).toEqual(householdFood);
    });
});

describe('diet normalizer: normalizeDietMeal and normalizeDietPlan', () => {
    it('normalizes all foods inside a meal (array or JSON string)', () => {
        const mealWithArray = {
            name: 'Almoço',
            foods: [
                { name: 'Arroz', portion: '100g', quantity: '150g', calories: 130 },
            ],
        };
        const normalizedMeal = normalizeDietMeal(mealWithArray);
        expect(normalizedMeal.foods[0].quantity).toBe(1.5);

        const mealWithJson = {
            name: 'Almoço',
            foods: JSON.stringify([
                { name: 'Feijão', portion: '100g', quantity: '100g', calories: 90 },
            ]),
        };
        const normalizedJsonMeal = normalizeDietMeal(mealWithJson);
        expect(normalizedJsonMeal.foods[0].name).toBe('Feijão');
        expect(normalizedJsonMeal.foods[0].quantity).toBe(1);
    });

    it('normalizes meals across a diet plan', () => {
        const plan = {
            title: 'Plano Hipertrofia',
            meals: [
                {
                    name: 'Café',
                    foods: [{ name: 'Ovo', portion: '1 unidade', quantity: 2, calories: 75 }],
                },
            ],
        };
        const normalizedPlan = normalizeDietPlan(plan);
        expect(normalizedPlan.meals[0].foods[0].quantity).toBe(2);
        expect(normalizedPlan.meals[0].foods[0].totalCalories).toBe(150);
    });

    it('handles null plan gracefully', () => {
        expect(normalizeDietPlan(null)).toBeNull();
    });
});
