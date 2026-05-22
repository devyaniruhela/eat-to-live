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
import RepeatSheet from '@/components/RepeatSheet';
import { toDateString } from '@/lib/storage';
import { RecurrenceMode } from '@/lib/types';

interface WhatIAteProps {
  entries: FoodEntry[];
  onDelete: (id: string) => void;
  onEdit: (id: string, newQuantity: number) => void;
  onConfirm: (id: string) => void;
  onUnconfirm: (id: string) => void;
  onRepeat: (entry: FoodEntry, dates: string[], mode: RecurrenceMode) => void;
  isToday: boolean;
  isFuture: boolean;
  // isPast is required so plan-related UI (On the menu, plan-mode placeholders)
  // can be suppressed on past dates regardless of the global planMode toggle state.
  isPast: boolean;
  planMode: boolean;
  onAddItem: () => void;
}

const MEAL_ORDER: (MealTag | null)[] = ['Breakfast', 'Lunch', 'Snack', 'Dinner', null];

// Two-cards-with-plus icon — matches the "Repeat this food" CTA in AddEntryModal
function RepeatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="2" width="13" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="3" y="6" width="13" height="16" rx="2.5" fill="var(--color-card)" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M9.5 14h4M11.5 12v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

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
  onRepeat: () => void;
}

function EntryRow({
  entry, isNew, isEditing, editQty, onEditQtyChange, onSave, onCancel, onStartEdit, onDelete, onRepeat,
}: EntryRowProps) {
  // Ref for the sliding content layer — manipulated directly during drag to avoid re-renders
  const rowRef = useRef<HTMLDivElement>(null);

  // Called each touchmove frame — slides the content left to reveal the red panel
  function handleDragProgress(dx: number) {
    if (dx >= 0 || !rowRef.current) return;
    rowRef.current.style.transition = 'none';
    // Cap at -80px so the trash icon is fully visible before the threshold
    rowRef.current.style.transform = `translateX(${Math.max(dx, -80)}px)`;
  }

  // Snap back with a short ease-out when the swipe doesn't reach the threshold
  function handleDragCancel() {
    if (!rowRef.current) return;
    rowRef.current.style.transition = 'transform 200ms ease-out';
    rowRef.current.style.transform = 'translateX(0)';
  }

  // Slide fully off-screen then fire delete so the parent can remove the entry
  function handleSwipeDelete() {
    if (!rowRef.current) return;
    rowRef.current.style.transition = 'transform 180ms ease-in';
    rowRef.current.style.transform = 'translateX(-110%)';
    setTimeout(onDelete, 180);
  }

  // Swipe-to-delete is temporarily disabled — uncomment the three lines below to re-enable.
  const swipeHandlers = useSwipe({
    // onSwipeLeft: handleSwipeDelete,
    stopPropagation: true,
    // onSwipeProgress: handleDragProgress,
    // onSwipeCancel: handleDragCancel,
    hapticMs: 80,
  });
  const actual = calculateNutrition(entry.nutrition, entry.quantity_g);

  return (
    // Outer wrapper clips the sliding content so the red panel doesn't overflow the card
    <div className={`relative overflow-hidden border-b border-stone-50 last:border-0 ${isNew ? 'animate-pop-in' : ''}`}>
      {/* Red delete panel — sits behind the content, revealed as the row slides left */}
      <div
        className="absolute inset-0 flex items-center justify-end px-4"
        style={{ backgroundColor: 'var(--color-rose)' }}
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M6 4V2.5A.5.5 0 016.5 2h3a.5.5 0 01.5.5V4M13 4l-.867 8.664A1 1 0 0111.14 13.6H4.86a1 1 0 01-.993-.936L3 4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {/* Sliding content layer */}
      <div ref={rowRef} className="relative py-2" style={{ backgroundColor: 'var(--color-card)' }} {...swipeHandlers}
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
          {/* ↺ and × action buttons — repeat opens the "Eat this again" sheet */}
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            <button
              onClick={onRepeat}
              className="text-stone-300 hover:text-stone-500 transition-colors"
              aria-label={`Eat ${entry.ingredientName} again`}
            >
              <RepeatIcon />
            </button>
            <button
              onClick={onDelete}
              className="text-stone-300 hover:text-rose-400 transition-colors text-sm leading-none"
              aria-label={`Remove ${entry.ingredientName}`}
            >
              ×
            </button>
          </div>
        </div>
      )}
      </div>{/* end sliding content layer */}
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
  onRepeat: () => void;
}

function PlannedEntryRow({
  entry, isFuture, isScratching, isEditing, editQty, onEditQtyChange,
  onSave, onCancel, onStartEdit, onDelete, onConfirm, onUnconfirm, onRepeat,
}: PlannedEntryRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  function handleDragProgress(dx: number) {
    if (dx >= 0 || !rowRef.current) return;
    rowRef.current.style.transition = 'none';
    rowRef.current.style.transform = `translateX(${Math.max(dx, -80)}px)`;
  }

  function handleDragCancel() {
    if (!rowRef.current) return;
    rowRef.current.style.transition = 'transform 200ms ease-out';
    rowRef.current.style.transform = 'translateX(0)';
  }

  function handleSwipeDelete() {
    if (!rowRef.current) return;
    rowRef.current.style.transition = 'transform 180ms ease-in';
    rowRef.current.style.transform = 'translateX(-110%)';
    setTimeout(onDelete, 180);
  }

  // Swipe-to-delete is temporarily disabled — uncomment the three lines below to re-enable.
  const swipeHandlers = useSwipe({
    // onSwipeLeft: handleSwipeDelete,
    stopPropagation: true,
    // onSwipeProgress: handleDragProgress,
    // onSwipeCancel: handleDragCancel,
    hapticMs: 80,
  });
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
    <div className="relative overflow-hidden border-b border-stone-100 last:border-0">
      {/* Red delete panel — revealed as the content slides left on swipe */}
      <div
        className="absolute inset-0 flex items-center justify-end px-4"
        style={{ backgroundColor: 'var(--color-rose)' }}
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M6 4V2.5A.5.5 0 016.5 2h3a.5.5 0 01.5.5V4M13 4l-.867 8.664A1 1 0 0111.14 13.6H4.86a1 1 0 01-.993-.936L3 4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {/* Sliding content layer — must match the "On the menu" section background, not the card white.
          animate-scratch is applied to an inner wrapper, NOT this div, so the background colour stays
          fully opaque during the fade — otherwise the red delete panel bleeds through. */}
      <div
        ref={rowRef}
        className="relative py-2"
        style={{ backgroundColor: 'var(--color-planned-bg)' }}
        {...swipeHandlers}
      >
      {/* Inner wrapper fades for scratch animation; outer wrapper keeps background solid */}
      <div className={isScratching ? 'animate-scratch' : ''}>
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

          {/* Repeat + Delete */}
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            <button
              onClick={onRepeat}
              className="text-stone-300 hover:text-stone-500 transition-colors"
              aria-label={`Repeat ${entry.ingredientName}`}
            >
              <RepeatIcon />
            </button>
            <button
              onClick={onDelete}
              className="text-stone-300 hover:text-rose-400 transition-colors text-sm leading-none"
              aria-label={`Remove ${entry.ingredientName}`}
            >
              ×
            </button>
          </div>
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
      </div>{/* end animate-scratch inner wrapper */}
      </div>{/* end sliding content layer */}
    </div>
  );
}

// ── WhatIAte ─────────────────────────────────────────────────────────────────

export default function WhatIAte({ entries, onDelete, onEdit, onConfirm, onUnconfirm, onRepeat, isToday: _isToday, isFuture, isPast, planMode, onAddItem }: WhatIAteProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  // Track recently confirmed IDs for pop-in animation in "What I Ate"
  const [recentlyConfirmedIds, setRecentlyConfirmedIds] = useState<Set<string>>(new Set());
  // Track recently scratched IDs for animate-scratch in "On the menu"
  const [recentlyScratchedIds, setRecentlyScratchedIds] = useState<Set<string>>(new Set());
  // Entry being repeated — opens RepeatSheet when non-null
  const [repeatEntry, setRepeatEntry] = useState<FoodEntry | null>(null);
  const todayStr = toDateString(new Date());

  // Eaten entries — shown in "What I Ate"
  const eatenEntries = entries.filter((e) => e.status === 'eaten' || !e.status);
  // Plan-origin entries — shown in "On the menu" (both checked and unchecked)
  const planEntries = entries.filter((e) => e.planOrigin === true);

  // Controls whether the "On the menu" section renders at all.
  // planMode is global state that stays true when the user navigates to past dates,
  // so every plan-related render must go through this single derived flag.
  //
  // Past date: show the section only if planned entries already exist (user can check
  //            them off, but cannot add new ones — no CTA shown inside).
  // Today / future: show the section whenever plan mode is on (empty state + CTA included).
  const showPlanSection = planMode && (!isPast || planEntries.length > 0);

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

  // Show the standard empty state when there's nothing eaten and no plan section to show
  if (eatenEntries.length === 0 && !showPlanSection) {
    return (
      <div className="bg-card rounded-2xl shadow-sm border border-stone-200 p-8 text-center">
        <EmptyStatePrompt label="Start by adding what you ate" onTap={onAddItem} />
      </div>
    );
  }

  return (
    <>
    {/* RepeatSheet — rendered at root level so it can overlay the full screen */}
    {repeatEntry && (
      <RepeatSheet
        entry={repeatEntry}
        todayStr={todayStr}
        onConfirm={(dates, mode) => {
          onRepeat(repeatEntry, dates, mode);
          setRepeatEntry(null);
        }}
        onClose={() => setRepeatEntry(null)}
      />
    )}
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
                    onRepeat={() => setRepeatEntry(entry)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : showPlanSection ? (
        // Eaten section empty but plan section is visible — show a quiet placeholder
        <div className="bg-card rounded-2xl shadow-sm border border-stone-200 p-5">
          <p className="text-xs text-stone-400 uppercase tracking-widest font-medium mb-3">What I Ate</p>
          <p className="text-sm text-stone-300 text-center py-2">Nothing logged yet</p>
        </div>
      ) : null}

      {/* ── On the menu ──
           Shown when plan mode is ON and either:
           - today / future (always, even if empty — "Plan a meal" CTA is the point)
           - past date with existing planned entries (check-off only, no CTA) */}
      {showPlanSection && (
        <div className="bg-planned rounded-2xl shadow-sm border border-stone-200 p-5 space-y-5">
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--color-navy-mid)' }}>
            On the menu
          </p>

          {planEntries.length === 0 ? (
            // Only reachable on today / future (showPlanSection hides past-date empty state)
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
                      onRepeat={() => setRepeatEntry(entry)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
    </>
  );
}
