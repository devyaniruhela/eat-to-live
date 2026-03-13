// lib/food-cleaning.ts
// Single source of truth for all USDA food data cleaning and intelligence.
//
// Divided into two sections:
//   SECTION 1 — SEARCH-TIME RULES: applied before the API call (query transformation, category detection)
//   SECTION 2 — POST-SEARCH RULES: applied to raw API results before returning to the UI
//
// route.ts calls transformQuery() before fetching, then processUSDAResults() after.

import type { FoodSearchResult } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type FoodCategory =
  | 'grain'
  | 'flour'
  | 'pulse'
  | 'fruit'
  | 'vegetable'
  | 'dryFruit'
  | 'dairy'
  | 'oil'
  | 'unknown';

// Raw shape returned by USDA API — only the fields we use
export interface USDAFood {
  fdcId: number;
  description: string;
  foodNutrients: USDANutrient[];
}

export interface USDANutrient {
  nutrientId: number;
  value: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: SEARCH-TIME RULES
// These run before the USDA API call. They transform what we ask for.
// ─────────────────────────────────────────────────────────────────────────────

// Maps Indian food terms → USDA-searchable equivalents.
// USDA has no knowledge of Indian terminology.
// Values are the USDA query string to use instead.
const QUERY_MAP: Record<string, string> = {
  // Dals & pulses — all map to their English equivalents for USDA
  dal: 'lentils',
  daal: 'lentils',
  moong: 'mung beans',
  'moong dal': 'mung beans',
  masoor: 'red lentils',
  'masoor dal': 'red lentils',
  toor: 'pigeon peas',
  arhar: 'pigeon peas',
  'toor dal': 'pigeon peas',
  chana: 'chickpeas',
  chole: 'chickpeas',
  rajma: 'kidney beans',
  lobiya: 'black-eyed peas',

  // Grains
  jowar: 'sorghum',
  bajra: 'pearl millet',
  ragi: 'finger millet',
  nachni: 'finger millet',
  poha: 'flattened rice',
  sevai: 'vermicelli',

  // Flours
  atta: 'whole wheat flour',
  maida: 'wheat flour all purpose',
  besan: 'chickpea flour',

  // Vegetables
  bhindi: 'okra',
  lauki: 'bottle gourd',
  karela: 'bitter gourd',
  tinda: 'apple gourd',
  arbi: 'taro root',
  shimla: 'bell pepper',

  // Dry fruits
  makhana: 'fox nuts',
  kaju: 'cashew nuts',
  badam: 'almonds',
  kishmish: 'raisins',
  anjeer: 'dried figs',
  khajoor: 'dates',
  akhrot: 'walnuts',

  // Additional mappings
  beetroot: 'beet',
  mausambi: 'lime',
  mosambi: 'lime',
  'sweet lime': 'lime',
  muskmelon: 'cantaloupe',
  kharbooja: 'cantaloupe',
  kharbuja: 'cantaloupe',
  haricot: 'navy beans',
  'haricot beans': 'navy beans',
  'soy chunks': 'textured vegetable protein',
  'dried peas': 'peas split green',
};

// Keywords used to detect which food category a query belongs to.
// Detection drives which post-search rules are applied.
// Lists are representative, not exhaustive — detection uses substring matching.
const CATEGORY_KEYWORDS: Record<FoodCategory, string[]> = {
  grain: [
    'rice', 'wheat', 'oat', 'barley', 'millet', 'quinoa', 'rye', 'corn', 'maize',
    'sorghum', 'jowar', 'bajra', 'ragi', 'buckwheat', 'semolina', 'rava', 'suji',
    'poha', 'flattened rice', 'vermicelli', 'sevai', 'bulgur', 'farro',
  ],
  flour: [
    'flour', 'atta', 'maida', 'besan', 'cornmeal', 'cornflour',
  ],
  pulse: [
    'dal', 'daal', 'lentil', 'bean', 'pea', 'chickpea', 'gram',
    'moong', 'mung', 'masoor', 'pigeon pea', 'urad', 'rajma',
    'legume', 'soybean', 'lobiya', 'black-eyed', 'chana',
    'navy beans',   // haricot beans USDA equivalent
  ],
  fruit: [
    'apple', 'banana', 'mango', 'orange', 'grape', 'papaya', 'guava',
    'pomegranate', 'watermelon', 'melon', 'peach', 'pear', 'plum',
    'cherry', 'kiwi', 'pineapple', 'jackfruit', 'lychee', 'litchi',
    'apricot', 'coconut', 'chikoo', 'sapodilla', 'fig', 'date',
    'strawberry', 'blueberry', 'raspberry', 'mulberry', 'passion fruit',
    'cantaloupe',   // muskmelon/kharbooja USDA equivalent
  ],
  vegetable: [
    'spinach', 'tomato', 'onion', 'potato', 'carrot', 'cauliflower',
    'broccoli', 'cucumber', 'eggplant', 'brinjal', 'okra', 'gourd',
    'pumpkin', 'squash', 'pepper', 'cabbage', 'beetroot', 'radish',
    'turnip', 'zucchini', 'celery', 'leek', 'asparagus', 'artichoke',
    'sweet potato', 'yam', 'taro', 'arbi', 'corn cob', 'peas',
  ],
  dryFruit: [
    'almond', 'cashew', 'walnut', 'pistachio', 'peanut', 'groundnut',
    'raisin', 'dates', 'fig', 'apricot', 'fox nut', 'makhana',
    'sunflower seed', 'pumpkin seed', 'flaxseed', 'chia seed',
    'sesame', 'pine nut', 'hazelnut', 'macadamia', 'pecan',
  ],
  dairy: [
    'milk', 'yogurt', 'curd', 'cheese', 'paneer', 'butter', 'ghee', 'cream', 'whey',
  ],
  oil: ['oil', 'ghee'],
  unknown: [],
};

/**
 * SEARCH-TIME: Transforms a raw user query before sending to USDA.
 * Returns the USDA-friendly query string and the detected food category.
 * The category is used later to apply the right post-search filtering rules.
 */
export function transformQuery(rawQuery: string): {
  usdaQuery: string;
  category: FoodCategory;
} {
  const q = rawQuery.trim().toLowerCase();

  // Check for an exact match in the Indian term → USDA term map
  const mapped = QUERY_MAP[q] ?? rawQuery.trim();
  const category = detectCategory(q);

  return { usdaQuery: mapped, category };
}

/**
 * Detects food category from a search query string.
 * Tries each category's keyword list in order; returns 'unknown' if no match.
 */
function detectCategory(query: string): FoodCategory {
  const order: FoodCategory[] = [
    'flour',     // check flour before grain — "wheat flour" should be flour not grain
    'pulse',     // check pulse before vegetable — "peas" could match both
    'grain',
    'fruit',
    'vegetable',
    'dryFruit',
    'dairy',
    'oil',
  ];

  for (const cat of order) {
    if (CATEGORY_KEYWORDS[cat].some((k) => query.includes(k))) {
      return cat;
    }
  }
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: POST-SEARCH RULES
// Applied to raw USDA results: clean names, filter, re-rank, deduplicate, cap.
// ─────────────────────────────────────────────────────────────────────────────

// USDA nutrient IDs for all nutrients we track.
// Standardised across all FoodData Central entries.
// Micronutrient units: calcium/iron/magnesium/potassium/zinc/vitamin_c in mg,
// vitamin_a and vitamin_b12 in mcg, vitamin_d in mcg.
const NUTRIENT_IDS = {
  // Macros
  calories:    1008,
  protein:     1003,
  fat:         1004,
  carbs:       1005,
  fiber:       1079,
  // Micronutrients
  calcium:     1087,
  iron:        1089,
  magnesium:   1090,
  potassium:   1092,
  zinc:        1095,
  vitamin_a:   1104,  // RAE
  vitamin_b12: 1178,
  vitamin_c:   1162,
  vitamin_d:   1114,
};

// Name segments to discard unconditionally from any food name.
// These are USDA internal tags, grain size descriptors, and regional qualifiers
// that add no nutritional or practical meaning for the user.
const UNIVERSAL_DISCARD_SEGMENTS = new Set([
  'long-grain', 'short-grain', 'medium-grain', 'extra-long grain',
  'regular', 'instant', 'quick', 'quick-cooking', 'quick and instant',
  'unenriched', 'enriched', 'fortified', 'not fortified',
  'commercially prepared', 'home-prepared', 'restaurant-prepared',
  'nfs', 'not further specified',
  'type a', 'type b', 'grade a', 'grade b',
  'year round average',
  'mature seeds',         // legume-specific USDA tag — redundant
  'immature seeds',
  // regional/origin qualifiers
  'navajo', 'southwest', 'hawaii',
  'european type', 'american type', 'california type',
  'english',              // e.g. "Walnuts, english" — just call them walnuts
]);

// Phrases collapsed to a cleaner form during name cleaning.
// Checked after splitting into segments.
const COLLAPSE_MAP: [RegExp, string][] = [
  [/cooked,?\s*boiled/gi, 'cooked'],          // "cooked, boiled" → "cooked"
  [/boiled(,?\s*drained)?/gi, 'cooked'],       // "boiled, drained" → "cooked"
  [/dry[-\s]roasted/gi, 'dry roasted'],        // normalise spacing
  [/oil[-\s]roasted/gi, 'oil roasted'],        // normalise spacing
  [/all[-\s]purpose/gi, 'refined'],            // "all-purpose" flour = refined
  [/\(.*?\)/g, ''],                            // remove all parenthetical content, e.g. "(garbanzo beans)"
  [/without\s+(added\s+)?salt/gi, ''],         // remove "without salt" — assumed default
  [/with\s+added\s+salt/gi, 'salted'],         // normalise to "salted"
  [/ripe\s+and\s+slightly\s+ripe/gi, 'ripe'],  // "ripe and slightly ripe" → "ripe"
];

// Which preparation/type modifiers to KEEP per category.
// All other modifiers not in this list are discarded after the universal discard check.
const KEEP_MODIFIERS: Record<FoodCategory, Set<string>> = {
  grain: new Set([
    'raw', 'cooked', 'dry', 'uncooked',
    'white', 'brown', 'whole', 'whole grain', 'whole wheat', 'refined',
    'rolled', 'flaked', 'puffed', 'pearled', 'cracked',
    'pearl', 'finger', 'little', 'foxtail', 'kodo', 'proso', // millet varieties
  ]),
  flour: new Set([
    'whole', 'whole grain', 'whole wheat', 'refined', 'white', 'yellow',
    'wheat', 'rice', 'chickpea', 'corn', 'rye', 'oat', 'almond', 'coconut',
  ]),
  pulse: new Set([
    'whole', 'split', 'sprouted', 'raw',
    'green', 'yellow', 'red', 'black', 'white', 'pink', // colour variants
    'large', 'small',   // e.g. large vs small chickpeas
  ]),
  fruit: new Set([
    'ripe', 'raw', 'fresh', 'overripe', 'dried', 'dehydrated',
    'with skin',        // preferred default for fruits
  ]),
  vegetable: new Set([
    'raw', 'fresh',
    'flesh and skin',   // nutritionally meaningful — more fibre
    'with peel',        // shown only if queried, but kept in the name if present
    'green', 'red', 'yellow', 'orange',  // bell pepper colour variants (e.g. "Peppers, bell, green, raw")
  ]),
  dryFruit: new Set([
    'raw', 'dry roasted', 'oil roasted', 'roasted', 'dried',
    'salted',           // kept in name, but filtered out unless queried
    'medjool',          // date variety — retained as it's now common in India
  ]),
  dairy: new Set([
    'whole', 'skim', 'skimmed', 'low-fat', 'full-fat', 'nonfat', 'reduced-fat',
    'plain', 'unsweetened',
  ]),
  oil: new Set(['refined', 'unrefined', 'cold pressed', 'virgin', 'extra virgin']),
  unknown: new Set(['raw', 'cooked', 'dried', 'roasted', 'whole', 'refined']),
};

// Fruits that can be shown in raw/unripe form — eaten that way in Indian cuisine.
// All other fruits default to ripe/fresh only.
const UNRIPE_OK_FRUITS = new Set(['banana', 'mango', 'papaya', 'jackfruit']);

// Terms that are EXCLUDED from results by default.
// They are only included if the search query explicitly contains the unlock keyword.
// Format: [term to detect in USDA name, keyword required in search query to unlock]
const CONDITIONAL_EXCLUSIONS: [string, string][] = [
  ['salted', 'salted'],                 // salted nuts/dry fruits — only if user asks
  ['oil roasted', 'oil roasted'],       // oil roasted — excluded unless asked (dry roasted preferred)
  ['without skin', 'without skin'],     // skinless fruit — only if user asks
  ['without peel', 'without peel'],     // peeled veg — only if user asks
  ['flesh only', 'without peel'],       // flesh only = same as without peel
  ['frozen', 'frozen'],                 // frozen veg/fruit — always prefer fresh
  ['canned', 'canned'],
  ['pickled', 'pickled'],
  ['cooked', 'cooked'],                 // cooked pulses — excluded unless user asks
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST-SEARCH: Runs the full cleaning pipeline on raw USDA results.
 * Order: clean name → filter → deduplicate → re-rank → cap.
 *
 * @param foods      Raw array from USDA API
 * @param rawQuery   Original user search query (used for conditional exclusion checks)
 * @param category   Detected food category from transformQuery()
 */
export function processUSDAResults(
  foods: USDAFood[],
  rawQuery: string,
  category: FoodCategory
): FoodSearchResult[] {
  const queryLower = rawQuery.trim().toLowerCase();
  const seen = new Set<string>();

  return foods
    .map((food) => {
      const name = cleanFoodName(food.description, category);
      if (!name) return null; // null = discard this entry

      return {
        fdcId: food.fdcId,
        name,
        nutrition: extractNutrition(food.foodNutrients || []),
      };
    })
    .filter((food): food is FoodSearchResult => {
      if (!food) return false;

      // Discard entries where calorie data is missing — incomplete USDA records
      if (food.nutrition.calories === 0) return false;

      // Apply conditional exclusions — filter based on what's in the USDA name
      // vs what the user actually searched for
      if (shouldExclude(food.name, queryLower, category)) return false;

      // Deduplicate by cleaned name
      if (seen.has(food.name)) return false;
      seen.add(food.name);

      return true;
    })
    .sort((a, b) => relevanceScore(a.name, queryLower) - relevanceScore(b.name, queryLower))
    .slice(0, 6);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cleans a raw USDA food name using category-aware rules.
 * Returns null if the entry should be discarded entirely.
 *
 * Steps:
 * 1. Apply collapse map (normalise verbose phrases)
 * 2. Split into comma-separated segments
 * 3. Keep base name (first segment, always)
 * 4. From remaining segments, keep only those in KEEP_MODIFIERS for this category
 * 5. Discard segments in UNIVERSAL_DISCARD_SEGMENTS
 * 6. Title-case result
 */
function cleanFoodName(raw: string, category: FoodCategory): string | null {
  let name = raw;

  // Step 1: apply collapse rules (regex replacements)
  for (const [pattern, replacement] of COLLAPSE_MAP) {
    name = name.replace(pattern, replacement);
  }

  // Split into segments and trim whitespace
  const segments = name.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  // Fix: when the first segment is exactly "Nuts" or "Seeds" (generic USDA category prefix),
  // promote the next non-discarded segment as the real base name and drop "Nuts"/"Seeds".
  // e.g. "Nuts, almonds, raw" → base "Almonds", not "Nuts".
  let base = segments[0];
  let rest = segments.slice(1);
  if (['nuts', 'seeds'].includes(base.toLowerCase()) && rest.length > 0) {
    base = rest[0];
    rest = rest.slice(1);
  }

  const keepModifiers = KEEP_MODIFIERS[category];

  // From remaining segments, keep only those that are in the category's keep list
  // and not in the universal discard list
  const kept = rest.filter((seg) => {
    const lower = seg.toLowerCase();
    if (UNIVERSAL_DISCARD_SEGMENTS.has(lower)) return false;
    // Keep if it contains any of the category's modifier keywords
    return [...keepModifiers].some((mod) => lower.includes(mod));
  });

  // Build final name — base + up to 2 modifiers (more than 2 gets noisy)
  const parts = [base, ...kept.slice(0, 2)].filter(Boolean).join(', ');

  // Title-case: capitalise first letter only
  return parts.charAt(0).toUpperCase() + parts.slice(1).toLowerCase();
}

/**
 * Checks whether a cleaned food name should be excluded based on:
 * - Conditional exclusion rules (e.g. salted, cooked, frozen, without skin)
 * - Fruit ripeness rules (only ripe unless category allows unripe)
 *
 * Returns true = exclude this result.
 */
function shouldExclude(
  cleanedName: string,
  queryLower: string,
  category: FoodCategory
): boolean {
  const nameLower = cleanedName.toLowerCase();

  // Check conditional exclusions — excluded by default unless user asked for it
  for (const [term, unlockKeyword] of CONDITIONAL_EXCLUSIONS) {
    if (nameLower.includes(term) && !queryLower.includes(unlockKeyword)) {
      // Special case: cooked pulses only excluded for pulse category
      if (term === 'cooked' && category !== 'pulse') continue;
      return true;
    }
  }

  // Fruit ripeness rule: exclude explicitly unripe fruits unless that fruit is on the allowed list.
  // Importantly: USDA uses "raw" to mean fresh/unprocessed, NOT unripe.
  // "Strawberries, raw" = fresh strawberries. Only the word "unripe" signals unripe fruit.
  if (category === 'fruit') {
    const isUnripeEntry = nameLower.includes('unripe');
    if (isUnripeEntry) {
      const allowedUnripe = [...UNRIPE_OK_FRUITS].some((f) => nameLower.includes(f));
      if (!allowedUnripe) return true;
    }
  }

  return false;
}

/**
 * Scores relevance of a food name to the search query.
 * Lower score = more relevant = appears higher in results.
 *
 * 0: name starts with query ("oat bran" for "oat")
 * 1: query is a whole word in name ("rolled oats" for "oat")
 * 2: base food name (before first comma) is a single word matching query —
 *    boosts simple foods ("Rice, white") over compound ("Rice crackers")
 * 3: query appears anywhere in name
 * 4: no direct match (still in results because USDA deemed it relevant)
 */
function relevanceScore(name: string, query: string): number {
  const n = name.toLowerCase();
  if (n.startsWith(query)) return 0;

  // Escape regex special chars in query before building pattern
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordBoundary = new RegExp(`(^|[\\s,])${escaped}($|[\\s,])`);
  if (wordBoundary.test(n)) return 1;

  // Boost: first segment (base food) is a single word exactly matching query
  // This ranks "Rice, white" above "Rice crackers" for the query "rice"
  const baseName = n.split(',')[0].trim();
  if (baseName === query) return 2;

  if (n.includes(query)) return 3;
  return 4;
}

/**
 * Extracts the 5 macro nutrients from a USDA food's nutrient array.
 * Builds a lookup map first for O(1) access rather than scanning the array 5 times.
 * Defaults to 0 if a nutrient is absent — some USDA entries have incomplete data.
 */
export function extractNutrition(nutrients: USDANutrient[]): FoodSearchResult['nutrition'] {
  const map: Record<number, number> = {};
  for (const n of nutrients) {
    map[n.nutrientId] = n.value;
  }

  return {
    calories:    map[NUTRIENT_IDS.calories]    ?? 0,
    protein:     map[NUTRIENT_IDS.protein]     ?? 0,
    fat:         map[NUTRIENT_IDS.fat]         ?? 0,
    carbs:       map[NUTRIENT_IDS.carbs]       ?? 0,
    fiber:       map[NUTRIENT_IDS.fiber]       ?? 0,
    calcium:     map[NUTRIENT_IDS.calcium]     ?? 0,
    iron:        map[NUTRIENT_IDS.iron]        ?? 0,
    magnesium:   map[NUTRIENT_IDS.magnesium]   ?? 0,
    potassium:   map[NUTRIENT_IDS.potassium]   ?? 0,
    zinc:        map[NUTRIENT_IDS.zinc]        ?? 0,
    vitamin_a:   map[NUTRIENT_IDS.vitamin_a]   ?? 0,
    vitamin_b12: map[NUTRIENT_IDS.vitamin_b12] ?? 0,
    vitamin_c:   map[NUTRIENT_IDS.vitamin_c]   ?? 0,
    vitamin_d:   map[NUTRIENT_IDS.vitamin_d]   ?? 0,
  };
}
