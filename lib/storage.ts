// All localStorage read/write logic lives here.
// Components never touch localStorage directly — they go through these functions.
// This makes it easy to later swap localStorage for a real database in one place.

import { FoodEntry, WaterEntry } from './types';

const ENTRIES_KEY = 'etl_food_entries';
const WATER_KEY = 'etl_water_entries';

// --- Food Entries ---

/** Returns all food entries stored across all dates. */
export function getAllEntries(): FoodEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ENTRIES_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Returns food entries for a specific date (format: "YYYY-MM-DD"). */
export function getEntriesForDate(date: string): FoodEntry[] {
  return getAllEntries().filter((e) => e.date === date);
}

/** Saves a new food entry. Appends to the existing list. */
export function saveEntry(entry: FoodEntry): void {
  const all = getAllEntries();
  all.push(entry);
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(all));
}

/** Deletes a food entry by its ID. */
export function deleteEntry(id: string): void {
  const filtered = getAllEntries().filter((e) => e.id !== id);
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(filtered));
}

/** Updates an existing food entry in place (e.g. quantity change). */
export function updateEntry(entry: FoodEntry): void {
  const all = getAllEntries();
  const idx = all.findIndex((e) => e.id === entry.id);
  if (idx !== -1) {
    all[idx] = entry;
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(all));
  }
}

// --- Water Entries ---

/** Returns all water entries across all dates. */
export function getAllWaterEntries(): WaterEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(WATER_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Returns total water logged (in ml) for a specific date. */
export function getWaterForDate(date: string): number {
  return getAllWaterEntries()
    .filter((e) => e.date === date)
    .reduce((sum, e) => sum + e.quantity_ml, 0);
}

/** Logs a water entry for a given date. */
export function saveWaterEntry(entry: WaterEntry): void {
  const all = getAllWaterEntries();
  all.push(entry);
  localStorage.setItem(WATER_KEY, JSON.stringify(all));
}

/**
 * Replaces all water entries for a date with a single entry of the given total.
 * Used when the user edits the water total directly rather than adding increments.
 */
export function setWaterForDate(date: string, ml: number): void {
  const others = getAllWaterEntries().filter((e) => e.date !== date);
  if (ml > 0) {
    others.push({ id: generateId(), date, quantity_ml: ml });
  }
  localStorage.setItem(WATER_KEY, JSON.stringify(others));
}

// --- Utility ---

/**
 * Formats a Date object to "YYYY-MM-DD" for use as a storage key.
 * Uses LOCAL time components (not UTC) so the date matches what the user
 * sees on screen regardless of timezone. toISOString() would return UTC
 * and cause date drift for users in UTC+ timezones like IST.
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Generates a simple unique ID for entries. */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
