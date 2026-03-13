// Homepage — the daily nutrition journal page.
// Renders the date navigation, macro summary, water log, and food entries list.
// All state (entries, water, selected date) lives here and is passed down to components.

'use client';

import { useState, useEffect, useCallback } from 'react';
import DailySummary from '@/components/DailySummary';
import WhatIAte from '@/components/WhatIAte';
import WaterLog from '@/components/WaterLog';
import AddEntryModal from '@/components/AddEntryModal';
import {
  getEntriesForDate,
  saveEntry,
  deleteEntry,
  getWaterForDate,
  saveWaterEntry,
  toDateString,
  generateId,
} from '@/lib/storage';
import { FoodEntry, FoodSearchResult, MealTag, WaterEntry } from '@/lib/types';

export default function HomePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [waterMl, setWaterMl] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

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
          {/* App icon: navy circle, white fork, rose bar chart, dusty-rose leaves */}
          <svg viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" width={36} height={43} aria-hidden="true">
            {/* Navy background circle */}
            <circle cx="20" cy="30" r="17" fill="#1a2744" />
            {/* Fork tines — three white prongs */}
            <rect x="12.5" y="15" width="2.5" height="11" rx="1.25" fill="#faf9f6" />
            <rect x="18.75" y="15" width="2.5" height="11" rx="1.25" fill="#faf9f6" />
            <rect x="25" y="15" width="2.5" height="11" rx="1.25" fill="#faf9f6" />
            {/* Fork base connector */}
            <rect x="14" y="26" width="12" height="2.5" rx="1" fill="#faf9f6" />
            {/* Fork handle */}
            <rect x="18" y="28" width="4" height="13" rx="2" fill="#faf9f6" />
            {/* Bar chart bars on tines — rose accent, varying heights */}
            <rect x="13.25" y="20" width="1.5" height="6" rx="0.75" fill="#c87080" />
            <rect x="19.5" y="17" width="1.5" height="9" rx="0.75" fill="#c87080" />
            <rect x="25.75" y="18.5" width="1.5" height="7.5" rx="0.75" fill="#c87080" />
            {/* Leaves — dusty rose, curving outward above tines */}
            <path d="M18 16 C17 12 13 9 15 5 C17 8 18 12 18 16Z" fill="#d4848a" />
            <path d="M22 16 C23 12 27 9 25 5 C23 8 22 12 22 16Z" fill="#d4848a" />
          </svg>
          <div>
            <h1
              className="text-3xl leading-tight"
              style={{ fontFamily: 'var(--font-homemade-apple)', color: 'var(--color-navy)' }}
            >
              Eat to live
            </h1>
            <p className="text-sm text-stone-400">Personal nutrition journal</p>
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
        />

        <WaterLog onAdd={handleAddWater} />

        <WhatIAte entries={entries} onDelete={handleDeleteEntry} isToday={isToday} />
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4 bg-gradient-to-t from-[#faf9f6] to-transparent">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full py-4 rounded-2xl font-semibold text-sm text-white shadow-lg transition-opacity hover:opacity-90 active:opacity-80"
            style={{ backgroundColor: 'var(--color-navy)' }}
          >
            + Add Entry
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
    </div>
  );
}
