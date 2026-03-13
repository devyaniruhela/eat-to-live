// Nutrition calculation helpers.
// All values are stored per 100g. These functions scale to actual quantity consumed
// and sum across entries. Covers both macros and micronutrients.

import { NutritionPer100g, FoodEntry } from './types';

/**
 * Scales all nutrition values from per-100g to the actual quantity consumed.
 * e.g. 60g of oats → multiply every value by 0.6
 *
 * @param per100g  Nutrition values per 100g (from storage or search result)
 * @param quantity_g  Actual quantity consumed in grams
 */
export function calculateNutrition(
  per100g: NutritionPer100g,
  quantity_g: number
): NutritionPer100g {
  const f = quantity_g / 100; // scale factor
  return {
    // Macros
    calories:     round(per100g.calories     * f),
    protein:      round(per100g.protein      * f),
    fat:          round(per100g.fat          * f),
    carbs:        round(per100g.carbs        * f),
    fiber:        round(per100g.fiber        * f),
    // Micronutrients
    calcium:      round(per100g.calcium      * f),
    iron:         round(per100g.iron         * f),
    magnesium:    round(per100g.magnesium    * f),
    potassium:    round(per100g.potassium    * f),
    zinc:         round(per100g.zinc         * f),
    vitamin_a:    round(per100g.vitamin_a    * f),
    vitamin_b12:  round(per100g.vitamin_b12  * f),
    vitamin_c:    round(per100g.vitamin_c    * f),
    vitamin_d:    round(per100g.vitamin_d    * f),
  };
}

/**
 * Sums nutrition across all food entries for a given day.
 * Used to populate the daily macro and micronutrient summary on the homepage.
 *
 * @param entries  All FoodEntry records for the selected day
 */
export function sumDayNutrition(entries: FoodEntry[]): NutritionPer100g {
  const zero: NutritionPer100g = {
    calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0,
    calcium: 0, iron: 0, magnesium: 0, potassium: 0, zinc: 0,
    vitamin_a: 0, vitamin_b12: 0, vitamin_c: 0, vitamin_d: 0,
  };

  return entries.reduce((totals, entry) => {
    const actual = calculateNutrition(entry.nutrition, entry.quantity_g);
    return {
      calories:     round(totals.calories     + actual.calories),
      protein:      round(totals.protein      + actual.protein),
      fat:          round(totals.fat          + actual.fat),
      carbs:        round(totals.carbs        + actual.carbs),
      fiber:        round(totals.fiber        + actual.fiber),
      calcium:      round(totals.calcium      + actual.calcium),
      iron:         round(totals.iron         + actual.iron),
      magnesium:    round(totals.magnesium    + actual.magnesium),
      potassium:    round(totals.potassium    + actual.potassium),
      zinc:         round(totals.zinc         + actual.zinc),
      vitamin_a:    round(totals.vitamin_a    + actual.vitamin_a),
      vitamin_b12:  round(totals.vitamin_b12  + actual.vitamin_b12),
      vitamin_c:    round(totals.vitamin_c    + actual.vitamin_c),
      vitamin_d:    round(totals.vitamin_d    + actual.vitamin_d),
    };
  }, zero);
}

// Rounds to 1 decimal place to avoid floating point noise (e.g. 1.2000000001)
function round(n: number): number {
  return Math.round(n * 10) / 10;
}
