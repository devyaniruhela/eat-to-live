// Pure date-arithmetic utilities for the "Repeat this food" recurrence feature.
// All functions work on local YYYY-MM-DD strings — no UTC involved.
// Mirrors the local-date approach used by toDateString() in lib/storage.ts.

import { RecurrenceMode, RepeatContext } from './types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Converts a YYYY-MM-DD string to a local Date object at midnight.
 * Uses local-time components to avoid timezone drift (same as toDateString in storage.ts).
 */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formats a Date to a YYYY-MM-DD string using local date components.
 * Mirrors toDateString() in lib/storage.ts — kept here to avoid a circular import.
 */
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns the 0–6 weekday index for a YYYY-MM-DD string (0 = Sunday). */
function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Returns the full weekday name for a 0–6 index. */
export function dowName(weekday: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday];
}

/** Returns a YYYY-MM-DD string n days after dateStr (negative n goes backwards). */
export function addDays(dateStr: string, n: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return formatLocalDate(d);
}

// ─── Config types ─────────────────────────────────────────────────────────────

/** A single pill option in the recurrence picker. */
export interface PillDef {
  mode: RecurrenceMode;
  label: string;
}

/**
 * The complete configuration for a recurrence picker instance.
 * Derived by getRepeatConfig() from context; consumed by RecurrencePicker + save handlers.
 */
export interface RepeatConfig {
  /**
   * First date to project repeats from.
   * 'anchor' mode → this single date.
   * 'week' mode   → this date + next 6 days (7 total).
   * 'weekly' mode → all occurrences of `weekday` within 30 days of this date.
   * Calendar window always starts here.
   */
  anchor: string;
  /** Weekday (0–6) for 'weekly' mode — usually the weekday of `anchor`. */
  weekday: number;
  /** Ordered pill options to display in the picker. */
  pills: PillDef[];
  /** Which pill is selected by default when the picker is first opened. */
  defaultMode: RecurrenceMode;
}

// ─── Rule table ───────────────────────────────────────────────────────────────
//
// Context → anchor → pills → defaultMode
//
// add-today    Adding to today.         anchor = tomorrow.        Pills: Tomorrow / This week / Every [DOW] / Pick dates.
// add-past     Adding to a past date.   anchor = today.           Pills: Today    / This week / Every [DOW] / Pick dates.
// add-future   Adding to a future date. anchor = that date.       Pills:           This week  / Every [DOW] / Pick dates.
//                                       (No single-date pill — the entry itself is on that date.)
// repeat-past  Repeating past entry.    anchor = today.           Pills: Today    / This week / Every [DOW] / Pick dates.
// repeat-today Repeating today's entry. anchor = tomorrow.        Pills: Tomorrow / This week / Every [DOW] / Pick dates.
// repeat-future Repeating future entry. anchor = entry date + 1.  Pills:           Coming week / Every [DOW] / Pick dates.

/**
 * Returns the full recurrence picker configuration for a given UI context.
 *
 * @param context     — Which scenario is triggering the picker (add vs repeat, past/today/future).
 * @param primaryDate — The date the primary entry lives on (the viewing date or the existing entry's date).
 * @param todayStr    — YYYY-MM-DD for today.
 */
export function getRepeatConfig(
  context: RepeatContext,
  primaryDate: string,
  todayStr: string,
): RepeatConfig {
  switch (context) {
    case 'add-today': {
      // Adding to today → repeats start from tomorrow onwards
      const anchor = addDays(todayStr, 1);
      // Weekday matches today's date — you're logging today and want to repeat on the same day
      const weekday = weekdayOf(primaryDate);
      return {
        anchor,
        weekday,
        pills: [
          { mode: 'anchor', label: 'Tomorrow' },
          { mode: 'week',   label: 'This week' },
          { mode: 'weekly', label: `Every ${dowName(weekday)}` },
          { mode: 'custom', label: 'Pick dates' },
        ],
        defaultMode: 'anchor',
      };
    }

    case 'add-past': {
      // Adding to a past date → most natural next repeat is today
      const anchor = todayStr;
      // Weekday matches the past date — if you ate this on a Wednesday, repeat every Wednesday
      const weekday = weekdayOf(primaryDate);
      return {
        anchor,
        weekday,
        pills: [
          { mode: 'anchor', label: 'Today' },
          { mode: 'week',   label: 'This week' },
          { mode: 'weekly', label: `Every ${dowName(weekday)}` },
          { mode: 'custom', label: 'Pick dates' },
        ],
        defaultMode: 'anchor',
      };
    }

    case 'add-future': {
      // Adding to a future date → anchor is that date; no single-date pill (the entry IS that date)
      const anchor = primaryDate;
      const weekday = weekdayOf(anchor);
      return {
        anchor,
        weekday,
        pills: [
          { mode: 'week',   label: 'This week' },
          { mode: 'weekly', label: `Every ${dowName(weekday)}` },
          { mode: 'custom', label: 'Pick dates' },
        ],
        defaultMode: 'week',
      };
    }

    case 'repeat-past': {
      // Repeating a past entry → most natural next occurrence is today
      const anchor = todayStr;
      // Weekday matches the entry's date — if it was eaten on a Wednesday, repeat every Wednesday
      const weekday = weekdayOf(primaryDate);
      return {
        anchor,
        weekday,
        pills: [
          { mode: 'anchor', label: 'Today' },
          { mode: 'week',   label: 'This week' },
          { mode: 'weekly', label: `Every ${dowName(weekday)}` },
          { mode: 'custom', label: 'Pick dates' },
        ],
        defaultMode: 'anchor',
      };
    }

    case 'repeat-today': {
      // Repeating today's entry → next occurrence is tomorrow
      const anchor = addDays(todayStr, 1);
      // Weekday matches today — repeating today's entry every week means same weekday
      const weekday = weekdayOf(primaryDate);
      return {
        anchor,
        weekday,
        pills: [
          { mode: 'anchor', label: 'Tomorrow' },
          { mode: 'week',   label: 'This week' },
          { mode: 'weekly', label: `Every ${dowName(weekday)}` },
          { mode: 'custom', label: 'Pick dates' },
        ],
        defaultMode: 'anchor',
      };
    }

    case 'repeat-future': {
      // Repeating a future entry → anchor is the day after the entry (the "coming week" starts there)
      const anchor = addDays(primaryDate, 1);
      // Weekday matches the entry's date — repeat on the same day of the week it's planned for
      const weekday = weekdayOf(primaryDate);
      return {
        anchor,
        weekday,
        pills: [
          { mode: 'week',   label: 'Coming week' },
          { mode: 'weekly', label: `Every ${dowName(weekday)}` },
          { mode: 'custom', label: 'Pick dates' },
        ],
        defaultMode: 'week',
      };
    }
  }
}

// ─── Date generators ──────────────────────────────────────────────────────────

/**
 * Returns 7 YYYY-MM-DD strings: fromDate + the next 6 days.
 * Used for the 'week' recurrence mode.
 */
export function getDailyDates(fromDate: string): string[] {
  const base = parseLocalDate(fromDate);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(formatLocalDate(d));
  }
  return dates;
}

/**
 * Returns all occurrences of `weekday` (0 = Sunday … 6 = Saturday)
 * within 30 days of fromDate, inclusive of fromDate if it matches.
 * Used for the 'weekly' recurrence mode.
 */
export function getWeeklyDates(fromDate: string, weekday: number): string[] {
  const base = parseLocalDate(fromDate);
  const end = new Date(base);
  end.setDate(base.getDate() + 30);

  const dates: string[] = [];
  const cursor = new Date(base);
  // Fast-forward cursor to the first occurrence of the target weekday
  const diff = (weekday - cursor.getDay() + 7) % 7;
  cursor.setDate(cursor.getDate() + diff);

  while (cursor <= end) {
    dates.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

/**
 * Returns all YYYY-MM-DD strings in the 30-day window starting from fromDate.
 * Used to populate the 'custom' (Pick dates) calendar grid.
 */
export function getCalendarWindow(fromDate: string): string[] {
  const base = parseLocalDate(fromDate);
  const dates: string[] = [];
  for (let i = 0; i <= 30; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(formatLocalDate(d));
  }
  return dates;
}

/**
 * Resolves the final list of target date strings for a given mode + anchor.
 * This is the single source of truth for which dates an entry will be saved to.
 *
 * Callers are responsible for filtering out the primary entry's date if it might overlap.
 *
 * @param mode        — The chosen recurrence mode.
 * @param anchor      — The base date. Use RepeatConfig.anchor.
 * @param weekday     — 0–6; only used when mode === 'weekly'. Use RepeatConfig.weekday.
 * @param customDates — Explicitly selected dates; only used when mode === 'custom'.
 */
export function resolveTargetDates(
  mode: RecurrenceMode,
  anchor: string,
  weekday: number,
  customDates: string[],
): string[] {
  switch (mode) {
    case 'anchor':  return [anchor];
    case 'week':    return getDailyDates(anchor);
    case 'weekly':  return getWeeklyDates(anchor, weekday);
    case 'custom':  return [...customDates].sort(); // chronological order
  }
}
