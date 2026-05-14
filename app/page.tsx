// Homepage — the daily nutrition journal page.
// Renders the date navigation, macro summary, water log, and food entries list.
// All state (entries, water, selected date) lives here and is passed down to components.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSwipe } from '@/lib/useSwipe';
import DailySummary from '@/components/DailySummary';
import WhatIAte from '@/components/WhatIAte';
import WaterLog from '@/components/WaterLog';
import AddEntryModal from '@/components/AddEntryModal';
import SearchScreen from '@/components/SearchScreen';
import SuccessToast from '@/components/SuccessToast';
import {
  getEntriesForDate,
  saveEntry,
  deleteEntry,
  updateEntry,
  confirmEntry,
  unconfirmEntry,
  getWaterForDate,
  saveWaterEntry,
  setWaterForDate,
  toDateString,
  generateId,
} from '@/lib/storage';
import { EntryStatus, FoodEntry, FoodSearchResult, MealTag, RecurrenceMode, WaterEntry } from '@/lib/types';

// Day-of-week name lookup — used to build repeat toast copy
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function HomePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [waterMl, setWaterMl] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  // Plan Mode — starts false to match SSR, then syncs from sessionStorage after hydration.
  // Using useEffect (not lazy useState) avoids the SSR/client mismatch that occurs when
  // sessionStorage is read during render — server always sees false, client may see true.
  const [planMode, setPlanMode] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('planMode') === 'true') setPlanMode(true);
  }, []);

  useEffect(() => {
    sessionStorage.setItem('planMode', String(planMode));
  }, [planMode]);

  // Success toast — { heading, subtitle, repeatLine? } when visible, null when hidden.
  // Auto-dismisses after 2.5s; fireToast always resets the timer so rapid saves only show one toast.
  const [toast, setToast] = useState<{ heading: string; subtitle: string; repeatLine?: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fireToast(heading: string, subtitle: string, repeatLine?: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ heading, subtitle, repeatLine });
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }

  const dateStr = toDateString(currentDate);
  const todayStr = toDateString(new Date());
  const isToday = dateStr === todayStr;
  // A date is "future" if it is strictly after today
  const isFuture = dateStr > todayStr;
  // A date is "past" if it is strictly before today
  const isPast = dateStr < todayStr;

  // Load entries and water from localStorage whenever the selected date changes
  const loadDayData = useCallback(() => {
    setEntries(getEntriesForDate(dateStr));
    setWaterMl(getWaterForDate(dateStr));
  }, [dateStr]);

  useEffect(() => {
    loadDayData();
  }, [loadDayData]);

  // Navigate to the previous day
  function goToPrevDay() {
    setCurrentDate((d) => {
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 1);
      return prev;
    });
  }

  // Navigate to the next day.
  // Plan Mode OFF: blocked at today. Plan Mode ON: allowed up to +14 days ahead.
  function goToNextDay() {
    setCurrentDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const limit = new Date();
      limit.setDate(limit.getDate() + (planMode ? 14 : 0));
      limit.setHours(23, 59, 59, 999);
      if (next > limit) return d;
      return next;
    });
  }

  // Called when user saves a new food entry from the modal.
  // status and planOrigin are passed through from AddEntryModal — defaults cover
  // legacy callers (e.g. SearchScreen before PM-5 updates its signature).
  function handleSaveEntry(
    food: FoodSearchResult,
    quantity: number,
    tag: MealTag | null,
    status: EntryStatus = 'eaten',
    planOrigin: boolean = false,
    targetDate?: string,   // optional override — used by Search "Add to plan" date picker
  ) {
    const entry: FoodEntry = {
      id: generateId(),
      date: targetDate ?? dateStr,
      ingredientName: food.name,
      quantity_g: quantity,
      tag,
      nutrition: food.nutrition, // stored per 100g; calculations happen at display time
      status,
      planOrigin,
    };
    saveEntry(entry);
    setShowAddModal(false);
    loadDayData();
  }

  // Called when user taps the delete (×) button on an entry
  function handleDeleteEntry(id: string) {
    deleteEntry(id);
    loadDayData();
  }

  // Called when user saves an edited quantity for an existing entry
  function handleUpdateEntry(id: string, newQuantity: number) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    updateEntry({ ...entry, quantity_g: newQuantity });
    loadDayData();
  }

  // Called when user taps the checkbox on a planned entry row — marks it as eaten
  function handleConfirmEntry(id: string) {
    confirmEntry(id);
    loadDayData();
  }

  // Called when user unchecks a scratched entry in "On the menu" — reverts to planned
  function handleUnconfirmEntry(id: string) {
    unconfirmEntry(id);
    loadDayData();
  }

  // Called by AddEntryModal once after all saves complete — fires the success toast.
  // mode='anchor' + dateCount=1 means a plain single-date add; other modes are from "Repeat this food".
  // repeatLine, when present, is added as the toast's third line.
  function handleAddDone({ itemName, status, repeatLine }: {
    itemName: string; mode: RecurrenceMode; dateCount: number; status: EntryStatus; repeatLine?: string;
  }) {
    const name = itemName.toLowerCase();
    // Heading reflects the primary action (adding to plate or plan)
    let heading: string;
    if (status === 'planned') {
      heading = 'Added to meal plan!';
    } else if (dateStr === todayStr) {
      heading = "Added to today's plate!";
    } else {
      heading = "Added to your plate!";
    }
    fireToast(heading, name, repeatLine);
  }

  // Called when user confirms dates in RepeatSheet (↺ path).
  // Generates one FoodEntry per date, applying the state rule:
  //   - Future dates → always status:'planned', planOrigin:true
  //   - Today or past → retains the source entry's status and planOrigin
  function handleRepeatEntry(sourceEntry: FoodEntry, dates: string[], mode: RecurrenceMode) {
    for (const date of dates) {
      const isFutureDate = date > todayStr;
      const entry: FoodEntry = {
        ...sourceEntry,
        id: generateId(),
        date,
        status: isFutureDate ? 'planned' : (sourceEntry.status ?? 'eaten'),
        planOrigin: isFutureDate ? true : (sourceEntry.planOrigin ?? false),
      };
      saveEntry(entry);
    }
    loadDayData();
    // Toast — describe what was repeated (mode now uses 'anchor'/'week' instead of 'today'/'daily')
    const name = sourceEntry.ingredientName.toLowerCase();
    if (mode === 'weekly' && dates.length > 0) {
      const [y, m, d] = dates[0].split('-').map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      fireToast(`Repeating every ${DOW_NAMES[dow]}!`, name);
    } else if (mode === 'anchor') {
      // Single date — anchor was "Today" or "Tomorrow"
      fireToast('Repeated!', name);
    } else {
      // 'week' or 'custom' — multiple dates
      fireToast(`Repeated for ${dates.length} days!`, name);
    }
  }

  // Called when user edits the water total directly from the summary
  function handleSetWater(ml: number) {
    setWaterForDate(dateStr, ml);
    setWaterMl(ml);
  }

  // Toggles Plan Mode on/off.
  // When toggling OFF while on a future date, snaps back to today to avoid
  // showing future dates without the ability to navigate to them intentionally.
  function handleTogglePlanMode() {
    const turningOff = planMode;
    setPlanMode((prev) => !prev);
    if (turningOff && isFuture) {
      setCurrentDate(new Date());
    }
  }

  // Called when user taps a water quick-add button
  function handleAddWater(ml: number) {
    const entry: WaterEntry = {
      id: generateId(),
      date: dateStr,
      quantity_ml: ml,
    };
    saveWaterEntry(entry);
    setWaterMl((prev) => prev + ml);
  }

  // Swipe left = next day, swipe right = prev day — same as the arrow buttons
  // 60ms haptic pulse on date swipe — lighter than delete (navigation, not destruction)
  const swipeHandlers = useSwipe({ onSwipeLeft: goToNextDay, onSwipeRight: goToPrevDay, hapticMs: 60 });

  return (
    <div className={`max-w-md mx-auto px-4 pb-36 ${isFuture ? 'future-plan-tint' : ''}`} {...swipeHandlers}>
      {/* Header — wordmark with icon */}
      <header className="pt-10 pb-6">
        <div className="flex items-center gap-3">
          {/* Navy wrapper + screen blend: black pixels in PNG become navy, white stays white */}
          <div
            className="rounded-xl overflow-hidden shrink-0 relative -top-2"
            style={{ width: 48, height: 48, backgroundColor: 'var(--color-navy)' }}
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" width={48} height={48} style={{ mixBlendMode: 'screen', display: 'block' }} />
          </div>
          <div>
            <h1
              className="text-3xl leading-tight"
              style={{ fontFamily: 'var(--font-homemade-apple)', color: 'var(--color-navy)' }}
            >
              Eat to live
            </h1>
            <p className="text-xs text-stone-400 -mt-1">Personal nutrition journal</p>
          </div>
        </div>
      </header>

      {/* Main content — stacked cards */}
      <div className="space-y-4">
        <DailySummary
          entries={entries}
          waterMl={waterMl}
          date={currentDate}
          onPrevDay={goToPrevDay}
          onNextDay={goToNextDay}
          onEditWater={handleSetWater}
          planMode={planMode}
          isFuture={isFuture}
        />

        <WaterLog onAdd={handleAddWater} />

        <WhatIAte
          entries={entries}
          onDelete={handleDeleteEntry}
          onEdit={handleUpdateEntry}
          onConfirm={handleConfirmEntry}
          onUnconfirm={handleUnconfirmEntry}
          onRepeat={handleRepeatEntry}
          isToday={isToday}
          isFuture={isFuture}
          isPast={isPast}
          planMode={planMode}
          onAddItem={() => setShowAddModal(true)}
        />
      </div>

      {/* Sticky bottom action bar — Plan Mode toggle (optional) + Search + Add Entry */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4 bg-gradient-to-t from-[var(--color-background)] to-transparent">
        <div className="max-w-md mx-auto space-y-2">

          {/* Plan Mode toggle strip — full width, same as buttons below; hidden on past dates */}
          {!isPast && (
            <div
              className="flex items-center justify-between px-4 py-2 rounded-2xl transition-colors"
              style={{ backgroundColor: planMode ? 'var(--color-planned-bg)' : 'rgba(81,101,144,0.06)' }}
            >
              <span
                className="text-xs font-semibold"
                style={{ color: planMode ? 'var(--color-navy)' : 'var(--color-navy-mid)' }}
              >
                Plan my meals
              </span>
              {/* iOS-style toggle switch */}
              <button
                onClick={handleTogglePlanMode}
                role="switch"
                aria-checked={planMode}
                aria-label="Toggle plan mode"
                className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none"
                style={{ backgroundColor: planMode ? 'var(--color-navy)' : '#b8c3d8' }}
              >
                <span
                  className="block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: planMode ? 'translateX(22px)' : 'translateX(4px)' }}
                />
              </button>
            </div>
          )}

          {/* Search + Add buttons */}
          <div className="flex gap-3">
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
      </div>

      {/* Add entry modal */}
      {showAddModal && (
        <AddEntryModal
          onSave={handleSaveEntry}
          onSaveDone={handleAddDone}
          onClose={() => setShowAddModal(false)}
          planMode={planMode}
          isFuture={isFuture}
          isPast={isPast}
          viewingDate={dateStr}
        />
      )}

      {/* Search / ingredient lookup screen */}
      {/* targetDate is always today — Search is date-agnostic; "Add to plate" always logs to today */}
      {showSearch && (
        <SearchScreen
          onClose={() => setShowSearch(false)}
          onSave={handleSaveEntry}
          targetDate={toDateString(new Date())}
          planMode={planMode}
          onEnablePlanMode={() => setPlanMode(true)}
        />
      )}

      {/* Success toast — shown after any add or repeat action; auto-dismisses after 2.5s */}
      {toast && (
        <SuccessToast
          itemName=""
          targetDate={todayStr}
          heading={toast.heading}
          subtitle={toast.subtitle}
          repeatLine={toast.repeatLine}
        />
      )}
    </div>
  );
}
