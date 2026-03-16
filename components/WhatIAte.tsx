// Displays all food entries for the day, grouped by meal tag.
// Order is always: Breakfast → Lunch → Snack → Dinner → Untagged
// Each entry has an inline edit (quantity) and delete action.
// Swiping left on a row deletes it — same as tapping the × button.

'use client';

import { useState } from 'react';
import { FoodEntry, MealTag } from '@/lib/types';
import { calculateNutrition } from '@/lib/nutrition';
import EmptyStatePrompt from '@/components/EmptyStatePrompt';
import { useSwipe } from '@/lib/useSwipe';

interface WhatIAteProps {
  entries: FoodEntry[];
  onDelete: (id: string) => void;
  onEdit: (id: string, newQuantity: number) => void;
  isToday: boolean;
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

// ── EntryRow ─────────────────────────────────────────────────────────────────
// Extracted so useSwipe can be called at the component level (hooks can't go
// inside .map()). stopPropagation: true prevents the row swipe from bubbling
// to the page-level date-swipe handler.

interface EntryRowProps {
  entry: FoodEntry;
  isEditing: boolean;
  editQty: string;
  onEditQtyChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
}

function EntryRow({
  entry, isEditing, editQty, onEditQtyChange, onSave, onCancel, onStartEdit, onDelete,
}: EntryRowProps) {
  const swipeHandlers = useSwipe({ onSwipeLeft: onDelete, stopPropagation: true });
  const actual = calculateNutrition(entry.nutrition, entry.quantity_g);

  return (
    <div key={entry.id} className="py-2 border-b border-stone-50 last:border-0" {...swipeHandlers}>
      {isEditing ? (
        // ── Edit state ──────────────────────────────────────────────────────
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
            <button
              onClick={onSave}
              className="text-xs font-semibold ml-1"
              style={{ color: 'var(--color-navy)' }}
            >
              Save
            </button>
            <button onClick={onCancel} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        // ── Normal state ────────────────────────────────────────────────────
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

// ── WhatIAte ─────────────────────────────────────────────────────────────────

export default function WhatIAte({ entries, onDelete, onEdit, isToday, onAddItem }: WhatIAteProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');

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

  if (entries.length === 0) {
    return (
      <div className="bg-card rounded-2xl shadow-sm border border-stone-200 p-8 text-center">
        <EmptyStatePrompt label="Start by adding what you ate" onTap={onAddItem} />
      </div>
    );
  }

  const grouped = MEAL_ORDER.map((tag) => ({
    tag,
    items: entries.filter((e) => e.tag === tag),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-stone-200 p-5 space-y-5">
      <p className="text-xs text-stone-400 uppercase tracking-widest font-medium">
        What I Ate
      </p>

      {grouped.map(({ tag, items }) => (
        <div key={tag ?? 'untagged'}>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
            {tag ?? 'Other'}
          </p>

          <div className="space-y-2">
            {items.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
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
  );
}
