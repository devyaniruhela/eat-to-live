// Validation helpers for user-created custom foods.
// Returns errors (block save) and warnings (show but allow save).
// Kept separate from storage so it can be tested and updated independently.

import { CustomFood, NutritionPer100g } from './types';

export interface ValidationResult {
  errors: string[];    // must be fixed before saving
  warnings: string[];  // shown as cautions but don't block save
}

/**
 * Validates a custom food name and partial nutrition values before saving.
 * @param name       The user-entered food name
 * @param nutrition  Partial nutrition values from the review form
 * @param existing   Already-saved custom foods — used for duplicate detection
 */
export function validateCustomFood(
  name: string,
  nutrition: Partial<NutritionPer100g>,
  existing: CustomFood[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- Name checks ---

  if (name.trim().length < 3) {
    errors.push('Name must be at least 3 characters.');
  }

  // Fuzzy duplicate check: exact case-insensitive match against saved names
  const normalized = name.trim().toLowerCase();
  const dupe = existing.find((f) => f.name.toLowerCase() === normalized);
  if (dupe) {
    warnings.push(`You already have "${dupe.name}" saved as a custom food.`);
  }

  // --- Nutrition checks (only run when values are provided) ---

  const { calories, protein, fat, carbs, fiber } = nutrition;

  // No negative values
  const provided = Object.values(nutrition).filter((v): v is number => v !== undefined);
  if (provided.some((v) => v < 0)) {
    errors.push('Nutrition values cannot be negative.');
  }

  // Per-100g sanity: the sum of protein + fat + carbs cannot exceed 100g
  // (water, ash, and other components make up the difference)
  if (protein !== undefined && fat !== undefined && carbs !== undefined) {
    const macroSum = protein + fat + carbs;
    if (macroSum > 100) {
      warnings.push(
        `Protein + fat + carbs add up to ${macroSum.toFixed(1)}g, which exceeds 100g. Check the label.`
      );
    }
  }

  // Calorie cross-check: estimated kcal from macros should be within 25% of stated calories.
  // Formula: protein × 4 + fat × 9 + carbs × 4 (Atwater factors).
  // Only runs when all four values are present.
  if (
    calories !== undefined &&
    protein !== undefined &&
    fat !== undefined &&
    carbs !== undefined
  ) {
    const estimated = protein * 4 + fat * 9 + carbs * 4;
    const diff = Math.abs(estimated - calories);
    const pct = calories > 0 ? diff / calories : 0;
    if (pct > 0.25 && diff > 20) {
      warnings.push(
        `Macros add up to ~${Math.round(estimated)} kcal but you entered ${calories} kcal. Double-check the label.`
      );
    }
  }

  // Unusually high calorie density (butter ~720 kcal, oils ~900 kcal — anything above is suspect)
  if (calories !== undefined && calories > 900) {
    warnings.push(`${calories} kcal per 100g is unusually high — verify this is correct.`);
  }

  // Fiber cannot exceed total carbs (fiber is a subset of carbohydrates)
  if (fiber !== undefined && carbs !== undefined && fiber > carbs) {
    warnings.push(`Fiber (${fiber}g) is higher than total carbs (${carbs}g). Check the label.`);
  }

  return { errors, warnings };
}
