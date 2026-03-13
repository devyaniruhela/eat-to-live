// Central type definitions for the app.
// All data structures used across components and storage are defined here.
// Single source of truth — never define types inline in components.

export interface NutritionPer100g {
  // Macronutrients
  calories: number;     // kcal
  protein: number;      // g
  fat: number;          // g
  carbs: number;        // g
  fiber: number;        // g

  // Micronutrients — from PRD spec
  calcium: number;      // mg
  iron: number;         // mg
  magnesium: number;    // mg
  potassium: number;    // mg
  zinc: number;         // mg
  vitamin_a: number;    // mcg RAE (retinol activity equivalents)
  vitamin_b12: number;  // mcg
  vitamin_c: number;    // mg
  vitamin_d: number;    // mcg
}

export type MealTag = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export interface FoodEntry {
  id: string;
  date: string;                // ISO date string e.g. "2024-03-12"
  ingredientName: string;
  quantity_g: number;
  tag: MealTag | null;
  nutrition: NutritionPer100g; // always stored per 100g — actuals calculated at display time
}

export interface WaterEntry {
  id: string;
  date: string;
  quantity_ml: number;
}

// Shape returned by both /api/food-search and the Indian food JSON search
export interface FoodSearchResult {
  fdcId: number;      // USDA ID, or a stable numeric hash for Indian food JSON items
  name: string;
  nutrition: NutritionPer100g;
}
