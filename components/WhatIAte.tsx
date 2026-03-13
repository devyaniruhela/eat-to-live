// Displays all food entries for the day, grouped by meal tag.
// Order is always: Breakfast → Lunch → Snack → Dinner → Untagged

'use client';

import { FoodEntry, MealTag } from '@/lib/types';
import { calculateNutrition } from '@/lib/nutrition';

interface WhatIAteProps {
  entries: FoodEntry[];
  onDelete: (id: string) => void;
  isToday: boolean; // controls empty state copy — "today" vs past day phrasing
}

// Fixed display order for meal groups
const MEAL_ORDER: (MealTag | null)[] = ['Breakfast', 'Lunch', 'Snack', 'Dinner', null];

export default function WhatIAte({ entries, onDelete, isToday }: WhatIAteProps) {
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 text-center">
        <p className="text-stone-400 text-sm">
          {isToday ? 'Nothing logged today.' : 'Nothing logged here.'}
        </p>
        <p className="text-stone-300 text-xs mt-1">Start by adding what you ate.</p>
      </div>
    );
  }

  // Group entries by meal tag, preserving the defined order
  const grouped = MEAL_ORDER.map((tag) => ({
    tag,
    items: entries.filter((e) => e.tag === tag),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 space-y-5">
      <p className="text-xs text-stone-400 uppercase tracking-widest font-medium">
        What I Ate
      </p>

      {grouped.map(({ tag, items }) => (
        <div key={tag ?? 'untagged'}>
          {/* Meal group label */}
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
            {tag ?? 'Other'}
          </p>

          <div className="space-y-2">
            {items.map((entry) => {
              const actual = calculateNutrition(entry.nutrition, entry.quantity_g);
              return (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-3 py-2 border-b border-stone-50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    {/* Food name — truncated if too long */}
                    <p className="text-sm font-medium text-stone-800 truncate capitalize">
                      {entry.ingredientName.toLowerCase()}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {entry.quantity_g}g &middot; {actual.calories} kcal &middot; {actual.protein}g protein
                    </p>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="text-stone-300 hover:text-rose-400 transition-colors text-sm mt-0.5 shrink-0"
                    aria-label={`Remove ${entry.ingredientName}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
