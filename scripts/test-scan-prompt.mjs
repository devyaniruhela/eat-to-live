// Quick CLI test for the Gemini label-scanning prompt.
// Usage:
//   node scripts/test-scan-prompt.mjs <path-to-image>
//
// Reads the image, sends it to Gemini with the current prompt,
// and prints the raw response + parsed result so we can evaluate quality.

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Set GEMINI_API_KEY env var first:');
  console.error('  GEMINI_API_KEY=your_key node scripts/test-scan-prompt.mjs <image>');
  process.exit(1);
}

const imagePath = process.argv[2];
if (!imagePath || !existsSync(imagePath)) {
  console.error('Usage: node scripts/test-scan-prompt.mjs <path-to-image>');
  process.exit(1);
}

const ext = extname(imagePath).toLowerCase();
const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const mimeType = mimeMap[ext] ?? 'image/jpeg';
const imageBase64 = readFileSync(imagePath).toString('base64');

// ─── PROMPT UNDER TEST ───────────────────────────────────────────────────────
// Edit this to iterate on the prompt. Run the script to see the effect.
const PROMPT = `You are extracting nutrition information from a food product label image.

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
// ─────────────────────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

console.log(`\nImage : ${imagePath}`);
console.log(`Model : gemini-2.5-flash`);
console.log('─'.repeat(60));

try {
  const result = await model.generateContent([
    { inlineData: { mimeType, data: imageBase64 } },
    PROMPT,
  ]);

  const raw = result.response.text().trim();
  console.log('\nRaw response from Gemini:\n');
  console.log(raw);
  console.log('\n' + '─'.repeat(60));

  // Strip code fences if present
  const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const parsed = JSON.parse(jsonText);

    if (parsed.error === 'not_a_label') {
      console.log('\n⚠️  Gemini says: not a nutrition label.\n');
    } else {
      console.log('\nParsed nutrition (per 100g):');
      for (const [key, val] of Object.entries(parsed)) {
        const display = val === null ? '(unknown)' : val;
        console.log(`  ${key.padEnd(14)} ${display}`);
      }

      // Quick sanity check
      const { calories, protein, fat, carbs } = parsed;
      if (calories && protein !== null && fat !== null && carbs !== null) {
        const est = protein * 4 + fat * 9 + carbs * 4;
        const diff = Math.abs(est - calories);
        const pct = ((diff / calories) * 100).toFixed(1);
        console.log(`\n  Macro-calorie check: estimated ${Math.round(est)} kcal vs stated ${calories} kcal (${pct}% diff)`);
        if (diff / calories > 0.25 && diff > 20) {
          console.log('  ⚠️  Large discrepancy — label may show per-serving or conversion is off.');
        } else {
          console.log('  ✓  Within acceptable range.');
        }
      }
    }
  } catch {
    console.log('\n❌ Could not parse JSON from response — Gemini returned unexpected format.\n');
  }
} catch (err) {
  console.error('\n❌ Gemini API error:', err.message ?? err);
}
