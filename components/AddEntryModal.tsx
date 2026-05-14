// The Add Entry flow — a bottom sheet modal with 4 steps:
// 1. Search for a food  2. See nutrition preview  3. Enter quantity  4. Pick a meal tag → Save
// The nutrition preview step includes an expandable micronutrient detail section.
// An optional "Repeat this food ›" tertiary CTA expands a RecurrencePicker so the user can
// schedule the same item across multiple days in one tap.

'use client';

import { useState, useEffect, useRef } from 'react';
import { EntryStatus, FoodSearchResult, MealTag, RecurrenceMode, RepeatContext } from '@/lib/types';
import { calculateNutrition, MICRONUTRIENT_LABELS } from '@/lib/nutrition';
import { getRecentFoods, toDateString, getCustomFoods, customFoodToSearchResult } from '@/lib/storage';
import CustomItemModal from '@/components/CustomItemModal';
import RecurrencePicker from '@/components/RecurrencePicker';
import { getRepeatConfig, resolveTargetDates, dowName } from '@/lib/recurrence';

interface AddEntryModalProps {
  onSave: (result: FoodSearchResult, quantity: number, tag: MealTag | null, status: EntryStatus, planOrigin: boolean, targetDate?: string) => void;
  onClose: () => void;
  // Called once after all saves complete — used by the parent to show a success toast.
  // repeatLine, when present, is a short phrase describing the repeat schedule chosen.
  onSaveDone?: (info: { itemName: string; mode: RecurrenceMode; dateCount: number; status: EntryStatus; repeatLine?: string }) => void;
  // When provided, skip the search step and open directly at quantity input
  initialFood?: FoodSearchResult;
  // Plan Mode context — controls title, checkbox visibility, and CTA copy
  planMode?: boolean;
  isFuture?: boolean;
  isPast?: boolean;
  // YYYY-MM-DD of the date currently being viewed — used to derive the repeat context.
  // Defaults to today when not provided (backward-compatible with callers that don't pass it).
  viewingDate?: string;
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

export default function AddEntryModal({
  onSave,
  onSaveDone,
  onClose,
  initialFood,
  planMode = false,
  isFuture = false,
  isPast = false,
  viewingDate,
  showDatePicker = false,
}: AddEntryModalProps) {
  // ─── Recurrence config — computed from context before any hooks ───────────────
  // This is a pure derivation (no side effects), so computing it before useState is valid.
  // Context is stable during the modal's lifetime — props don't change once mounted.
  const todayStr = toDateString(new Date());
  const effectivePrimaryDate = viewingDate ?? todayStr;
  const addContext: RepeatContext = isPast ? 'add-past' : isFuture ? 'add-future' : 'add-today';
  const config = getRepeatConfig(addContext, effectivePrimaryDate, todayStr);

  // ─── State ────────────────────────────────────────────────────────────────────
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
  const [showCustomModal, setShowCustomModal] = useState(false);
  // Selected date for the plan date picker — defaults to today, user can pick up to +14 days.
  // Only relevant when showDatePicker=true (opened from Search → "Add to plan").
  const [selectedPlanDate, setSelectedPlanDate] = useState(() => toDateString(new Date()));
  const planDateOptions = showDatePicker ? getPlanDateOptions() : [];
  // "Repeat this food" recurrence accordion.
  // showRepeat: whether the user has tapped the tertiary CTA to expand the picker.
  // recurrenceMode initialised from config.defaultMode so the right pill is pre-selected.
  const [showRepeat, setShowRepeat] = useState(false);
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>(config.defaultMode);
  const [customDates, setCustomDates] = useState<string[]>([]);
  // Loaded once on mount — top 5 foods from the last 3 days
  const [recentFoods] = useState<FoodSearchResult[]>(() =>
    initialFood ? [] : getRecentFoods(5, 3)
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // In-memory cache: stores results for queries already fetched this session.
  // Key = lowercased query string, Value = results array.
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

    // Custom foods always checked first — no API call needed for them
    const customMatches = getCustomFoods()
      .filter((cf) => cf.name.toLowerCase().includes(key))
      .map(customFoodToSearchResult);

    if (cache.current.has(key)) {
      setResults([...customMatches, ...cache.current.get(key)!]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/food-search?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      cache.current.set(key, data.results);
      setResults([...customMatches, ...data.results]);
    } catch {
      setError('Could not fetch results. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(food: FoodSearchResult) {
    // Order matters: set selected first so the effect's guard condition is true when query updates
    setSelected(food);
    setResults([]);
    setQuery(food.name);
    setShowMicros(false);
  }

  // Whether this entry will be saved as a planned item.
  // Past dates are ALWAYS eaten regardless of plan mode. Future dates are ALWAYS planned.
  // Today + plan mode ON: planned unless user ticks "Mark as eaten".
  const isPlanEntry = showDatePicker
    ? true
    : isFuture
    ? true
    : planMode && !isPast && !markAsEaten;

  function handleSave() {
    if (!selected || !quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) return;
    if (showRepeat && recurrenceMode === 'custom' && customDates.length === 0) return;

    const q = Number(quantity);

    // ── Primary entry — always saved first (to the viewing date or selected plan date) ──
    const status: EntryStatus = isPlanEntry ? 'planned' : 'eaten';
    // planOrigin records that this entry came from a plan-mode flow — stays true even if "Mark as eaten"
    // was ticked, so the item remains visible (struck through) in the "On the menu" plan view.
    const planOrigin = showDatePicker ? true : isFuture ? true : (planMode && !isPast);
    const targetDate = showDatePicker ? selectedPlanDate : undefined;
    onSave(selected, q, tag, status, planOrigin, targetDate);

    if (showRepeat) {
      // ── Repeat entries — one per additional date, filtered to exclude the primary ──
      // The primary date is the viewing date (or selectedPlanDate in the date picker path).
      const primaryDate = targetDate ?? effectivePrimaryDate;
      const rawRepeatDates = resolveTargetDates(recurrenceMode, config.anchor, config.weekday, customDates);
      // Filter avoids duplicating the primary entry (only relevant for 'add-future' where anchor = primaryDate)
      const repeatDates = rawRepeatDates.filter((d) => d !== primaryDate);

      for (const date of repeatDates) {
        const isFutureDate = date > todayStr;
        // State rule: future dates are always planned+planOrigin; present/past retain user's choice
        const repeatStatus: EntryStatus = isFutureDate ? 'planned' : status;
        const repeatPlanOrigin = isFutureDate ? true : planOrigin;
        onSave(selected, q, tag, repeatStatus, repeatPlanOrigin, date);
      }

      // Build the repeat-line text for the toast third line
      const extraCount = repeatDates.length;
      let repeatLine: string | undefined;
      if (extraCount > 0) {
        if (recurrenceMode === 'weekly') {
          repeatLine = `Repeating every ${dowName(config.weekday)}`;
        } else if (recurrenceMode === 'anchor') {
          const anchorPill = config.pills.find((p) => p.mode === 'anchor');
          repeatLine = `Also saved for ${anchorPill?.label.toLowerCase() ?? 'another day'}`;
        } else {
          repeatLine = `Also saved for ${extraCount} more ${extraCount === 1 ? 'day' : 'days'}`;
        }
      }

      const totalDates = 1 + repeatDates.length;
      onSaveDone?.({ itemName: selected.name, mode: recurrenceMode, dateCount: totalDates, status, repeatLine });
    } else {
      // No repeat — single save; mode 'anchor' signals a plain add to the parent
      onSaveDone?.({ itemName: selected.name, mode: 'anchor', dateCount: 1, status, repeatLine: undefined });
    }
  }

  // Calculate nutrition preview based on entered quantity
  const preview = selected && quantity && Number(quantity) > 0
    ? calculateNutrition(selected.nutrition, Number(quantity))
    : null;

  const canSave = selected && quantity && Number(quantity) > 0;

  // Resolved repeat dates for count in save button label
  const repeatDates = showRepeat
    ? resolveTargetDates(recurrenceMode, config.anchor, config.weekday, customDates)
        .filter((d) => d !== effectivePrimaryDate)
    : [];

  // Total dates = primary + repeats — shown in the save button label
  const totalDates = 1 + repeatDates.length;

  // Save button label — reflects the repeat selection when active
  const saveLabel = (() => {
    if (!showRepeat) {
      return isPlanEntry ? 'Add to meal plan' : 'Add to plate';
    }
    if (recurrenceMode === 'custom' && customDates.length === 0) {
      return 'Select at least one day';
    }
    if (recurrenceMode === 'weekly') {
      return `Save every ${dowName(config.weekday)}`;
    }
    return `Save for ${totalDates} days`;
  })();

  const isSaveDisabled = !canSave || (showRepeat && recurrenceMode === 'custom' && customDates.length === 0);

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

          {/* Quick add pills — shown when search is empty and no food selected */}
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
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{food.name}</p>
                    {food.isCustom && (
                      <span
                        className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ backgroundColor: 'var(--color-planned-bg)', color: 'var(--color-navy-mid)' }}
                      >
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 shrink-0">{food.nutrition.calories} kcal</p>
                </button>
              ))}
            </div>
          )}

          {/* "+Custom item" chip — persistent until a food is selected */}
          {!selected && (
            <button
              onClick={() => setShowCustomModal(true)}
              className="flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-stone-300 bg-card text-stone-500 hover:border-stone-400 transition-colors"
            >
              <span>+</span>
              Custom item
            </button>
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

              {/* Expandable micronutrient list */}
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

          {/* "Repeat this food" accordion — shown after a food is selected, except in the date-picker path
              (showDatePicker is always explicit about date, so repeat isn't needed there).
              Visible for all date contexts: today, past, and future. */}
          {selected && !showDatePicker && (
            <div className="mt-4">
              {!showRepeat ? (
                /* Collapsed state — tertiary text link with repeat icon */
                <button
                  onClick={() => { setShowRepeat(true); setRecurrenceMode(config.defaultMode); }}
                  className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                  style={{ color: 'var(--color-navy-mid)' }}
                >
                  {/* Two-cards-with-plus icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="8" y="2" width="13" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8"/>
                    <rect x="3" y="6" width="13" height="16" rx="2.5" fill="var(--color-background)" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M9.5 14h4M11.5 12v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  Repeat this food ›
                </button>
              ) : (
                /* Expanded state — picker + collapse link */
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">
                      Repeat this food
                    </p>
                    <button
                      onClick={() => { setShowRepeat(false); setRecurrenceMode(config.defaultMode); setCustomDates([]); }}
                      className="text-xs text-stone-400 hover:text-stone-600"
                    >
                      Remove
                    </button>
                  </div>
                  <RecurrencePicker
                    pills={config.pills}
                    anchor={config.anchor}
                    value={recurrenceMode}
                    customDates={customDates}
                    onChange={(mode, dates) => { setRecurrenceMode(mode); setCustomDates(dates); }}
                  />
                  {/* Scope note — honest upper bound on planning horizon */}
                  <p className="mt-3 text-xs text-stone-400 leading-snug">
                    Schedules up to 30 days from today — which is plenty, let&apos;s be honest.
                  </p>
                </div>
              )}
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
              disabled={isSaveDisabled}
              className="flex-1 py-3 rounded-xl bg-navy text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {saveLabel}
            </button>
          </div>
        </div>

      </div>

      {/* Custom item modal — renders on top when user taps the "+Custom item" chip.
          On save the new food is auto-selected so the user can log it immediately. */}
      {showCustomModal && (
        <CustomItemModal
          onSaved={(food) => {
            setShowCustomModal(false);
            handleSelect(food);
          }}
          onClose={() => setShowCustomModal(false)}
        />
      )}
    </div>
  );
}
