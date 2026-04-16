// The Add Entry flow — a bottom sheet modal with 4 steps:
// 1. Search for a food  2. See nutrition preview  3. Enter quantity  4. Pick a meal tag → Save
// The nutrition preview step includes an expandable micronutrient detail section.

'use client';

import { useState, useEffect, useRef } from 'react';
import { EntryStatus, FoodSearchResult, MealTag } from '@/lib/types';
import { calculateNutrition, MICRONUTRIENT_LABELS } from '@/lib/nutrition';
import { getRecentFoods, toDateString } from '@/lib/storage';

interface AddEntryModalProps {
  onSave: (result: FoodSearchResult, quantity: number, tag: MealTag | null, status: EntryStatus, planOrigin: boolean, targetDate?: string) => void;
  onClose: () => void;
  // When provided, skip the search step and open directly at quantity input
  initialFood?: FoodSearchResult;
  // Plan Mode context — controls title, checkbox visibility, and CTA copy
  planMode?: boolean;
  isFuture?: boolean;
  isPast?: boolean;
  // When true, shows a date picker at the top of the modal (used from Search → "Add to plan")
  showDatePicker?: boolean;
}

// Generates date pill options from today to +14 days for the plan date picker
function getPlanDateOptions(): Array<{ label: string; value: string }> {
  const options: Array<{ label: string; value: string }> = [];
  const today = new Date();
  for (let i = 0; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const value = toDateString(d);
    let label: string;
    if (i === 0) label = 'Today';
    else if (i === 1) label = 'Tomorrow';
    else label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    options.push({ label, value });
  }
  return options;
}

const MEAL_TAGS: MealTag[] = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

export default function AddEntryModal({ onSave, onClose, initialFood, planMode = false, isFuture = false, isPast = false, showDatePicker = false }: AddEntryModalProps) {
  const [query, setQuery] = useState(initialFood?.name ?? '');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [selected, setSelected] = useState<FoodSearchResult | null>(initialFood ?? null);
  const [quantity, setQuantity] = useState('');
  const [tag, setTag] = useState<MealTag | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMicros, setShowMicros] = useState(false);
  // "Mark as eaten" checkbox — only shown in Plan Mode on today (not future dates or date picker flow).
  // Unchecked = save as planned; checked = save as eaten directly.
  const [markAsEaten, setMarkAsEaten] = useState(false);
  // Selected date for the plan date picker — defaults to today, user can pick up to +14 days.
  // Only relevant when showDatePicker=true (opened from Search → "Add to plan").
  const [selectedPlanDate, setSelectedPlanDate] = useState(() => toDateString(new Date()));
  const planDateOptions = showDatePicker ? getPlanDateOptions() : [];

  // Whether this entry will be saved as a planned item.
  // Past dates are ALWAYS eaten regardless of plan mode.
  // Future dates are ALWAYS planned.
  // Today + plan mode ON: planned unless user ticks "Mark as eaten".
  const isPlanEntry = showDatePicker
    ? true
    : isFuture
    ? true
    : planMode && !isPast && !markAsEaten;
  // Loaded once on mount — top 5 foods from the last 3 days
  const [recentFoods] = useState<FoodSearchResult[]>(() =>
    initialFood ? [] : getRecentFoods(5, 3)
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // In-memory cache: stores results for queries already fetched this session.
  // Key = lowercased query string, Value = results array.
  // This makes repeated or similar searches instant without hitting the API again.
  const cache = useRef<Map<string, FoodSearchResult[]>>(new Map());

  // Auto-focus: quantity input when food is pre-selected, otherwise search input
  useEffect(() => {
    if (initialFood) {
      quantityRef.current?.focus();
    } else {
      searchRef.current?.focus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search — wait 350ms after typing stops before calling the API.
  // If the query matches the already-selected food's name, skip searching —
  // this is what happens right after the user picks a result from the dropdown.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Query matches a selected food → user just picked something, not typing a new search
    if (selected && query === selected.name) {
      setResults([]);
      return;
    }

    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchResults(query);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  async function fetchResults(q: string) {
    const key = q.trim().toLowerCase();

    // Return cached results immediately if we've searched this before
    if (cache.current.has(key)) {
      setResults(cache.current.get(key)!);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/food-search?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      cache.current.set(key, data.results); // store for reuse
      setResults(data.results);
    } catch {
      setError('Could not fetch results. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(food: FoodSearchResult) {
    // Order matters: set selected first so the effect's guard condition
    // (selected && query === selected.name) is true when query updates
    setSelected(food);
    setResults([]);
    setQuery(food.name);
    setShowMicros(false); // reset detail panel when a new food is picked
  }

  function handleSave() {
    if (!selected || !quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) return;
    const status: EntryStatus = isPlanEntry ? 'planned' : 'eaten';
    // planOrigin is true only when the entry is saved as planned — records its plan history forever
    const planOrigin = isPlanEntry;
    // targetDate only set from the date picker path; otherwise parent uses its current date
    const targetDate = showDatePicker ? selectedPlanDate : undefined;
    onSave(selected, Number(quantity), tag, status, planOrigin, targetDate);
  }

  // Calculate nutrition preview based on entered quantity
  const preview = selected && quantity && Number(quantity) > 0
    ? calculateNutrition(selected.nutrition, Number(quantity))
    : null;

  const canSave = selected && quantity && Number(quantity) > 0;

  return (
    // Backdrop — tapping outside closes the modal
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Bottom sheet — flex column so the footer can be pinned while content scrolls */}
      <div className="relative w-full max-w-md bg-card rounded-t-3xl shadow-xl max-h-[90vh] flex flex-col z-10">

        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* Handle bar */}
          <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5" />

          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-stone-800">
              {isFuture ? 'Plan a meal' : 'Add an item'}
            </h2>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Date picker — shown only in "Add to plan from Search" path */}
          {showDatePicker && (
            <div className="mb-5">
              <p className="text-xs text-stone-500 font-medium mb-2 uppercase tracking-wider">Plan for</p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {planDateOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedPlanDate(opt.value)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      selectedPlanDate === opt.value
                        ? 'text-white border-transparent'
                        : 'bg-card text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                    style={selectedPlanDate === opt.value ? { backgroundColor: 'var(--color-navy)' } : undefined}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search input */}
          <div className="relative mb-4">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search for a food..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value) setSelected(null);
              }}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
            />
            {loading && (
              <span className="absolute right-3 top-3.5 text-xs text-stone-400">Searching...</span>
            )}
          </div>

          {/* Quick add pills — shown only when search is empty and no food selected yet */}
          {!selected && !query && recentFoods.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wider mb-2">
                Quick add
              </p>
              <div className="flex flex-wrap gap-2">
                {recentFoods.map((food) => (
                  <button
                    key={food.name}
                    onClick={() => handleSelect(food)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border border-stone-200 bg-card text-stone-600 hover:border-stone-300 transition-colors"
                  >
                    <span className="text-stone-400">+</span>
                    {food.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search error */}
          {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}

          {/* Search results dropdown */}
          {results.length > 0 && (
            <div className="border border-stone-200 rounded-xl overflow-hidden mb-4 divide-y divide-stone-100">
              {results.map((food) => (
                <button
                  key={food.fdcId}
                  onClick={() => handleSelect(food)}
                  className="w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors flex items-center justify-between gap-3"
                >
                  <p className="text-sm font-medium text-stone-800">{food.name}</p>
                  <p className="text-xs text-stone-400 shrink-0">{food.nutrition.calories} kcal</p>
                </button>
              ))}
            </div>
          )}

          {/* Quantity input — only shown after selecting a food */}
          {selected && (
            <div className="mb-4">
              <label className="block text-xs text-stone-500 font-medium mb-1.5 uppercase tracking-wider">
                Quantity (grams)
              </label>
              <input
                ref={quantityRef}
                type="number"
                placeholder="e.g. 100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="decimal"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
              />
            </div>
          )}

          {/* Nutrition preview — shown when food + quantity are entered */}
          {preview && (
            <div className="mb-4">
              <div className="bg-stone-50 rounded-xl p-4 grid grid-cols-4 gap-2">
                {[
                  { label: 'Calories', value: preview.calories, unit: 'kcal' },
                  { label: 'Protein',  value: preview.protein,  unit: 'g'    },
                  { label: 'Fat',      value: preview.fat,      unit: 'g'    },
                  { label: 'Fiber',    value: preview.fiber,    unit: 'g'    },
                ].map((m) => (
                  <div key={m.label} className="text-center">
                    <p className="text-xs text-stone-400 mb-0.5">{m.label}</p>
                    <p className="text-sm font-bold text-stone-800">{m.value}</p>
                    <p className="text-xs text-stone-400">{m.unit}</p>
                  </div>
                ))}
              </div>

              {/* Toggle: expand / collapse micronutrient detail */}
              <button
                onClick={() => setShowMicros((v) => !v)}
                className="flex items-center gap-1 mt-2 text-xs text-stone-400 hover:text-stone-600 transition-colors"
              >
                {showMicros ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M2 6.5L5 3.5L8 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Hide details
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    View full nutrition
                  </>
                )}
              </button>

              {/* Expandable micronutrient list — per actual quantity entered */}
              {showMicros && (
                <div className="mt-3 rounded-xl border border-stone-200 overflow-hidden divide-y divide-stone-100">
                  {MICRONUTRIENT_LABELS.map((m) => (
                    <div key={m.key} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-stone-600">{m.label}</span>
                      <span className="text-xs font-semibold text-stone-800">
                        {preview[m.key] ?? 0}
                        <span className="text-stone-400 font-normal ml-1">{m.unit}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Meal tag selector */}
          {selected && (
            <div className="mb-2">
              <p className="text-xs text-stone-500 font-medium mb-2 uppercase tracking-wider">
                Meal
              </p>
              <div className="flex gap-2 flex-wrap">
                {MEAL_TAGS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTag(tag === t ? null : t)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      tag === t
                        ? 'bg-navy text-white border-navy'
                        : 'bg-card text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer — Save / Cancel always visible */}
        <div className="px-6 pt-4 pb-10 border-t border-stone-100">
          {/* "Mark as eaten" checkbox — Plan Mode ON on TODAY only (not past, not future, not date picker) */}
          {planMode && !isFuture && !isPast && !showDatePicker && selected && (
            <label className="flex items-center gap-2.5 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={markAsEaten}
                onChange={(e) => setMarkAsEaten(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
                style={{ accentColor: 'var(--color-navy)' }}
              />
              <span className="text-sm text-stone-600">Mark as eaten</span>
            </label>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 py-3 rounded-xl bg-navy text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {isPlanEntry ? 'Add to meal plan' : 'Add to plate'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
