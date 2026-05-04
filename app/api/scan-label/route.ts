// Server-side proxy for Gemini Vision label scanning.
// Accepts a base64-encoded image, sends it to Gemini, and returns extracted
// nutrition values per 100g. The API key never leaves this file.
//
// POST /api/scan-label
// Body: { imageBase64: string, mimeType: string }
// Response: { nutrition: Partial<NutritionPer100g> } | { error: string }

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NutritionPer100g } from '@/lib/types';

// Prompt instructs Gemini to:
//   1. Reject non-label images explicitly (not_a_label sentinel)
//   2. Convert per-serving values to per-100g using the stated serving size
//   3. Use null for unlisted nutrients (unknown ≠ zero)
// Tested against 8 labels — see label_tests/ and scripts/test-scan-prompt.mjs
const EXTRACTION_PROMPT = `You are extracting nutrition information from a food product label image.

First, check if the image contains a nutrition facts label (any format: FDA, FSSAI, EU, or similar).
If it does NOT contain a nutrition label, return exactly: {"error": "not_a_label"}

Otherwise, return ONLY a valid JSON object with these exact fields. All values must be per 100g:
{
  "calories": number or null,
  "protein": number or null,
  "fat": number or null,
  "carbs": number or null,
  "fiber": number or null,
  "calcium": number or null,
  "iron": number or null,
  "magnesium": number or null,
  "potassium": number or null,
  "zinc": number or null,
  "vitamin_a": number or null,
  "vitamin_b12": number or null,
  "vitamin_c": number or null,
  "vitamin_d": number or null
}

Rules:
- If the label shows values per serving, convert to per 100g using the serving size shown.
- If a nutrient is not listed on the label, use null — not 0.
- Round to at most 2 decimal places.
- Return only the JSON — no explanation, no markdown, no code fences.`;

// Sanity bounds per field — values outside these are almost certainly OCR errors or hallucinations.
// Upper bounds are generous (e.g. pure fat = ~900 kcal/100g) to avoid false rejections.
const FIELD_BOUNDS: Partial<Record<string, { max: number }>> = {
  calories:   { max: 950 },   // fat = ~900 kcal/100g; nothing edible exceeds this
  protein:    { max: 100 },   // protein can't exceed 100g per 100g
  fat:        { max: 100 },
  carbs:      { max: 100 },
  fiber:      { max: 100 },
  calcium:    { max: 2000 },  // mg — high but possible for supplements
  iron:       { max: 200 },   // mg
  magnesium:  { max: 1000 },  // mg
  potassium:  { max: 5000 },  // mg
  zinc:       { max: 100 },   // mg
  vitamin_a:  { max: 5000 },  // mcg RAE
  vitamin_b12:{ max: 500 },   // mcg
  vitamin_c:  { max: 2000 },  // mg
  vitamin_d:  { max: 500 },   // mcg
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return NextResponse.json({ error: 'Gemini API key not configured.' }, { status: 500 });
  }

  let imageBase64: string;
  let mimeType: string;
  try {
    const body = await req.json();
    imageBase64 = body.imageBase64;
    mimeType = body.mimeType ?? 'image/jpeg';
    if (!imageBase64) throw new Error('Missing imageBase64');
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      { inlineData: { mimeType, data: imageBase64 } },
      EXTRACTION_PROMPT,
    ]);

    const text = result.response.text().trim();

    // Strip markdown code fences if Gemini wraps the JSON in ```json ... ```
    const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    // Explicit not_a_label sentinel — return a user-facing error so the client
    // shows the retry UI rather than silently advancing to a blank review form.
    if (parsed.error === 'not_a_label') {
      return NextResponse.json(
        { error: 'This doesn\'t look like a nutrition label. Try another image or enter values manually.' },
        { status: 422 }
      );
    }

    // Accept only known numeric fields that pass sanity bounds.
    // Negative values and out-of-range values are dropped (treated as unreadable).
    const nutrition: Partial<NutritionPer100g> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'number' || isNaN(value)) continue;
      if (value < 0) continue; // negative values are never valid
      const bounds = FIELD_BOUNDS[key];
      if (bounds && value > bounds.max) continue; // likely OCR error or hallucination
      (nutrition as Record<string, number>)[key] = value;
    }

    // If nothing was extracted, tell the client rather than advancing to a blank review form.
    if (Object.keys(nutrition).length === 0) {
      return NextResponse.json(
        { error: 'Couldn\'t read any values from the label. Try a clearer photo or enter values manually.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ nutrition });
  } catch (err) {
    console.error('[scan-label] Gemini error:', err);
    return NextResponse.json(
      { error: 'Could not read the label. Try a clearer photo or enter manually.' },
      { status: 422 }
    );
  }
}
