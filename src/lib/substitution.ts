export interface FoodData {
    name: string;
    calories: number; // per 100g
    protein: number;
    carbs: number;
    fat: number;
    portion?: string;
}

export interface SubstitutionResult {
    newQuantity: number; // in grams
    newCalories: number;
    newProtein: number;
    newCarbs: number;
    newFat: number;
    caloriesDiffPercent: number;
}

/**
 * Calculates the quantity of a new food needed to match the caloric content of the original food.
 * 
 * @param originalFood - Data of the food being replaced (per 100g)
 * @param originalQuantityGrams - Quantity of the original food in grams
 * @param newFood - Data of the new food (per 100g)
 * @returns SubstitutionResult with new quantity and nutritional values
 */
export function calculateSubstitution(
    originalFood: FoodData,
    originalQuantityGrams: number,
    newFood: FoodData
): SubstitutionResult {
    // 1. Calculate total calories of the original portion
    const originalTotalCalories = (originalFood.calories * originalQuantityGrams) / 100;

    // 2. Calculate required amount of new food to match calories
    // Formula: (OriginalTotalCalories * 100) / NewFoodCaloriesPer100g
    let newQuantity = 0;

    if (newFood.calories > 0) {
        newQuantity = (originalTotalCalories * 100) / newFood.calories;
    } else {
        // Fallback or edge case: if new food has 0 calories (e.g. water, diet soda), 
        // we can't match calories. Maybe match volume? 
        // For now, let's just keep the same quantity as a baseline or 0 if it's really 0.
        newQuantity = originalQuantityGrams;
    }

    // Round to nearest decent number (e.g. integer)
    newQuantity = Math.round(newQuantity);

    // 3. Calculate new macros based on the new quantity
    const newCalories = (newFood.calories * newQuantity) / 100;
    const newProtein = (newFood.protein * newQuantity) / 100;
    const newCarbs = (newFood.carbs * newQuantity) / 100;
    const newFat = (newFood.fat * newQuantity) / 100;

    // 4. Calculate difference percentage
    const diff = newCalories - originalTotalCalories;
    const caloriesDiffPercent = originalTotalCalories > 0
        ? (diff / originalTotalCalories) * 100
        : 0;

    return {
        newQuantity,
        newCalories,
        newProtein,
        newCarbs,
        newFat,
        caloriesDiffPercent
    };
}

export function parseQuantity(quantityStr: string): number {
    // Simple parser: extracts the first number found
    // e.g. "100g" -> 100, "150ml" -> 150, "1 unidade (50g)" -> 1
    // Ideally we want the weight portion if available

    // Check if it matches patterns like "200g" or "200ml"
    const weightMatch = quantityStr.match(/(\d+)(?:g|ml)/i);
    if (weightMatch) {
        return parseInt(weightMatch[1], 10);
    }

    // Fallback: just get the first number
    const numberMatch = quantityStr.match(/(\d+)/);
    return numberMatch ? parseInt(numberMatch[1], 10) : 100; // Default to 100 if parsing fails
}
