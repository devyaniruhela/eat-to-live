// The Add Entry flow — a bottom sheet modal with 4 steps:
// 1. Search for a food  2. See nutrition preview  3. Enter quantity  4. Pick a meal tag → Save

'use client';

import { useState, useEffect, useRef } from 'react';
import { FoodSearchResult, MealTag } from '@/lib/types';
import { calculateNutrition } from '@/lib/nutrition';

interface AddEntryModalProps {
  onSave: (result: FoodSearchResult, quantity: number, tag: MealTag | null) => void;
  onClose: () => void;
}

const MEAL_TAGS: MealTag[] = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

export default function AddEntryModal({ onSave, onClose }: AddEntryModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [quantity, setQuantity] = useState('');
  const [tag, setTag] = useState<MealTag | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // In-memory cache: stores results for queries already fetched this session.
  // Key = lowercased query string, Value = results array.
  // This makes repeated or similar searches instant without hitting the API again.
  const cache = useRef<Map<string, FoodSearchResult[]>>(new Map());

  // Auto-focus the search input when modal opens
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

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
  }

  function handleSave() {
    if (!selected || !quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) return;
    onSave(selected, Number(quantity), tag);
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

      {/* Bottom sheet — constrained to max-w-md, same as all other content in the app */}
      <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-xl p-6 pb-10 max-h-[90vh] overflow-y-auto z-10">
        {/* Handle bar */}
        <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-stone-800">Add what you ate</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

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
          <div className="bg-stone-50 rounded-xl p-4 mb-4 grid grid-cols-4 gap-2">
            {[
              { label: 'Calories', value: preview.calories, unit: 'kcal' },
              { label: 'Protein', value: preview.protein, unit: 'g' },
              { label: 'Fat', value: preview.fat, unit: 'g' },
              { label: 'Fiber', value: preview.fiber, unit: 'g' },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-xs text-stone-400 mb-0.5">{m.label}</p>
                <p className="text-sm font-bold text-stone-800">{m.value}</p>
                <p className="text-xs text-stone-400">{m.unit}</p>
              </div>
            ))}
          </div>
        )}

        {/* Meal tag selector */}
        {selected && (
          <div className="mb-6">
            <p className="text-xs text-stone-500 font-medium mb-2 uppercase tracking-wider">
              Meal (optional)
            </p>
            <div className="flex gap-2 flex-wrap">
              {MEAL_TAGS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(tag === t ? null : t)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    tag === t
                      ? 'bg-navy text-white border-navy'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Save / Cancel */}
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
            Add to plate
          </button>
        </div>
      </div>
    </div>
  );
}
