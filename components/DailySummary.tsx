// Displays the macro summary for the selected day.
// Shows Calories, Protein, Fat, Fiber calculated from logged entries.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FoodEntry } from '@/lib/types';
import { sumDayNutrition } from '@/lib/nutrition';

// How many days ahead Plan Mode allows navigation — must match page.tsx goToNextDay cap.
const MAX_FUTURE_DAYS = 14;

interface DailySummaryProps {
  entries: FoodEntry[];
  waterMl: number;
  date: Date;
  onPrevDay: () => void;
  onNextDay: () => void;
  onEditWater: (ml: number) => void;
  planMode: boolean;
  isFuture: boolean;
}

export default function DailySummary({
  entries,
  waterMl,
  date,
  onPrevDay,
  onNextDay,
  onEditWater,
  planMode,
  isFuture,
}: DailySummaryProps) {
  const isToday = toDateStr(date) === toDateStr(new Date());

  // Split entries for Plan Mode display
  const eatenEntries = entries.filter((e) => e.status === 'eaten' || !e.status);
  const planOriginEntries = entries.filter((e) => e.planOrigin === true);
  const uncheckedPlanEntries = planOriginEntries.filter((e) => e.status === 'planned');

  // Future dates show planned totals; today/past show eaten totals
  const displayEntries = isFuture ? planOriginEntries : eatenEntries;
  const totals = sumDayNutrition(displayEntries);

  // Planned summary line — shown on today when plan mode is on and planned items exist
  const plannedTotals = (planMode && !isFuture && planOriginEntries.length > 0)
    ? sumDayNutrition(planOriginEntries)
    : null;
  // Green when every plan-origin item has been checked off; red while any remain
  const planAdherent = planOriginEntries.length > 0 && uncheckedPlanEntries.length === 0;

  const hasDisplay = displayEntries.length > 0;

  // Next button disabled when the user is at the navigation limit:
  // Plan Mode OFF → limit is today; Plan Mode ON → limit is today + MAX_FUTURE_DAYS
  const limit = new Date();
  limit.setDate(limit.getDate() + (planMode ? MAX_FUTURE_DAYS : 0));
  const nextDisabled = toDateStr(date) >= toDateStr(limit);

  const [editingWater, setEditingWater] = useState(false);
  const [editWaterValue, setEditWaterValue] = useState('');

  function startWaterEdit() {
    setEditWaterValue(String(waterMl));
    setEditingWater(true);
  }

  function saveWaterEdit() {
    const ml = Number(editWaterValue);
    if (!editWaterValue || isNaN(ml) || ml < 0) return;
    onEditWater(ml);
    setEditingWater(false);
  }

  function cancelWaterEdit() {
    setEditingWater(false);
    setEditWaterValue('');
  }

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-stone-200 p-5">
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
          disabled={nextDisabled}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next day"
        >
          →
        </button>
      </div>

      {/* Macro cards */}
      {!hasDisplay ? (
        <p className="text-center text-stone-400 text-sm py-4">
          {isFuture ? 'Nothing planned yet.' : 'Nothing logged yet.'}
        </p>
      ) : (
        <div className="relative pt-3">
          <div className="grid grid-cols-2 gap-3">
            <MacroCard label="Calories" value={totals.calories} unit="kcal" highlight isFuture={isFuture} />
            <MacroCard label="Protein"  value={totals.protein}  unit="g"    isFuture={isFuture} />
            <MacroCard label="Fat"      value={totals.fat}      unit="g"    isFuture={isFuture} />
            <MacroCard label="Fiber"    value={totals.fiber}    unit="g"    isFuture={isFuture} />
          </div>
          {/* Diagonal corner ribbon — signals this is a planned/future view */}
          {isFuture && <PlanCornerTag />}
        </div>
      )}

      {/* Planned totals line — today only, Plan Mode ON, when planned items exist */}
      {plannedTotals && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-stone-400">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: planAdherent ? '#4ade80' : 'var(--color-rose)' }}
            title={planAdherent ? 'All planned items eaten' : 'Some planned items remain'}
          />
          Planned: {plannedTotals.calories} kcal &middot; {plannedTotals.protein}g protein &middot; {plannedTotals.fat}g fat &middot; {plannedTotals.fiber}g fiber
        </div>
      )}

      {/* Tertiary CTA — sits between macros and water, right-aligned */}
      <div className="flex justify-end mt-2">
        <Link
          href={`/detailed-summary?date=${toDateStr(date)}`}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          {isFuture ? 'Detailed plan →' : 'Detailed summary →'}
        </Link>
      </div>

      {/* Water summary — with inline edit */}
      {waterMl > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
          <span className="text-sm text-stone-500">Water</span>
          {editingWater ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={editWaterValue}
                onChange={(e) => setEditWaterValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveWaterEdit();
                  if (e.key === 'Escape') cancelWaterEdit();
                }}
                autoFocus
                className="w-20 px-2 py-1 text-sm border border-stone-300 rounded-lg text-center focus:outline-none focus:border-navy"
              />
              <span className="text-xs text-stone-400">ml</span>
              <button
                onClick={saveWaterEdit}
                className="text-xs font-semibold ml-1"
                style={{ color: 'var(--color-navy)' }}
              >
                Save
              </button>
              <button
                onClick={cancelWaterEdit}
                className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-stone-700">{formatWater(waterMl)}</span>
              <button
                onClick={startWaterEdit}
                className="text-stone-300 hover:text-stone-500 transition-colors"
                aria-label="Edit water total"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M9 1.5L11.5 4L4.5 11H2V8.5L9 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Individual macro display card.
// isFuture applies --color-planned-bg tint; highlight card keeps navy-mid but
// dims slightly on future dates to match the softer planned-view palette.
function MacroCard({
  label,
  value,
  unit,
  highlight = false,
  isFuture = false,
}: {
  label: string;
  value: number;
  unit: string;
  highlight?: boolean;
  isFuture?: boolean;
}) {
  const bgStyle: React.CSSProperties = highlight
    ? { backgroundColor: isFuture ? 'var(--color-navy-mid)' : 'var(--color-navy-mid)', opacity: isFuture ? 0.82 : 1 }
    : isFuture
    ? { backgroundColor: 'var(--color-planned-bg)' }
    : {};

  return (
    <div
      className={`rounded-xl p-3 ${highlight ? 'text-white' : 'text-stone-800'} ${!highlight && !isFuture ? 'bg-stone-50' : ''}`}
      style={bgStyle}
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

// Left-pointing chevron tag — sits above the top-right of the macro grid.
// Chevron shape via clip-path: pointed left end (◄), straight right end.
// Positioned just above the grid so it doesn't obscure the macro values.
function PlanCornerTag() {
  return (
    <div
      className="absolute pointer-events-none"
      style={{ right: 0, top: -12, zIndex: 2 }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-navy-mid)',
          color: 'white',
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '5px 12px 5px 18px',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          // Chevron: left point at 50% height, right side square-rounded
          clipPath: 'polygon(14px 0%, 100% 0%, 100% 100%, 14px 100%, 0% 50%)',
          borderRadius: '0 4px 4px 0',
        }}
      >
        As per plan
      </div>
    </div>
  );
}

// --- Helpers ---

// Uses local time components (not toISOString) to avoid date shifting for IST and other UTC+ zones.
// toISOString() returns UTC, which can be a different calendar date from the user's local date.
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateLabel(d: Date): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (toDateStr(d) === toDateStr(yesterday)) return 'Yesterday';
  if (toDateStr(d) === toDateStr(tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'long' });
}

function formatWater(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)}L`;
  return `${ml}ml`;
}
