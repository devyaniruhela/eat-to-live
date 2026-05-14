// Success toast shown after adding or repeating an item.
// Default mode: date-aware plate message ("Added to today's plate!" etc.)
// Override mode: pass heading + subtitle directly for repeat confirmations.
// repeatLine, when present, shows as a third line describing the repeat schedule.
// Auto-dismiss is handled by the parent via state — this component is purely presentational.

import { toDateString } from '@/lib/storage';

interface SuccessToastProps {
  itemName: string;
  // YYYY-MM-DD of the date the item was saved to — only used when heading is not provided
  targetDate: string;
  // Optional overrides — when provided, skip the date-aware copy entirely
  heading?: string;
  subtitle?: string;
  // Optional third line describing the repeat schedule (e.g. "Also saved for 6 more days")
  repeatLine?: string;
}

// Returns the header message and item subtitle based on the target date.
// today     → { heading: "Added to today's plate!",     subtitle: itemName }
// yesterday → { heading: "Added to yesterday's plate!", subtitle: itemName }
// other     → { heading: "Added to your plate!",        subtitle: "<itemName> on 14 March" }
function getToastContent(itemName: string, targetDate: string): { heading: string; subtitle: string } {
  const todayStr = toDateString(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toDateString(yesterday);

  const name = itemName.toLowerCase();

  if (targetDate === todayStr) {
    return { heading: "Added to today's plate!", subtitle: name };
  }
  if (targetDate === yesterdayStr) {
    return { heading: "Added to yesterday's plate!", subtitle: name };
  }
  const d = new Date(`${targetDate}T12:00:00`);
  const dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
  return { heading: "Added to your plate!", subtitle: `${name} on ${dateLabel}` };
}

export default function SuccessToast({ itemName, targetDate, heading: headingProp, subtitle: subtitleProp, repeatLine }: SuccessToastProps) {
  // Use overrides when provided (repeat flows); fall back to date-aware copy (add flows)
  const { heading, subtitle } = headingProp && subtitleProp
    ? { heading: headingProp, subtitle: subtitleProp }
    : getToastContent(itemName, targetDate);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-8 pointer-events-none">
      <div
        className="animate-pop-in rounded-2xl shadow-2xl px-8 py-7 flex flex-col items-center gap-4 w-full max-w-xs"
        style={{ backgroundColor: 'var(--color-card)' }}
      >
        {/* Plate illustration with checkmark badge */}
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
          {/* Outer plate rim */}
          <circle cx="37" cy="36" r="25" stroke="var(--color-navy-mid)" strokeWidth="1.8" />
          {/* Inner plate detail ring */}
          <circle cx="37" cy="36" r="16" stroke="var(--color-navy-mid)" strokeWidth="1" opacity="0.3" />
          {/* Fork — left of plate */}
          <line x1="7"  y1="22" x2="7"  y2="50" stroke="var(--color-navy-mid)" strokeWidth="1.7" strokeLinecap="round" />
          <line x1="4"  y1="14" x2="4"  y2="22" stroke="var(--color-navy-mid)" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="7"  y1="14" x2="7"  y2="22" stroke="var(--color-navy-mid)" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="10" y1="14" x2="10" y2="22" stroke="var(--color-navy-mid)" strokeWidth="1.3" strokeLinecap="round" />
          {/* Knife — right of plate */}
          <line x1="67" y1="14" x2="67" y2="50" stroke="var(--color-navy-mid)" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M67 14 C73 18 72 28 67 32" stroke="var(--color-navy-mid)" strokeWidth="1.3" strokeLinecap="round" fill="none" />
          {/* Checkmark badge — sits at bottom-right, partially overlapping plate rim */}
          <circle cx="58" cy="57" r="11" fill="var(--color-navy-mid)" />
          <path d="M53 57 L57 61 L64 51" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>

        {/* Message — hierarchy: action → repeat context → food name */}
        <div className="text-center">
          <p className="text-sm font-semibold text-stone-800 leading-snug">
            {heading}
          </p>
          {/* Repeat line comes before the food name — it's the meaningful new info */}
          {repeatLine && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-navy-mid)' }}>
              {repeatLine}
            </p>
          )}
          {/* Food name last — smallest, grey; the "for what" that closes the thought */}
          <p className={`text-xs capitalize text-stone-400 ${repeatLine ? 'mt-0.5' : 'mt-1'}`}>
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
