// Ingredient lookup screen — search for a food and see its full nutrition breakdown.
// Shows macros (per 100g) in cards, followed by all tracked micronutrients as a list.
// Accessed via the Search button in the bottom action bar.
// "Add to plate" CTA logs the selected food to today's plate without leaving this screen.

'use client';

import { useState, useEffect, useRef } from 'react';
import { EntryStatus, FoodSearchResult, MealTag } from '@/lib/types';
import { MICRONUTRIENT_LABELS } from '@/lib/nutrition';
import AddEntryModal from '@/components/AddEntryModal';
import SuccessToast from '@/components/SuccessToast';

interface SearchScreenProps {
  onClose: () => void;
  onSave: (food: FoodSearchResult, quantity: number, tag: MealTag | null, status: EntryStatus, planOrigin: boolean, targetDate?: string) => void;
  // targetDate is always today — Search has no date context; "Add to plate" always logs to today
  targetDate: string;
  planMode?: boolean;
  // Called when "Add to plan" is tapped and plan mode is currently OFF — auto-enables it
  onEnablePlanMode?: () => void;
}

export default function SearchScreen({ onClose, onSave, targetDate, planMode = false, onEnablePlanMode }: SearchScreenProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // null = no modal open; 'plate' = Add to plate flow; 'plan' = Add to plan flow (with date picker)
  const [modalMode, setModalMode] = useState<'plate' | 'plan' | null>(null);
  // Holds the item name shown in the success toast; null = toast hidden
  const [successItem, setSuccessItem] = useState<string | null>(null);
  // Date the last save actually went to — drives the toast message
  const [saveTargetDate, setSaveTargetDate] = useState(targetDate);

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // In-memory cache: same pattern as AddEntryModal — avoids re-fetching within a session
  const cache = useRef<Map<string, FoodSearchResult[]>>(new Map());

  // Auto-focus search input on open
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Clean up success timer on unmount
  useEffect(() => {
    return () => { if (successTimer.current) clearTimeout(successTimer.current); };
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

  // Called when the user confirms quantity + tag in the AddEntryModal.
  // Forwards all params to the parent save handler and resets search state.
  function handleModalSave(food: FoodSearchResult, quantity: number, tag: MealTag | null, status: EntryStatus, planOrigin: boolean, savedToDate?: string) {
    onSave(food, quantity, tag, status, planOrigin, savedToDate);
    setModalMode(null);
    setSelected(null);
    setQuery('');
    setResults([]);
    setSaveTargetDate(savedToDate ?? targetDate);
    setSuccessItem(food.name);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessItem(null), 2500);
  }

  function handleAddToPlate() {
    setModalMode('plate');
  }

  function handleAddToPlan() {
    if (!planMode) onEnablePlanMode?.();
    setModalMode('plan');
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
            {/* Food name + per 100g label + CTAs */}
            <div className="mb-5">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-stone-800 capitalize">
                  {selected.name.toLowerCase()}
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">Per 100g</p>
              </div>
              <div className="flex gap-2">
                {/* Add to plate — always saves to today */}
                <button
                  onClick={handleAddToPlate}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border shrink-0 transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-navy)', borderColor: 'var(--color-navy)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  Add to plate
                </button>
                {/* Add to plan — opens date picker modal, auto-enables plan mode */}
                <button
                  onClick={handleAddToPlan}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border shrink-0 transition-opacity hover:opacity-70 border-stone-300 text-stone-600 bg-card"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <rect x="1" y="2" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M3 1v2M7 1v2M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  Add to plan
                </button>
              </div>
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

      {/* Add Entry modal — "Add to plate" path: standard eaten entry, saves to today */}
      {modalMode === 'plate' && selected && (
        <AddEntryModal
          initialFood={selected}
          onSave={handleModalSave}
          onClose={() => setModalMode(null)}
          planMode={false}
        />
      )}

      {/* Add Entry modal — "Add to plan" path: date picker, always planned */}
      {modalMode === 'plan' && selected && (
        <AddEntryModal
          initialFood={selected}
          onSave={handleModalSave}
          onClose={() => setModalMode(null)}
          planMode={true}
          isFuture={false}
          showDatePicker={true}
        />
      )}

      {/* Success toast — appears after saving, auto-dismisses after 2.5s */}
      {successItem && <SuccessToast itemName={successItem} targetDate={saveTargetDate} />}
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
