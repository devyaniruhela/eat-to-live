// 7-day nutrition insights card shown at the top of the detailed summary screen.
// Styled as a journal planner card: solid navy header strip, off-white paper-textured body,
// navy border. The paper texture is applied via the .paper-card CSS class (globals.css).
// All calculated values only shown when every one of the 7 days has at least one entry.

import { WeeklyAggregate } from '@/lib/nutrition';

interface WeeklyInsightsProps {
  aggregate: WeeklyAggregate;
}

export default function WeeklyInsights({ aggregate }: WeeklyInsightsProps) {
  const { allDaysPresent, avgCalories, avgProtein, avgWaterL, missingNutrients } = aggregate;

  return (
    <div
      style={{
        border: '1.5px solid var(--color-navy-mid)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      {/* Header strip */}
      <div
        className="px-5 py-3"
        style={{ backgroundColor: 'var(--color-navy-mid)' }}
      >
        <p className="text-sm font-semibold text-white tracking-wide">
          Last 7 days
        </p>
      </div>

      {/* Body */}
      <div
        className="px-5 py-4"
        style={{ backgroundColor: 'var(--color-card)' }}
      >
        {/* Avg calories, protein, water — 3 columns */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Avg cal</p>
            <p className="text-lg font-bold text-stone-800 leading-none">
              {allDaysPresent ? (
                <>
                  {avgCalories}
                  <span className="text-xs font-normal text-stone-400 ml-0.5">kcal</span>
                </>
              ) : '–'}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Avg protein</p>
            <p className="text-lg font-bold text-stone-800 leading-none">
              {allDaysPresent ? (
                <>
                  {avgProtein}
                  <span className="text-xs font-normal text-stone-400 ml-0.5">g</span>
                </>
              ) : '–'}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Avg water</p>
            <p className="text-lg font-bold text-stone-800 leading-none">
              {allDaysPresent ? (
                <>
                  {avgWaterL}
                  <span className="text-xs font-normal text-stone-400 ml-0.5">L</span>
                </>
              ) : '–'}
            </p>
          </div>
        </div>

        {/* Missing nutrients — only when all 7 days have data */}
        {allDaysPresent && missingNutrients.length > 0 && (
          <div className="border-t border-stone-200 pt-3 mb-3">
            <p className="text-xs text-stone-400 mb-1">Not logged this week</p>
            <p className="text-xs text-stone-600">{missingNutrients.join(', ')}</p>
          </div>
        )}

        {/* Tip — shown when not all 7 days have data */}
        {!allDaysPresent && (
          <div className="flex items-start gap-2 mb-3">
            {/* Info circle icon */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0" style={{ color: 'var(--color-navy-mid)' }} aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 7.5v3.5M8 5v.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-xs font-medium text-stone-600 leading-snug">
              Log what you ate for all 7 days to unlock your weekly averages.
            </p>
          </div>
        )}

        {/* Disclaimer — only shown when 7-day values are present */}
        {allDaysPresent && (
          <p className="text-xs text-stone-400 leading-snug italic">
            * Calculated from logged entries. Add complete meals for accurate values.
          </p>
        )}
      </div>
    </div>
  );
}
