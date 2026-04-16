// Full-screen daily nutrition detail view — macros + all micronutrients for the selected date,
// plus a 7-day insights card at the top. Accessible via /detailed-summary?date=YYYY-MM-DD.
// AddEntryModal and SearchScreen are rendered locally so the user never leaves this screen.
// Macro cards and micronutrient rows are tappable — expand inline to show per-item contributions.

'use client';

import { useState, useEffect, Fragment } from 'react';
import { useSwipe } from '@/lib/useSwipe';
import { useRouter } from 'next/navigation';
import WeeklyInsights from '@/components/WeeklyInsights';
import AddEntryModal from '@/components/AddEntryModal';
import SearchScreen from '@/components/SearchScreen';
import SuccessToast from '@/components/SuccessToast';
import EmptyStatePrompt from '@/components/EmptyStatePrompt';
import { EntryStatus, FoodEntry, FoodSearchResult, MealTag, NutritionPer100g } from '@/lib/types';
import {
  sumDayNutrition,
  compute7DayAggregate,
  calculateNutrition,
  MICRONUTRIENT_LABELS,
  WeeklyAggregate,
} from '@/lib/nutrition';
import {
  getEntriesForDate,
  getWaterForDate,
  saveEntry,
  toDateString,
  generateId,
} from '@/lib/storage';

interface DetailedSummaryViewProps {
  initialDate: string; // "YYYY-MM-DD" from URL, or empty string (defaults to today)
}

// Macros shown in the summary grid — used for both display and breakdown computation
const MACRO_KEYS: Array<{ key: keyof NutritionPer100g; label: string; unit: string }> = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein',  label: 'Protein',  unit: 'g'    },
  { key: 'fat',      label: 'Fat',      unit: 'g'    },
  { key: 'fiber',    label: 'Fiber',    unit: 'g'    },
];

/**
 * For a given nutrient key, returns all entries that contributed > 0,
 * sorted from highest to lowest contribution.
 */
function getContributors(entries: FoodEntry[], key: keyof NutritionPer100g) {
  return entries
    .map((e) => ({
      name: e.ingredientName,
      value: calculateNutrition(e.nutrition, e.quantity_g)[key] as number,
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
}

export default function DetailedSummaryView({ initialDate }: DetailedSummaryViewProps) {
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (initialDate) {
      const d = new Date(`${initialDate}T12:00:00`);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  const [entries, setEntries]                     = useState<FoodEntry[]>([]);
  const [totals, setTotals]                       = useState<NutritionPer100g>(sumDayNutrition([]));
  const [hasEntries, setHasEntries]               = useState(false);
  const [weeklyAggregate, setWeeklyAggregate]     = useState<WeeklyAggregate>(compute7DayAggregate([]));
  const [showAddModal, setShowAddModal]           = useState(false);
  const [showSearch, setShowSearch]               = useState(false);
  const [refreshKey, setRefreshKey]               = useState(0);
  const [successItem, setSuccessItem]             = useState<string | null>(null);
  // Which macro card is expanded (null = none); tapping the same card again collapses it
  const [expandedMacro, setExpandedMacro]         = useState<keyof NutritionPer100g | null>(null);
  // Which micronutrient keys are expanded — each toggles independently
  const [expandedMicros, setExpandedMicros]       = useState<Set<string>>(new Set());

  const dateStr  = toDateString(currentDate);
  const todayStr = toDateString(new Date());
  const isToday  = dateStr === todayStr;
  // Use string comparison (YYYY-MM-DD) — avoids timezone-induced date shifting
  const isFuture = dateStr > todayStr;
  const isPast   = dateStr < todayStr;

  // Reload data whenever the date changes or an entry is saved.
  // Also resets all expanded state — breakdowns are per-day.
  useEffect(() => {
    const allDayEntries = getEntriesForDate(dateStr);
    // Future dates show planned entries; today and past show eaten entries only
    const displayEntries = isFuture
      ? allDayEntries.filter((e) => e.planOrigin === true)
      : allDayEntries.filter((e) => e.status === 'eaten' || !e.status);
    setEntries(displayEntries);
    setTotals(sumDayNutrition(displayEntries));
    setHasEntries(displayEntries.length > 0);
    setExpandedMacro(null);
    setExpandedMicros(new Set());

    // Weekly insights always use eaten entries only — planned items don't count as consumed
    const dayData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - (6 - i));
      const ds = toDateString(d);
      const de = getEntriesForDate(ds).filter((e) => e.status === 'eaten' || !e.status);
      return { totals: sumDayNutrition(de), hasEntries: de.length > 0, waterMl: getWaterForDate(ds) };
    });
    setWeeklyAggregate(compute7DayAggregate(dayData));
  }, [dateStr, refreshKey, isFuture]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep URL in sync as user navigates (replace, not push — avoids back-button spam)
  useEffect(() => {
    router.replace(`/detailed-summary?date=${dateStr}`, { scroll: false });
  }, [dateStr, router]);

  function goToPrev() {
    setCurrentDate((d) => {
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 1);
      return prev;
    });
  }

  // Plan Mode is owned by page.tsx but survives route changes via sessionStorage.
  // Starts false to match SSR, then corrects after hydration — avoids hydration mismatch.
  const [planModeActive, setPlanModeActive] = useState(false);
  const MAX_FUTURE_DAYS = 14;

  useEffect(() => {
    if (sessionStorage.getItem('planMode') === 'true') setPlanModeActive(true);
  }, []);

  function goToNext() {
    setCurrentDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const limit = new Date();
      limit.setDate(limit.getDate() + (planModeActive ? MAX_FUTURE_DAYS : 0));
      if (toDateString(next) > toDateString(limit)) return d;
      return next;
    });
  }

  // Forward navigation allowed up to today (plan mode off) or today+14 (plan mode on)
  const forwardLimit = new Date();
  forwardLimit.setDate(forwardLimit.getDate() + (planModeActive ? MAX_FUTURE_DAYS : 0));
  const nextDisabled = dateStr >= toDateString(forwardLimit);

  useEffect(() => {
    if (!successItem) return;
    const t = setTimeout(() => setSuccessItem(null), 2500);
    return () => clearTimeout(t);
  }, [successItem]);

  // Accepts full Plan Mode signature for compatibility with AddEntryModal and SearchScreen.
  // DetailedSummary has no plan mode — status/planOrigin/targetDate params are forwarded but
  // entries always land on the currently viewed date.
  function handleSaveEntry(
    food: FoodSearchResult,
    quantity: number,
    tag: MealTag | null,
    status: EntryStatus = 'eaten',
    planOrigin: boolean = false,
    targetDate?: string,
  ) {
    const entry: FoodEntry = {
      id: generateId(),
      date: targetDate ?? dateStr,
      ingredientName: food.name,
      quantity_g: quantity,
      tag,
      nutrition: food.nutrition,
      status,
      planOrigin,
    };
    saveEntry(entry);
    setShowAddModal(false);
    setRefreshKey((k) => k + 1);
    setSuccessItem(food.name);
  }

  function toggleMacro(key: keyof NutritionPer100g) {
    setExpandedMacro((prev) => (prev === key ? null : key));
  }

  function toggleMicro(key: string) {
    setExpandedMicros((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Pre-compute macro breakdown for the currently expanded card
  const macroBreakdown = expandedMacro && hasEntries
    ? {
        meta: MACRO_KEYS.find((m) => m.key === expandedMacro)!,
        contributors: getContributors(entries, expandedMacro),
      }
    : null;

  const swipeHandlers = useSwipe({ onSwipeLeft: goToNext, onSwipeRight: goToPrev });

  return (
    <Fragment>
    <div className={`max-w-md mx-auto px-4 pb-28 ${isFuture ? 'future-plan-tint' : ''}`} {...swipeHandlers}>

      {/* Back navigation */}
      <div className="pt-10 pb-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
        >
          ← Back
        </button>
      </div>

      <div className="space-y-4">
        <WeeklyInsights aggregate={weeklyAggregate} />

        {/* Daily detail card */}
        <div className="bg-card rounded-2xl shadow-sm border border-stone-200 p-5">

          {/* Date navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={goToPrev}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
              aria-label="Previous day"
            >←</button>
            <div className="text-center">
              <p className="text-xs text-stone-400 uppercase tracking-widest font-medium">
                {isToday ? 'Today' : formatDateLabel(currentDate)}
              </p>
              <p className="text-sm font-semibold text-stone-700 mt-0.5">
                {formatDate(currentDate)}
              </p>
            </div>
            <button
              onClick={goToNext}
              disabled={nextDisabled}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next day"
            >→</button>
          </div>

          {/* Planned view banner — only shown when there are actual planned entries to display */}
          {isFuture && hasEntries && (
            <div
              className="flex items-center justify-center px-3 py-1 rounded-lg mb-3 mt-1"
              style={{ backgroundColor: 'var(--color-navy-mid)' }}
            >
              <span className="text-xs font-semibold uppercase tracking-widest text-white">
                Based on meal plan
              </span>
            </div>
          )}

          {!hasEntries && (
            <div className="my-4">
              <EmptyStatePrompt
                label={isFuture ? 'Plan your meal' : 'Start by logging what you ate'}
                onTap={() => setShowAddModal(true)}
              />
            </div>
          )}

          {/* Macro cards — tappable when entries exist */}
          <div className="relative overflow-hidden rounded-xl mt-3">
            <div className="grid grid-cols-2 gap-3">
              {MACRO_KEYS.map(({ key, label, unit }, i) => (
                <MacroCard
                  key={key}
                  label={label}
                  value={hasEntries ? totals[key] as number : null}
                  unit={unit}
                  highlight={i === 0}
                  isFuture={isFuture}
                  isSelected={expandedMacro === key}
                  onClick={hasEntries ? () => toggleMacro(key) : undefined}
                />
              ))}
            </div>
            {/* No corner tag here — the "Based on meal plan" banner above already signals the planned view */}
          </div>

          {/* Macro breakdown panel — slides in below the grid when a card is tapped */}
          {macroBreakdown && (
            <div className="mt-3 rounded-xl border border-stone-100 bg-stone-50 p-4">
              <p className="text-xs text-stone-400 uppercase tracking-widest font-medium mb-3">
                {macroBreakdown.meta.label}
              </p>
              {macroBreakdown.contributors.length > 0 ? (
                <div className="space-y-2.5">
                  {macroBreakdown.contributors.map((c) => (
                    <div key={c.name} className="flex items-center justify-between gap-4">
                      <span className="text-sm text-stone-600 truncate">{c.name}</span>
                      <span className="text-sm font-medium text-stone-700 shrink-0">
                        {c.value}
                        <span className="text-xs text-stone-400 font-normal ml-1">{macroBreakdown.meta.unit}</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-300">Nothing contributed</p>
              )}
            </div>
          )}

          {/* Micronutrients — accordion, each row toggles independently */}
          <div className="mt-5 pt-4 border-t border-stone-100">
            <p className="text-xs text-stone-400 uppercase tracking-widest font-medium mb-1">
              Micronutrients
            </p>
            <div>
              {MICRONUTRIENT_LABELS.map(({ key, label, unit }) => {
                const isOpen = expandedMicros.has(key);
                const contributors = hasEntries ? getContributors(entries, key) : [];

                return (
                  <div key={key}>
                    <button
                      onClick={hasEntries ? () => toggleMicro(key) : undefined}
                      disabled={!hasEntries}
                      className={`w-full flex items-center justify-between py-2.5 text-left rounded-lg transition-colors ${
                        hasEntries ? 'cursor-pointer hover:bg-stone-50 -mx-1 px-1' : 'cursor-default'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-sm text-stone-500">
                        {hasEntries && <Chevron open={isOpen} />}
                        {label}
                      </span>
                      <span className="text-sm font-medium text-stone-700">
                        {hasEntries ? `${totals[key]} ${unit}` : '–'}
                      </span>
                    </button>

                    {/* Per-item contributors — visible when row is expanded */}
                    {isOpen && (
                      <div className="pb-2 pl-5 space-y-1.5">
                        {contributors.length > 0 ? (
                          contributors.map((c) => (
                            <div key={c.name} className="flex items-center justify-between gap-4">
                              <span className="text-xs text-stone-400 truncate">{c.name}</span>
                              <span className="text-xs font-medium text-stone-500 shrink-0">
                                {c.value}
                                <span className="font-normal ml-1 text-stone-400">{unit}</span>
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-stone-300">Nothing contributed</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4 bg-gradient-to-t from-[var(--color-background)] to-transparent">
        <div className="max-w-md mx-auto flex gap-3">
          <button
            onClick={() => setShowSearch(true)}
            className="flex-1 py-4 rounded-2xl font-semibold text-sm shadow-sm transition-colors border border-stone-200 bg-card text-stone-700 hover:bg-stone-50 active:bg-stone-100 flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 9L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Search
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 py-4 rounded-2xl font-semibold text-sm text-white shadow-lg transition-opacity hover:opacity-90 active:opacity-80"
            style={{ backgroundColor: 'var(--color-navy)' }}
          >
            + Add an item
          </button>
        </div>
      </div>

      {showAddModal && (
        <AddEntryModal
          onSave={handleSaveEntry}
          onClose={() => setShowAddModal(false)}
          planMode={planModeActive}
          isFuture={isFuture}
          isPast={isPast}
        />
      )}
      {showSearch && (
        // Search is date-agnostic — "Add to plate" always logs to today, not the viewed date
        <SearchScreen
          onClose={() => setShowSearch(false)}
          onSave={handleSaveEntry}
          targetDate={toDateString(new Date())}
          planMode={false}
        />
      )}

    </div>

    {/* Success toast — outside page div to avoid stacking context issues */}
    {successItem && <SuccessToast itemName={successItem} targetDate={dateStr} />}
    </Fragment>
  );
}

// --- Sub-components ---

/**
 * Chevron icon — points right (›) when collapsed, rotates to point down (↓) when open.
 * Used as the expand affordance on micronutrient rows.
 */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      className={`transition-transform duration-150 text-stone-400 shrink-0 ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="M3.5 2L7 5L3.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Single macro display card in the 2×2 grid.
 * When onClick is provided (i.e. entries exist), the card is tappable —
 * a small chevron in the label row signals this affordance.
 */
function MacroCard({
  label, value, unit, highlight = false, isFuture = false, isSelected = false, onClick,
}: {
  label: string;
  value: number | null;
  unit: string;
  highlight?: boolean;
  isFuture?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const bgStyle: React.CSSProperties = highlight
    ? { backgroundColor: 'var(--color-navy-mid)', opacity: isFuture ? 0.82 : 1 }
    : isFuture
    ? { backgroundColor: 'var(--color-planned-bg)' }
    : {};

  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-3 transition-all ${
        highlight ? 'text-white' : isFuture ? '' : 'bg-stone-50'
      } ${onClick ? 'cursor-pointer' : ''} ${
        isSelected && !highlight ? 'ring-2 ring-offset-1 ring-stone-300' : ''
      } ${
        isSelected && highlight ? 'ring-2 ring-offset-1 ring-white/40' : ''
      }`}
      style={bgStyle}
    >
      {/* Label row — chevron appears here when the card is tappable */}
      <div className="flex items-center justify-between mb-1">
        <p className={`text-xs uppercase tracking-widest font-medium ${highlight ? 'text-blue-100' : 'text-stone-400'}`}>
          {label}
        </p>
        {onClick && (
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            className={`transition-transform duration-150 shrink-0 ${isSelected ? 'rotate-90' : ''} ${highlight ? 'text-blue-100' : 'text-stone-300'}`}
            aria-hidden="true"
          >
            <path d="M3.5 2L7 5L3.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Value */}
      <p className={`text-2xl font-bold leading-none ${highlight ? 'text-white' : 'text-stone-800'}`}>
        {value === null ? (
          <span className={`text-lg ${highlight ? 'text-blue-200' : 'text-stone-300'}`}>–</span>
        ) : (
          <>
            {value}
            <span className={`text-sm font-normal ml-1 ${highlight ? 'text-blue-100' : 'text-stone-400'}`}>{unit}</span>
          </>
        )}
      </p>
    </div>
  );
}

// Top-right corner ribbon — "Best Seller" style diagonal banner.
// Outer div is the overflow-hidden clip box anchored to the top-right of the grid.
// Inner strip is rotated 45° with its centre sitting at the corner point.
function PlanCornerTag() {
  return (
    <div
      className="absolute top-0 right-0 overflow-hidden pointer-events-none"
      style={{ width: 78, height: 78 }}
    >
      <div
        className="absolute text-center font-bold tracking-widest uppercase text-white"
        style={{
          top: 18,
          right: -18,
          width: 84,
          transform: 'rotate(45deg)',
          transformOrigin: 'center center',
          backgroundColor: 'var(--color-navy-mid)',
          fontSize: 8,
          letterSpacing: '0.12em',
          padding: '4px 0',
        }}
      >
        PLAN
      </div>
    </div>
  );
}

// --- Helpers ---

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateLabel(d: Date): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (toDateString(d) === toDateString(yesterday)) return 'Yesterday';
  if (toDateString(d) === toDateString(tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'long' });
}
