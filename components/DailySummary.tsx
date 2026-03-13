// Displays the macro summary for the selected day.
// Shows Calories, Protein, Fat, Fiber calculated from logged entries.

'use client';

import { FoodEntry } from '@/lib/types';
import { sumDayNutrition } from '@/lib/nutrition';

interface DailySummaryProps {
  entries: FoodEntry[];
  waterMl: number;
  date: Date;
  onPrevDay: () => void;
  onNextDay: () => void;
}

export default function DailySummary({
  entries,
  waterMl,
  date,
  onPrevDay,
  onNextDay,
}: DailySummaryProps) {
  const totals = sumDayNutrition(entries);
  const isToday = toDateStr(date) === toDateStr(new Date());
  const isFuture = date > new Date() && !isToday;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5">
      {/* Date navigation */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onPrevDay}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
          aria-label="Previous day"
        >
          ←
        </button>
        <div className="text-center">
          <p className="text-xs text-stone-400 uppercase tracking-widest font-medium">
            {isToday ? 'Today' : formatDateLabel(date)}
          </p>
          <p className="text-sm font-semibold text-stone-700 mt-0.5">{formatDate(date)}</p>
        </div>
        <button
          onClick={onNextDay}
          disabled={isFuture}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next day"
        >
          →
        </button>
      </div>

      {/* Macro cards */}
      {entries.length === 0 ? (
        <p className="text-center text-stone-400 text-sm py-4">
          Nothing logged yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <MacroCard label="Calories" value={totals.calories} unit="kcal" highlight />
          <MacroCard label="Protein" value={totals.protein} unit="g" />
          <MacroCard label="Fat" value={totals.fat} unit="g" />
          <MacroCard label="Fiber" value={totals.fiber} unit="g" />
        </div>
      )}

      {/* Water summary */}
      {waterMl > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
          <span className="text-sm text-stone-500">Water</span>
          <span className="text-sm font-semibold text-stone-700">{formatWater(waterMl)}</span>
        </div>
      )}
    </div>
  );
}

// Individual macro display card
function MacroCard({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  value: number;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-navy text-white' : 'bg-stone-50 text-stone-800'}`}>
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

// --- Helpers ---

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateLabel(d: Date): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (toDateStr(d) === toDateStr(yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long' });
}

function formatWater(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)}L`;
  return `${ml}ml`;
}
