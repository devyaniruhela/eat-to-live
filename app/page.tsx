// Homepage — the daily nutrition journal page.
// Renders the date navigation, macro summary, water log, and food entries list.
// All state (entries, water, selected date) lives here and is passed down to components.

'use client';

import { useState, useEffect, useCallback } from 'react';
import DailySummary from '@/components/DailySummary';
import WhatIAte from '@/components/WhatIAte';
import WaterLog from '@/components/WaterLog';
import AddEntryModal from '@/components/AddEntryModal';
import SearchScreen from '@/components/SearchScreen';
import {
  getEntriesForDate,
  saveEntry,
  deleteEntry,
  updateEntry,
  getWaterForDate,
  saveWaterEntry,
  setWaterForDate,
  toDateString,
  generateId,
} from '@/lib/storage';
import { FoodEntry, FoodSearchResult, MealTag, WaterEntry } from '@/lib/types';

export default function HomePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [waterMl, setWaterMl] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const dateStr = toDateString(currentDate);
  const isToday = dateStr === toDateString(new Date());

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

  // Navigate to the next day — blocked if it would go into the future
  function goToNextDay() {
    setCurrentDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (next > today) return d;
      return next;
    });
  }

  // Called when user saves a new food entry from the modal
  function handleSaveEntry(
    food: FoodSearchResult,
    quantity: number,
    tag: MealTag | null
  ) {
    const entry: FoodEntry = {
      id: generateId(),
      date: dateStr,
      ingredientName: food.name,
      quantity_g: quantity,
      tag,
      nutrition: food.nutrition, // stored per 100g; calculations happen at display time
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

  // Called when user edits the water total directly from the summary
  function handleSetWater(ml: number) {
    setWaterForDate(dateStr, ml);
    setWaterMl(ml);
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

  return (
    <div className="max-w-md mx-auto px-4 pb-24">
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
        />

        <WaterLog onAdd={handleAddWater} />

        <WhatIAte entries={entries} onDelete={handleDeleteEntry} onEdit={handleUpdateEntry} isToday={isToday} />
      </div>

      {/* Sticky bottom action bar — Search (secondary, left) + Add Entry (primary, right) */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4 bg-gradient-to-t from-[#faf9f6] to-transparent">
        <div className="max-w-md mx-auto flex gap-3">
          <button
            onClick={() => setShowSearch(true)}
            className="flex-1 py-4 rounded-2xl font-semibold text-sm shadow-sm transition-colors border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 active:bg-stone-100 flex items-center justify-center gap-2"
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

      {/* Add entry modal */}
      {showAddModal && (
        <AddEntryModal
          onSave={handleSaveEntry}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Search / ingredient lookup screen */}
      {showSearch && (
        <SearchScreen onClose={() => setShowSearch(false)} />
      )}
    </div>
  );
}
