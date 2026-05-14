// RecurrencePicker — shared "Repeat this food" schedule selector.
// Renders a pill row and, when 'custom' (Pick dates) is active, a scrollable two-month calendar grid.
// Used in both AddEntryModal (accordion) and RepeatSheet (bottom sheet).
//
// Props:
//   pills        — ordered pill options to display (derived from RepeatConfig by the parent)
//   anchor       — YYYY-MM-DD start of the calendar window; also highlighted with a ring in the grid
//   value        — current RecurrenceMode
//   customDates  — set of picked dates when mode === 'custom'
//   onChange     — called whenever mode or customDates changes

'use client';

import { useMemo } from 'react';
import { RecurrenceMode } from '@/lib/types';
import { PillDef, getCalendarWindow } from '@/lib/recurrence';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parses YYYY-MM-DD into { year, month (0-indexed), day } */
function parseDateStr(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return { year: y, month: m - 1, day };
}

/** Returns the full weekday name for a YYYY-MM-DD string. */
export function fullWeekdayName(dateStr: string): string {
  const { year, month, day } = parseDateStr(dateStr);
  const dow = new Date(year, month, day).getDay();
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow];
}

/** Formats a YYYY-MM-DD to "May 2026" */
function monthLabel(dateStr: string): string {
  const { year, month } = parseDateStr(dateStr);
  return `${MONTH_NAMES[month]} ${year}`;
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

interface CalendarGridProps {
  anchor: string;         // first selectable date — shown with a ring
  windowDates: string[];  // all dates in the 30-day window (selectable)
  selected: string[];
  onToggle: (date: string) => void;
}

function CalendarGrid({ anchor, windowDates, selected, onToggle }: CalendarGridProps) {
  // Build month sections from the window
  const months = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const d of windowDates) {
      const key = d.slice(0, 7); // "YYYY-MM"
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return [...map.entries()]; // [["2026-05", [...dates]], ["2026-06", [...dates]]]
  }, [windowDates]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  return (
    <div className="mt-3 space-y-4">
      {months.map(([monthKey, dates]) => {
        const { year, month } = parseDateStr(dates[0]);
        // Day-of-week the first of this month falls on (0 = Sun)
        const firstDow = new Date(year, month, 1).getDay();
        // Total days in this calendar month
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        return (
          <div key={monthKey}>
            {/* Month header */}
            <p className="text-xs font-semibold text-stone-500 mb-2">
              {monthLabel(dates[0])}
            </p>
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES_SHORT.map((n) => (
                <div key={n} className="text-center text-[10px] text-stone-400 font-medium">{n}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-1">
              {/* Leading empty cells for day-of-week offset */}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {/* All days in the month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const inWindow = windowDates.includes(dateStr);
                const isAnchor = dateStr === anchor;
                const isSelected = selectedSet.has(dateStr);
                const isDisabled = !inWindow;

                return (
                  <button
                    key={dateStr}
                    disabled={isDisabled}
                    onClick={() => onToggle(dateStr)}
                    className={[
                      'h-8 w-8 mx-auto flex items-center justify-center rounded-full text-xs font-medium transition-colors',
                      isSelected
                        ? 'text-white'
                        : isAnchor
                        ? 'ring-2 ring-stone-700 text-stone-800'
                        : isDisabled
                        ? 'text-stone-300 cursor-not-allowed'
                        : 'text-stone-700 hover:bg-stone-100 active:bg-stone-200',
                    ].join(' ')}
                    style={isSelected ? { backgroundColor: 'var(--color-navy)' } : {}}
                    aria-label={dateStr}
                    aria-pressed={isSelected}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface RecurrencePickerProps {
  /** Ordered pill options to display — derived from RepeatConfig by the parent. */
  pills: PillDef[];
  /** YYYY-MM-DD start of the calendar window; shown with a ring in the grid. */
  anchor: string;
  value: RecurrenceMode;
  customDates: string[];
  onChange: (mode: RecurrenceMode, dates: string[]) => void;
}

export default function RecurrencePicker({
  pills,
  anchor,
  value,
  customDates,
  onChange,
}: RecurrencePickerProps) {
  const windowDates = useMemo(() => getCalendarWindow(anchor), [anchor]);

  function handlePillClick(mode: RecurrenceMode) {
    // Keep existing customDates when switching back to 'custom'
    onChange(mode, mode === 'custom' ? customDates : []);
  }

  function handleToggleDate(date: string) {
    const next = customDates.includes(date)
      ? customDates.filter((d) => d !== date)
      : [...customDates, date];
    onChange('custom', next);
  }

  return (
    <div>
      {/* Pill row */}
      <div className="flex gap-2 flex-wrap">
        {pills.map(({ mode, label }) => {
          const active = value === mode;
          return (
            <button
              key={mode}
              onClick={() => handlePillClick(mode)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border',
                active
                  ? 'text-white border-transparent'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 active:bg-stone-100',
              ].join(' ')}
              style={active ? { backgroundColor: 'var(--color-navy)', borderColor: 'var(--color-navy)' } : {}}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Calendar — only when 'custom' (Pick dates) is active */}
      {value === 'custom' && (
        <CalendarGrid
          anchor={anchor}
          windowDates={windowDates}
          selected={customDates}
          onToggle={handleToggleDate}
        />
      )}
    </div>
  );
}
