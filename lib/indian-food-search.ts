// Searches the Indian food JSON (primary data source) for a given query.
// This runs before USDA — route.ts only calls USDA if this returns no results.
//
// Matching strategy:
//   1. Check food name (substring match)
//   2. Check all aliases (substring match)
//   3. Check category name — so typing "dal" returns all dal items
// Results are sorted by the same relevance scoring used for USDA results.

import foodData from './indian-foods.json';
import type { FoodSearchResult, NutritionPer100g } from './types';

// Shape of each item in the JSON — mirrors the JSON structure exactly
interface IndianFoodItem {
  id: number;
  name: string;
  aliases: string[];
  category: string;
  per100g: NutritionPer100g;
}

/**
 * Searches the Indian food JSON for a query string.
 * Returns up to 6 results sorted by relevance.
 * Returns an empty array if query is under 2 characters.
 */
export function searchIndianFoods(query: string): FoodSearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const items = (foodData as { items: IndianFoodItem[] }).items;

  return items
    .filter((item) => matchesQuery(item, q))
    .map((item) => ({
      fdcId: item.id, // Indian food JSON IDs are in 1000–9999 range, well below USDA's millions
      name: item.name,
      nutrition: item.per100g,
    }))
    .sort((a, b) => relevanceScore(a.name, q) - relevanceScore(b.name, q))
    .slice(0, 6);
}

/**
 * Returns true if the food item matches the query.
 * Checks name, aliases, and category — in that order.
 */
function matchesQuery(item: IndianFoodItem, q: string): boolean {
  if (item.name.toLowerCase().includes(q)) return true;
  if (item.aliases.some((alias) => alias.toLowerCase().includes(q))) return true;
  // Category match lets "dal" return all dal items, "grain" return all grains, etc.
  if (item.category.toLowerCase() === q) return true;
  return false;
}

/**
 * Scores how relevant a food name is to the search query.
 * Lower = more relevant = sorted higher.
 * 0: name starts with query
 * 1: query is a whole word in name
 * 2: base food name (before first comma) exactly matches query — boosts "Rice, white" over "Rice crackers"
 * 3: query appears anywhere in name
 * 4: matched via alias or category only
 */
function relevanceScore(name: string, query: string): number {
  const n = name.toLowerCase();
  if (n.startsWith(query)) return 0;
  // Escape regex special chars so queries like "v+c" don't throw
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordBoundary = new RegExp(`(^|[\\s,])${escaped}($|[\\s,])`);
  if (wordBoundary.test(n)) return 1;
  const baseName = n.split(',')[0].trim();
  if (baseName === query) return 2;
  if (n.includes(query)) return 3;
  return 4; // matched via alias only
}
