// RepeatSheet — bottom sheet for the ↺ "Repeat this food" path on existing entries.
// Opens when the user taps ↺ on an entry row in WhatIAte.
// Lets them pick a recurrence schedule and adds copies of the entry to future dates.
//
// Props:
//   entry     — the source FoodEntry to repeat
//   todayStr  — YYYY-MM-DD for today (passed from WhatIAte to avoid re-deriving)
//   onConfirm — called with the final array of target date strings + the chosen mode
//   onClose   — called when the sheet is dismissed

'use client';

import { useState } from 'react';
import { FoodEntry, RecurrenceMode, RepeatContext } from '@/lib/types';
import RecurrencePicker from '@/components/RecurrencePicker';
import { getRepeatConfig, resolveTargetDates, dowName } from '@/lib/recurrence';

interface RepeatSheetProps {
  entry: FoodEntry;
  todayStr: string;
  onConfirm: (dates: string[], mode: RecurrenceMode) => void;
  onClose: () => void;
}

export default function RepeatSheet({ entry, todayStr, onConfirm, onClose }: RepeatSheetProps) {
  // Derive which repeat context applies based on the entry's date vs today.
  // This drives the pill labels and anchor date — no hardcoding.
  const context: RepeatContext =
    entry.date < todayStr ? 'repeat-past' :
    entry.date === todayStr ? 'repeat-today' :
    'repeat-future';

  const config = getRepeatConfig(context, entry.date, todayStr);

  // Initialise mode from config so the correct default pill is pre-selected
  const [mode, setMode] = useState<RecurrenceMode>(config.defaultMode);
  const [customDates, setCustomDates] = useState<string[]>([]);

  // Resolved target dates — always exclude the entry's own date (already logged)
  const targetDates = resolveTargetDates(mode, config.anchor, config.weekday, customDates)
    .filter((d) => d !== entry.date);

  const isDisabled = mode === 'custom' && targetDates.length === 0;

  function handleChange(newMode: RecurrenceMode, newDates: string[]) {
    setMode(newMode);
    setCustomDates(newDates);
  }

  function handleConfirm() {
    if (isDisabled) return;
    onConfirm(targetDates, mode);
  }

  // Button label — reflects mode and resolved count
  const btnLabel = (() => {
    if (mode === 'custom') {
      return targetDates.length === 0
        ? 'Select at least one day'
        : `Add to ${targetDates.length} ${targetDates.length === 1 ? 'day' : 'days'}`;
    }
    if (mode === 'anchor') {
      // Use the pill's label (e.g. "Today" or "Tomorrow") to make the button specific
      const anchorPill = config.pills.find((p) => p.mode === 'anchor');
      return `Add to ${anchorPill?.label.toLowerCase() ?? 'another day'}`;
    }
    if (mode === 'week') return `Add to ${targetDates.length} days`;
    // weekly
    return `Add to ${targetDates.length} ${dowName(config.weekday)}s`;
  })();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-5 pt-5 pb-10 max-w-md mx-auto"
        style={{ backgroundColor: 'var(--color-card)', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-stone-200 mx-auto mb-5" />

        {/* Header */}
        <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-navy)' }}>
          Repeat this food
        </h2>

        {/* Entry summary — read-only */}
        <div
          className="flex items-center justify-between px-3 py-2 rounded-xl mb-4"
          style={{ backgroundColor: 'var(--color-planned-bg)' }}
        >
          <span className="text-sm font-medium text-stone-700 truncate mr-2">
            {entry.ingredientName}
          </span>
          <span className="text-xs text-stone-500 shrink-0">{entry.quantity_g}g</span>
        </div>

        {/* Picker — pills and optional calendar driven by config */}
        <RecurrencePicker
          pills={config.pills}
          anchor={config.anchor}
          value={mode}
          customDates={customDates}
          onChange={handleChange}
        />

        {/* Scope note — honest upper bound on planning horizon */}
        <p className="mt-3 text-xs text-stone-400 leading-snug">
          Schedules up to 30 days from today — which is plenty, let&apos;s be honest.
        </p>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={isDisabled}
          className="mt-5 w-full py-4 rounded-2xl font-semibold text-sm text-white transition-opacity"
          style={{
            backgroundColor: 'var(--color-navy)',
            opacity: isDisabled ? 0.4 : 1,
          }}
        >
          {btnLabel}
        </button>
      </div>
    </>
  );
}
