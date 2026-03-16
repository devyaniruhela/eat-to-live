// Water quick-logging buttons.
// Tapping a button instantly adds water to today's log.

'use client';

interface WaterLogProps {
  onAdd: (ml: number) => void;
}

const WATER_OPTIONS = [
  { label: '+250ml', ml: 250 },
  { label: '+500ml', ml: 500 },
  { label: '+1L', ml: 1000 },
];

export default function WaterLog({ onAdd }: WaterLogProps) {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-stone-200 p-5">
      <p className="text-xs text-stone-400 uppercase tracking-widest font-medium mb-3">
        Water
      </p>
      <div className="flex gap-2">
        {WATER_OPTIONS.map((opt) => (
          <button
            key={opt.ml}
            onClick={() => onAdd(opt.ml)}
            className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 active:bg-stone-100 transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
