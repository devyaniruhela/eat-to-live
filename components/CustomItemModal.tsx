// Full-screen modal for adding a custom food item.
// Supports two entry paths: scanning a nutrition label image (Gemini Vision)
// or entering values manually.
//
// Flow:
//   Step 'choose'   — pick Scan or Manual
//   Step 'scanning' — image uploading + AI extraction in progress
//   Step 'review'   — edit name + nutrition values, validate, save
//
// After a successful save, calls onSaved(FoodSearchResult) so the parent can
// immediately select the new food in the search screen.

'use client';

import { useState, useRef } from 'react';
import { CustomFood, FoodSearchResult, NutritionPer100g } from '@/lib/types';
import {
  getCustomFoods,
  saveCustomFood,
  customFoodToSearchResult,
  generateCustomId,
} from '@/lib/storage';
import { validateCustomFood } from '@/lib/custom-food-validation';

// All 14 nutrition fields split into macros (always visible) and micros (collapsible).
const MACRO_FIELDS: { key: keyof NutritionPer100g; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein',  label: 'Protein',  unit: 'g' },
  { key: 'fat',      label: 'Fat',      unit: 'g' },
  { key: 'carbs',    label: 'Carbs',    unit: 'g' },
  { key: 'fiber',    label: 'Fiber',    unit: 'g' },
];

const MICRO_FIELDS: { key: keyof NutritionPer100g; label: string; unit: string }[] = [
  { key: 'calcium',    label: 'Calcium',     unit: 'mg' },
  { key: 'iron',       label: 'Iron',        unit: 'mg' },
  { key: 'magnesium',  label: 'Magnesium',   unit: 'mg' },
  { key: 'potassium',  label: 'Potassium',   unit: 'mg' },
  { key: 'zinc',       label: 'Zinc',        unit: 'mg' },
  { key: 'vitamin_a',  label: 'Vitamin A',   unit: 'mcg' },
  { key: 'vitamin_b12',label: 'Vitamin B12', unit: 'mcg' },
  { key: 'vitamin_c',  label: 'Vitamin C',   unit: 'mg' },
  { key: 'vitamin_d',  label: 'Vitamin D',   unit: 'mcg' },
];

// Empty form state — all fields blank (unknown), not zero.
const EMPTY_FIELDS: Record<keyof NutritionPer100g, string> = {
  calories: '', protein: '', fat: '', carbs: '', fiber: '',
  calcium: '', iron: '', magnesium: '', potassium: '', zinc: '',
  vitamin_a: '', vitamin_b12: '', vitamin_c: '', vitamin_d: '',
};

type Step = 'choose' | 'scanning' | 'review';

interface CustomItemModalProps {
  onSaved: (food: FoodSearchResult) => void;
  onClose: () => void;
}

export default function CustomItemModal({ onSaved, onClose }: CustomItemModalProps) {
  const [step, setStep] = useState<Step>('choose');
  const [scanError, setScanError] = useState('');
  const [source, setSource] = useState<CustomFood['source']>('manual');

  // Review form state
  const [name, setName] = useState('');
  const [fields, setFields] = useState<Record<keyof NutritionPer100g, string>>(EMPTY_FIELDS);
  const [showMicros, setShowMicros] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [nameError, setNameError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Resize image client-side before sending — reduces payload from ~5MB to ~150KB
  async function resizeImage(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1024;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        // Split off the "data:image/jpeg;base64," prefix — API wants the raw base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStep('scanning');
    setScanError('');

    try {
      const { base64, mimeType } = await resizeImage(file);

      // 30s timeout — Gemini is usually <5s but can be slower under load.
      // Without this, a dropped connection leaves the user on the spinner forever.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      let res: Response;
      try {
        res = await fetch('/api/scan-label', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Scan failed. Try a clearer photo or enter manually.');
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Pre-fill review form with extracted values; blank where null/missing
      const extracted: Partial<NutritionPer100g> = data.nutrition ?? {};
      const prefilled = { ...EMPTY_FIELDS };
      for (const key of Object.keys(prefilled) as (keyof NutritionPer100g)[]) {
        const val = extracted[key];
        if (val !== undefined && val !== null) prefilled[key] = String(val);
      }
      setFields(prefilled);
      setSource('label-scan');
      setStep('review');
      // Auto-focus name field after transition
      setTimeout(() => nameInputRef.current?.focus(), 50);
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      setScanError(
        isTimeout
          ? 'Scan timed out. Check your connection and try again.'
          : err instanceof Error ? err.message : 'Could not read the label.'
      );
      setStep('scanning'); // stay on this step so user sees the error + retry options
    }
  }

  function handleManual() {
    setSource('manual');
    setFields(EMPTY_FIELDS);
    setStep('review');
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  function handleRetry() {
    setScanError('');
    fileInputRef.current!.value = '';
    fileInputRef.current?.click();
  }

  // Updates a single nutrition field string value
  function setField(key: keyof NutritionPer100g, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  // Parses the string fields into a Partial<NutritionPer100g> for storage.
  // Empty string → field omitted (unknown). Numeric string → parsed value.
  function parseFields(): Partial<NutritionPer100g> {
    const result: Partial<NutritionPer100g> = {};
    for (const key of Object.keys(fields) as (keyof NutritionPer100g)[]) {
      const trimmed = fields[key].trim();
      if (trimmed === '') continue;
      const num = parseFloat(trimmed);
      if (!isNaN(num)) (result as Record<string, number>)[key] = num;
    }
    return result;
  }

  function handleSave() {
    const trimmedName = name.trim();
    const nutrition = parseFields();
    const existing = getCustomFoods();

    const { errors: errs, warnings: warns } = validateCustomFood(trimmedName, nutrition, existing);
    setErrors(errs);
    setWarnings(warns);

    if (errs.length > 0) return; // block save on hard errors

    // Normalize name to title case before saving
    const normalizedName = trimmedName
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    const food: CustomFood = {
      id: generateCustomId(),
      name: normalizedName,
      nutrition,
      createdAt: new Date().toISOString().split('T')[0],
      source,
      submittedForReview: true, // always flagged for Supabase QC sync
    };

    saveCustomFood(food);
    onSaved(customFoodToSearchResult(food));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ backgroundColor: 'var(--color-card)' }}>
      <div className="w-full max-w-md flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-stone-100">
          <button
            onClick={step === 'review' ? () => { setStep('choose'); setScanError(''); } : onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
            aria-label={step === 'review' ? 'Back' : 'Close'}
          >
            ←
          </button>
          <h1 className="text-base font-semibold text-stone-800">
            {step === 'choose' && 'Add a custom food'}
            {step === 'scanning' && (scanError ? 'Couldn\'t read the label' : 'Reading label…')}
            {step === 'review' && 'Review & save'}
          </h1>
        </div>

        {/* ── Step: Choose ── */}
        {step === 'choose' && (
          <div className="flex-1 flex flex-col justify-center px-6 gap-4">
            <p className="text-sm text-stone-500 text-center mb-2">
              How would you like to add this food?
            </p>

            {/* Scan label */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-4 p-5 rounded-2xl border-2 border-stone-200 hover:border-stone-300 bg-card transition-colors text-left"
            >
              <span className="text-3xl" aria-hidden="true">📷</span>
              <div>
                <p className="text-sm font-semibold text-stone-800">Scan nutrition label</p>
                <p className="text-xs text-stone-400 mt-0.5">Take a photo or upload an image</p>
              </div>
            </button>

            {/* Manual entry */}
            <button
              onClick={handleManual}
              className="flex items-center gap-4 p-5 rounded-2xl border-2 border-stone-200 hover:border-stone-300 bg-card transition-colors text-left"
            >
              <span className="text-3xl" aria-hidden="true">✏️</span>
              <div>
                <p className="text-sm font-semibold text-stone-800">Enter manually</p>
                <p className="text-xs text-stone-400 mt-0.5">Type in the nutrition values</p>
              </div>
            </button>

            {/* Hidden file input — capture="environment" opens back camera on mobile */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* ── Step: Scanning ── */}
        {step === 'scanning' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 text-center">
            {!scanError ? (
              <>
                <div
                  className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: 'var(--color-navy-mid)', borderTopColor: 'transparent' }}
                />
                <div>
                  <p className="text-sm font-medium text-stone-700">Reading the label…</p>
                  <p className="text-xs text-stone-400 mt-1">
                    Works best when the nutrition table fills the frame
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: 'rgba(200,112,128,0.1)' }}
                >
                  ⚠️
                </div>
                {/* What happened */}
                <div>
                  <p className="text-sm font-semibold text-stone-800">{scanError}</p>
                  <p className="text-xs text-stone-400 mt-1.5 leading-snug">
                    Try a closer, well-lit photo of just the nutrition table — or type the values in yourself.
                  </p>
                </div>
                {/* What to do next */}
                <div className="flex gap-3">
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 rounded-full text-sm font-semibold border-2 transition-colors"
                    style={{ borderColor: 'var(--color-navy)', color: 'var(--color-navy)' }}
                  >
                    Try again
                  </button>
                  <button
                    onClick={handleManual}
                    className="px-4 py-2 rounded-full text-sm font-semibold border border-stone-300 text-stone-600 transition-colors hover:bg-stone-50"
                  >
                    Enter manually
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step: Review ── */}
        {step === 'review' && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">

              {/* Context note — different message for scan vs manual */}
              {source === 'label-scan' ? (
                <div className="rounded-xl px-4 py-3 space-y-1" style={{ backgroundColor: 'var(--color-planned-bg)' }}>
                  <p className="text-xs font-semibold text-stone-700">We extracted these values from your label.</p>
                  <p className="text-xs text-stone-500 leading-snug">
                    Check the numbers match — OCR isn&apos;t perfect. Blank fields weren&apos;t found on the label; add them if you have the info. All values are per 100g.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl px-4 py-3 space-y-1" style={{ backgroundColor: 'var(--color-planned-bg)' }}>
                  <p className="text-xs font-semibold text-stone-700">Enter values from the packaging.</p>
                  <p className="text-xs text-stone-500 leading-snug">
                    All values should be per 100g — convert if the label shows per serving. Leave a field blank if it&apos;s not on the label.
                  </p>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs text-stone-500 uppercase tracking-widest font-medium mb-1">
                  Food name <span style={{ color: 'var(--color-rose)' }}>*</span>
                </label>
                <p className="text-xs text-stone-400 mb-2">This is how it will appear in search results.</p>
                <input
                  ref={nameInputRef}
                  type="text"
                  placeholder="e.g. Protein Bar XYZ"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(''); }}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-navy"
                  style={{ '--tw-ring-color': 'rgba(26,39,68,0.2)' } as React.CSSProperties}
                />
                {nameError && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-rose)' }}>{nameError}</p>
                )}
              </div>

              {/* Macronutrients — always visible */}
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-widest font-medium mb-3">
                  Macronutrients <span className="normal-case font-normal">· per 100g</span>
                </p>
                <div className="space-y-2">
                  {MACRO_FIELDS.map(({ key, label, unit }) => (
                    <NutritionInput
                      key={key}
                      label={label}
                      unit={unit}
                      value={fields[key]}
                      onChange={(v) => setField(key, v)}
                    />
                  ))}
                </div>
                <p className="text-xs text-stone-300 mt-2">
                  Blank (–) means unknown — it won&apos;t count as zero in your totals.
                </p>
              </div>

              {/* Micronutrients — collapsible */}
              <div>
                <button
                  onClick={() => setShowMicros((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                  style={{ color: 'var(--color-navy-mid)' }}
                >
                  <span
                    className="inline-block transition-transform duration-200"
                    style={{ transform: showMicros ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  >
                    ›
                  </span>
                  {showMicros ? 'Hide micronutrients' : 'Add micronutrients'}
                </button>

                {showMicros && (
                  <div className="mt-3 space-y-2">
                    {MICRO_FIELDS.map(({ key, label, unit }) => (
                      <NutritionInput
                        key={key}
                        label={label}
                        unit={unit}
                        value={fields[key]}
                        onChange={(v) => setField(key, v)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Validation errors — block save */}
              {errors.length > 0 && (
                <div className="rounded-xl p-3 space-y-1" style={{ backgroundColor: 'rgba(200,112,128,0.08)' }}>
                  {errors.map((e, i) => (
                    <p key={i} className="text-xs font-medium" style={{ color: 'var(--color-rose)' }}>
                      {e}
                    </p>
                  ))}
                </div>
              )}

              {/* Validation warnings — informational only */}
              {warnings.length > 0 && (
                <div className="rounded-xl p-3 space-y-1 bg-amber-50 border border-amber-100">
                  {warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">{w}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="border-t border-stone-100 px-4 py-4 flex gap-3 bg-card">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-stone-500 border border-stone-200 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--color-navy)' }}
              >
                Save custom food
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Single nutrition field row: label on the left, number input + unit on the right.
// Empty value = unknown (stored as absent). Placeholder shows "–" to signal this.
function NutritionInput({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-stone-600 shrink-0 w-28">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          placeholder="–"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 px-3 py-1.5 text-sm text-right border border-stone-200 rounded-lg bg-white focus:outline-none focus:border-navy placeholder:text-stone-300"
          style={{ '--tw-ring-color': 'rgba(26,39,68,0.2)' } as React.CSSProperties}
          min={0}
        />
        <span className="text-xs text-stone-400 w-8">{unit}</span>
      </div>
    </div>
  );
}
