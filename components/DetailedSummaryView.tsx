// Full-screen daily nutrition detail view — macros + all micronutrients for the selected date,
// plus a 7-day insights card at the top. Accessible via /detailed-summary?date=YYYY-MM-DD.
// AddEntryModal and SearchScreen are rendered locally so the user never leaves this screen.

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import WeeklyInsights from '@/components/WeeklyInsights';
import AddEntryModal from '@/components/AddEntryModal';
import SearchScreen from '@/components/SearchScreen';
import EmptyStatePrompt from '@/components/EmptyStatePrompt';
import { FoodEntry, FoodSearchResult, MealTag, NutritionPer100g } from '@/lib/types';
import {
  sumDayNutrition,
  compute7DayAggregate,
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

export default function DetailedSummaryView({ initialDate }: DetailedSummaryViewProps) {
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (initialDate) {
      const d = new Date(`${initialDate}T12:00:00`);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  const [totals, setTotals]             = useState<NutritionPer100g>(sumDayNutrition([]));
  const [hasEntries, setHasEntries]     = useState(false);
  const [weeklyAggregate, setWeeklyAggregate] = useState<WeeklyAggregate>(compute7DayAggregate([]));
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearch, setShowSearch]     = useState(false);
  // Incrementing refreshKey forces a data reload after an entry is saved
  const [refreshKey, setRefreshKey]     = useState(0);

  const dateStr  = toDateString(currentDate);
  const isToday  = dateStr === toDateString(new Date());
  const isFuture = currentDate > new Date() && !isToday;

  // Reload entries and 7-day aggregate whenever the date changes or an entry is saved
  useEffect(() => {
    const entries = getEntriesForDate(dateStr);
    setTotals(sumDayNutrition(entries));
    setHasEntries(entries.length > 0);

    const dayData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - (6 - i));
      const ds = toDateString(d);
      const de = getEntriesForDate(ds);
      return { totals: sumDayNutrition(de), hasEntries: de.length > 0, waterMl: getWaterForDate(ds) };
    });
    setWeeklyAggregate(compute7DayAggregate(dayData));
  }, [dateStr, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function goToNext() {
    setCurrentDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (next > today) return d;
      return next;
    });
  }

  // Saves the entry to the date currently displayed, then reloads
  function handleSaveEntry(food: FoodSearchResult, quantity: number, tag: MealTag | null) {
    const entry: FoodEntry = {
      id: generateId(),
      date: dateStr,
      ingredientName: food.name,
      quantity_g: quantity,
      tag,
      nutrition: food.nutrition,
    };
    saveEntry(entry);
    setShowAddModal(false);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="max-w-md mx-auto px-4 pb-28">
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
        {/* 7-day insights — always shown */}
        <WeeklyInsights aggregate={weeklyAggregate} />

        {/* Daily detail card */}
        <div className="bg-card rounded-2xl shadow-sm border border-stone-200 p-5">
          {/* Date navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={goToPrev}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
              aria-label="Previous day"
            >
              ←
            </button>
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
              disabled={isFuture}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next day"
            >
              →
            </button>
          </div>

          {/* Empty state prompt — between date and macro cards */}
          {!hasEntries && (
            <div className="my-4">
              <EmptyStatePrompt
                label="Start by logging what you ate"
                onTap={() => setShowAddModal(true)}
              />
            </div>
          )}

          {/* Macro cards — always shown; – when no entries */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <MacroCard label="Calories" value={hasEntries ? totals.calories : null} unit="kcal" highlight />
            <MacroCard label="Protein"  value={hasEntries ? totals.protein  : null} unit="g" />
            <MacroCard label="Fat"      value={hasEntries ? totals.fat      : null} unit="g" />
            <MacroCard label="Fiber"    value={hasEntries ? totals.fiber    : null} unit="g" />
          </div>

          {/* Micronutrients — always shown; – when no entries */}
          <div className="mt-5 pt-4 border-t border-stone-100">
            <p className="text-xs text-stone-400 uppercase tracking-widest font-medium mb-3">
              Micronutrients
            </p>
            <div className="space-y-2.5">
              {MICRONUTRIENT_LABELS.map(({ key, label, unit }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-stone-500">{label}</span>
                  <span className="text-sm font-medium text-stone-700">
                    {hasEntries ? `${totals[key]} ${unit}` : '–'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar — modals open on this screen, no navigation away */}
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

      {/* Modals — rendered locally so the user stays on this screen */}
      {showAddModal && (
        <AddEntryModal onSave={handleSaveEntry} onClose={() => setShowAddModal(false)} />
      )}
      {showSearch && (
        <SearchScreen onClose={() => setShowSearch(false)} />
      )}
    </div>
  );
}

// --- Sub-components ---

function MacroCard({
  label, value, unit, highlight = false,
}: {
  label: string; value: number | null; unit: string; highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${highlight ? 'text-white' : 'bg-stone-50 text-stone-800'}`}
      style={highlight ? { backgroundColor: 'var(--color-navy-mid)' } : undefined}
    >
      <p className={`text-xs uppercase tracking-widest font-medium mb-1 ${highlight ? 'text-blue-100' : 'text-stone-400'}`}>
        {label}
      </p>
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

// --- Helpers ---

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateLabel(d: Date): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (toDateString(d) === toDateString(yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long' });
}
