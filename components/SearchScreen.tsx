// Ingredient lookup screen — search for a food and see its full nutrition breakdown.
// Shows macros (per 100g) in cards, followed by all tracked micronutrients as a list.
// Accessed via the Search button in the bottom action bar.
// Read-only — no logging from this screen. Future: "Add to today" CTA.

'use client';

import { useState, useEffect, useRef } from 'react';
import { FoodSearchResult } from '@/lib/types';
import { MICRONUTRIENT_LABELS } from '@/lib/nutrition';

interface SearchScreenProps {
  onClose: () => void;
}

export default function SearchScreen({ onClose }: SearchScreenProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // In-memory cache: same pattern as AddEntryModal — avoids re-fetching within a session
  const cache = useRef<Map<string, FoodSearchResult[]>>(new Map());

  // Auto-focus search input on open
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Debounced search — 350ms after typing stops, same as AddEntryModal
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // User just selected a result — query matches selected name, don't re-search
    if (selected && query === selected.name) {
      setResults([]);
      return;
    }

    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => fetchResults(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selected]);

  async function fetchResults(q: string) {
    const key = q.trim().toLowerCase();
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
      cache.current.set(key, data.results);
      setResults(data.results);
    } catch {
      setError('Could not fetch results. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(food: FoodSearchResult) {
    setSelected(food);
    setResults([]);
    setQuery(food.name);
  }

  function handleClear() {
    setSelected(null);
    setQuery('');
    setResults([]);
    searchRef.current?.focus();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ backgroundColor: 'var(--color-card)' }}>
      {/* Content constrained to max-w-md — same as the rest of the app */}
      <div className="w-full max-w-md flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-stone-100">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="text-base font-semibold text-stone-800">Search Ingredient</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-5">

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
            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-card text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:border-navy"
            style={{ '--tw-ring-color': 'rgba(26,39,68,0.2)' } as React.CSSProperties}
          />
          {loading && (
            <span className="absolute right-3 top-3.5 text-xs text-stone-400">Searching...</span>
          )}
          {/* Clear button — shown once a food is selected */}
          {selected && !loading && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-3 text-stone-400 hover:text-stone-600 text-lg leading-none"
              aria-label="Clear"
            >
              ×
            </button>
          )}
        </div>

        {error && <p className="text-xs mb-3" style={{ color: 'var(--color-rose)' }}>{error}</p>}

        {/* Search results dropdown */}
        {results.length > 0 && (
          <div className="border border-stone-200 rounded-xl overflow-hidden mb-6 divide-y divide-stone-100 bg-card">
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

        {/* Nutrition breakdown — shown once a food is selected */}
        {selected && (
          <div>
            {/* Food name + per 100g label */}
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-stone-800 capitalize">
                {selected.name.toLowerCase()}
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">Per 100g</p>
            </div>

            {/* Macronutrients */}
            <p className="text-xs text-stone-400 uppercase tracking-widest font-medium mb-3">
              Macronutrients
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <MacroCard label="Calories"      value={selected.nutrition.calories} unit="kcal" highlight />
              <MacroCard label="Protein"       value={selected.nutrition.protein}  unit="g" />
              <MacroCard label="Carbohydrates" value={selected.nutrition.carbs}    unit="g" />
              <MacroCard label="Fat"           value={selected.nutrition.fat}      unit="g" />
              <MacroCard label="Fiber"         value={selected.nutrition.fiber}    unit="g" />
            </div>

            {/* Micronutrients */}
            <p className="text-xs text-stone-400 uppercase tracking-widest font-medium mb-3">
              Micronutrients
            </p>
            <div className="bg-card rounded-2xl border border-stone-200 overflow-hidden divide-y divide-stone-100">
              {MICRONUTRIENT_LABELS.map((m) => (
                <div key={m.key} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-stone-700">{m.label}</span>
                  <span className="text-sm font-semibold text-stone-800">
                    {selected.nutrition[m.key] ?? 0}
                    <span className="text-xs font-normal text-stone-400 ml-1">{m.unit}</span>
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-stone-300 text-center mt-6 pb-4">
              Values from {selected.fdcId < 10000 ? 'IFCT 2017' : 'USDA FoodData Central'}
            </p>
          </div>
        )}

        {/* Empty / initial state */}
        {!selected && results.length === 0 && !loading && query.length < 2 && (
          <p className="text-center text-stone-300 text-sm mt-16">
            Type to search any ingredient
          </p>
        )}

      </div>
      </div>{/* end max-w-md */}
    </div>
  );
}

// Reusable macro display card — matches DailySummary MacroCard exactly
function MacroCard({
  label, value, unit, highlight = false,
}: {
  label: string;
  value: number;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'text-white' : 'bg-stone-50'}`}
      style={highlight ? { backgroundColor: 'var(--color-navy-mid)' } : undefined}
    >
      <p className={`text-xs uppercase tracking-widest font-medium mb-1 ${highlight ? 'text-blue-100' : 'text-stone-400'}`}>
        {label}
      </p>
      <p className={`text-2xl font-bold leading-none ${highlight ? 'text-white' : 'text-stone-800'}`}>
        {value}
        <span className={`text-sm font-normal ml-1 ${highlight ? 'text-blue-100' : 'text-stone-400'}`}>{unit}</span>
      </p>
    </div>
  );
}
