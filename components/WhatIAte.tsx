// Displays all food entries for the day in two sections:
//   "What I Ate"  — eaten entries, grouped by meal tag (always visible when data exists)
//   "On the menu" — planned entries as a to-do list (visible when Plan Mode is ON)
//
// Planned entries persist in "On the menu" even after being checked off (scratched style),
// so the original plan is always visible alongside actuals. Unchecking restores to planned.

'use client';

import { useState, useRef } from 'react';
import { FoodEntry, MealTag } from '@/lib/types';
import { calculateNutrition } from '@/lib/nutrition';
import EmptyStatePrompt from '@/components/EmptyStatePrompt';
import { useSwipe } from '@/lib/useSwipe';

interface WhatIAteProps {
  entries: FoodEntry[];
  onDelete: (id: string) => void;
  onEdit: (id: string, newQuantity: number) => void;
  onConfirm: (id: string) => void;
  onUnconfirm: (id: string) => void;
  isToday: boolean;
  isFuture: boolean;
  planMode: boolean;
  onAddItem: () => void;
}

const MEAL_ORDER: (MealTag | null)[] = ['Breakfast', 'Lunch', 'Snack', 'Dinner', null];

// Small pencil icon — inline next to the food name
function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M9 1.5L11.5 4L4.5 11H2V8.5L9 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Circular checkbox icon — unchecked (outline) or checked (filled with checkmark)
function CheckboxIcon({ checked }: { checked: boolean }) {
  if (checked) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="8.25" fill="var(--color-navy)" />
        <path d="M5.5 9L7.8 11.5L12.5 6.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="8.25" stroke="var(--color-navy)" strokeWidth="1.5" opacity="0.4" />
    </svg>
  );
}

// ── EntryRow ─────────────────────────────────────────────────────────────────
// Eaten entry row — unchanged from original design.
// isNew flag triggers pop-in animation for freshly confirmed items.

interface EntryRowProps {
  entry: FoodEntry;
  isNew: boolean;
  isEditing: boolean;
  editQty: string;
  onEditQtyChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
}

function EntryRow({
  entry, isNew, isEditing, editQty, onEditQtyChange, onSave, onCancel, onStartEdit, onDelete,
}: EntryRowProps) {
  const swipeHandlers = useSwipe({ onSwipeLeft: onDelete, stopPropagation: true });
  const actual = calculateNutrition(entry.nutrition, entry.quantity_g);

  return (
    <div
      className={`py-2 border-b border-stone-50 last:border-0 ${isNew ? 'animate-pop-in' : ''}`}
      {...swipeHandlers}
    >
      {isEditing ? (
        <div>
          <p className="text-sm font-medium text-stone-800 capitalize mb-2">
            {entry.ingredientName.toLowerCase()}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={editQty}
              onChange={(e) => onEditQtyChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave();
                if (e.key === 'Escape') onCancel();
              }}
              autoFocus
              className="w-16 px-2 py-1 text-sm border border-stone-300 rounded-lg text-center focus:outline-none focus:border-navy"
            />
            <span className="text-xs text-stone-400">g</span>
            <button onClick={onSave} className="text-xs font-semibold ml-1" style={{ color: 'var(--color-navy)' }}>
              Save
            </button>
            <button onClick={onCancel} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-stone-800 truncate capitalize">
                {entry.ingredientName.toLowerCase()}
              </p>
              <button
                onClick={onStartEdit}
                className="text-stone-300 hover:text-stone-500 transition-colors shrink-0"
                aria-label={`Edit ${entry.ingredientName}`}
              >
                <PencilIcon />
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              {entry.quantity_g}g &middot; {actual.calories} kcal &middot; {actual.protein}g protein
            </p>
          </div>
          <button
            onClick={onDelete}
            className="text-stone-300 hover:text-rose-400 transition-colors text-sm leading-none mt-0.5 shrink-0"
            aria-label={`Remove ${entry.ingredientName}`}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ── PlannedEntryRow ───────────────────────────────────────────────────────────
// Planned entry row for "On the menu" section.
// Unchecked = normal style with outline checkbox.
// Checked (eaten) = scratched/strikethrough style with filled checkbox.
// On future dates: checkbox renders but tapping it shows a tooltip instead of confirming.

interface PlannedEntryRowProps {
  entry: FoodEntry;
  isFuture: boolean;
  isScratching: boolean;  // just checked off — triggers animate-scratch
  isEditing: boolean;
  editQty: string;
  onEditQtyChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onConfirm: () => void;
  onUnconfirm: () => void;
}

function PlannedEntryRow({
  entry, isFuture, isScratching, isEditing, editQty, onEditQtyChange,
  onSave, onCancel, onStartEdit, onDelete, onConfirm, onUnconfirm,
}: PlannedEntryRowProps) {
  const swipeHandlers = useSwipe({ onSwipeLeft: onDelete, stopPropagation: true });
  const actual = calculateNutrition(entry.nutrition, entry.quantity_g);
  const isChecked = entry.status === 'eaten';
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCheckboxTap() {
    if (isFuture) {
      // Can't confirm a future planned item — show tooltip instead
      setShowTooltip(true);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      tooltipTimer.current = setTimeout(() => setShowTooltip(false), 2200);
      return;
    }
    if (isChecked) {
      onUnconfirm();
    } else {
      onConfirm();
    }
  }

  // Format the entry date for the tooltip
  function formatEntryDate(dateStr: string): string {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
  }

  return (
    <div
      className={`py-2 border-b border-stone-100 last:border-0 relative ${isScratching ? 'animate-scratch' : ''}`}
      {...swipeHandlers}
    >
      {isEditing ? (
        <div className="pl-7">
          <p className={`text-sm font-medium capitalize mb-2 ${isChecked ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
            {entry.ingredientName.toLowerCase()}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={editQty}
              onChange={(e) => onEditQtyChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave();
                if (e.key === 'Escape') onCancel();
              }}
              autoFocus
              className="w-16 px-2 py-1 text-sm border border-stone-300 rounded-lg text-center focus:outline-none focus:border-navy"
            />
            <span className="text-xs text-stone-400">g</span>
            <button onClick={onSave} className="text-xs font-semibold ml-1" style={{ color: 'var(--color-navy)' }}>
              Save
            </button>
            <button onClick={onCancel} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5">
          {/* Checkbox */}
          <button
            onClick={handleCheckboxTap}
            className={`shrink-0 mt-0.5 transition-opacity ${isFuture ? 'opacity-30 cursor-default' : 'hover:opacity-70'}`}
            aria-label={isChecked ? `Unmark ${entry.ingredientName}` : `Mark ${entry.ingredientName} as eaten`}
          >
            <CheckboxIcon checked={isChecked} />
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className={`text-sm font-medium truncate capitalize transition-all ${
                isChecked ? 'text-stone-400 line-through' : 'text-stone-700'
              }`}>
                {entry.ingredientName.toLowerCase()}
              </p>
              {!isChecked && (
                <button
                  onClick={onStartEdit}
                  className="text-stone-300 hover:text-stone-500 transition-colors shrink-0"
                  aria-label={`Edit ${entry.ingredientName}`}
                >
                  <PencilIcon />
                </button>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${isChecked ? 'text-stone-300' : 'text-stone-400'}`}>
              {entry.quantity_g}g &middot; {actual.calories} kcal &middot; {actual.protein}g protein
            </p>
          </div>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="text-stone-300 hover:text-rose-400 transition-colors text-sm leading-none mt-0.5 shrink-0"
            aria-label={`Remove ${entry.ingredientName}`}
          >
            ×
          </button>
        </div>
      )}

      {/* Future date tooltip */}
      {showTooltip && (
        <div className="absolute left-8 top-full mt-1 z-10 px-3 py-1.5 rounded-lg text-xs text-white shadow-lg animate-pop-in"
          style={{ backgroundColor: 'var(--color-navy)', maxWidth: '200px' }}
        >
          Come back on {formatEntryDate(entry.date)} to mark this as eaten
        </div>
      )}
    </div>
  );
}

// ── WhatIAte ─────────────────────────────────────────────────────────────────

export default function WhatIAte({ entries, onDelete, onEdit, onConfirm, onUnconfirm, isToday: _isToday, isFuture, planMode, onAddItem }: WhatIAteProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  // Track recently confirmed IDs for pop-in animation in "What I Ate"
  const [recentlyConfirmedIds, setRecentlyConfirmedIds] = useState<Set<string>>(new Set());
  // Track recently scratched IDs for animate-scratch in "On the menu"
  const [recentlyScratchedIds, setRecentlyScratchedIds] = useState<Set<string>>(new Set());

  // Eaten entries — shown in "What I Ate"
  const eatenEntries = entries.filter((e) => e.status === 'eaten' || !e.status);
  // Plan-origin entries — shown in "On the menu" (both checked and unchecked)
  const planEntries = entries.filter((e) => e.planOrigin === true);

  function startEdit(entry: FoodEntry) {
    setEditingId(entry.id);
    setEditQty(String(entry.quantity_g));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditQty('');
  }

  function saveEdit(id: string) {
    const qty = Number(editQty);
    if (!editQty || isNaN(qty) || qty <= 0) return;
    onEdit(id, qty);
    setEditingId(null);
    setEditQty('');
  }

  function handleConfirm(id: string) {
    // Trigger scratch animation on the planned row, pop-in on the eaten row
    setRecentlyScratchedIds((prev) => new Set([...prev, id]));
    setRecentlyConfirmedIds((prev) => new Set([...prev, id]));
    onConfirm(id);
    setTimeout(() => {
      setRecentlyScratchedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      setRecentlyConfirmedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, 500);
  }

  function handleUnconfirm(id: string) {
    onUnconfirm(id);
  }

  const groupedEaten = MEAL_ORDER.map((tag) => ({
    tag,
    items: eatenEntries.filter((e) => e.tag === tag),
  })).filter((g) => g.items.length > 0);

  const groupedPlan = MEAL_ORDER.map((tag) => ({
    tag,
    items: planEntries.filter((e) => e.tag === tag),
  })).filter((g) => g.items.length > 0);

  // If no eaten entries and plan mode is off, show the standard empty state
  if (eatenEntries.length === 0 && !planMode) {
    return (
      <div className="bg-card rounded-2xl shadow-sm border border-stone-200 p-8 text-center">
        <EmptyStatePrompt label="Start by adding what you ate" onTap={onAddItem} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── What I Ate ── */}
      {eatenEntries.length > 0 ? (
        <div className="bg-card rounded-2xl shadow-sm border border-stone-200 p-5 space-y-5">
          <p className="text-xs text-stone-400 uppercase tracking-widest font-medium">What I Ate</p>
          {groupedEaten.map(({ tag, items }) => (
            <div key={tag ?? 'untagged'}>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                {tag ?? 'Other'}
              </p>
              <div className="space-y-2">
                {items.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    isNew={recentlyConfirmedIds.has(entry.id)}
                    isEditing={editingId === entry.id}
                    editQty={editQty}
                    onEditQtyChange={setEditQty}
                    onSave={() => saveEdit(entry.id)}
                    onCancel={cancelEdit}
                    onStartEdit={() => startEdit(entry)}
                    onDelete={() => onDelete(entry.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : planMode ? (
        // Eaten section empty but plan mode is on — show a quiet placeholder
        <div className="bg-card rounded-2xl shadow-sm border border-stone-200 p-5">
          <p className="text-xs text-stone-400 uppercase tracking-widest font-medium mb-3">What I Ate</p>
          <p className="text-sm text-stone-300 text-center py-2">Nothing eaten yet today</p>
        </div>
      ) : null}

      {/* ── On the menu ── (Plan Mode only) */}
      {planMode && (
        <div className="bg-planned rounded-2xl shadow-sm border border-stone-200 p-5 space-y-5">
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--color-navy-mid)' }}>
            On the menu
          </p>

          {planEntries.length === 0 ? (
            <EmptyStatePrompt label="Plan a meal" onTap={onAddItem} />
          ) : (
            groupedPlan.map(({ tag, items }) => (
              <div key={tag ?? 'untagged'}>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                  {tag ?? 'Other'}
                </p>
                <div className="space-y-1">
                  {items.map((entry) => (
                    <PlannedEntryRow
                      key={entry.id}
                      entry={entry}
                      isFuture={isFuture}
                      isScratching={recentlyScratchedIds.has(entry.id)}
                      isEditing={editingId === entry.id}
                      editQty={editQty}
                      onEditQtyChange={setEditQty}
                      onSave={() => saveEdit(entry.id)}
                      onCancel={cancelEdit}
                      onStartEdit={() => startEdit(entry)}
                      onDelete={() => onDelete(entry.id)}
                      onConfirm={() => handleConfirm(entry.id)}
                      onUnconfirm={() => handleUnconfirm(entry.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
