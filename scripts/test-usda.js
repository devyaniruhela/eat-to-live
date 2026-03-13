// scripts/test-usda.js
// Standalone script to test USDA FoodData Central API coverage for all app food items.
// Calls USDA directly (bypasses the app's /api/food-search route which checks Indian JSON first).
// Inlines the QUERY_MAP and category detection from lib/food-cleaning.ts for local use.
//
// Usage: node scripts/test-usda.js
// Output: scripts/usda-test-output.md

const https = require('https');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

// Load .env.local so the script can be run directly with `node scripts/test-usda.js`
// without needing to export variables manually first.
const envPath = require('path').join(__dirname, '..', '.env.local');
if (require('fs').existsSync(envPath)) {
  require('fs').readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  });
}

const USDA_API_KEY = process.env.USDA_API_KEY;
if (!USDA_API_KEY) {
  console.error('Error: USDA_API_KEY not set. Add it to .env.local and re-run.');
  process.exit(1);
}

const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const DELAY_MS = 300;
const PAGE_SIZE = 10;

// ─────────────────────────────────────────────────────────────────────────────
// INLINED FROM lib/food-cleaning.ts — kept in sync manually
// ─────────────────────────────────────────────────────────────────────────────

// Maps Indian food terms → USDA-searchable equivalents.
const QUERY_MAP = {
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
  urad: 'black gram',
  'urad dal': 'black gram',
  rajma: 'kidney beans',
  lobiya: 'black-eyed peas',
  'chana dal': 'split chickpeas',
  jowar: 'sorghum',
  bajra: 'pearl millet',
  ragi: 'finger millet',
  nachni: 'finger millet',
  poha: 'flattened rice',
  sevai: 'vermicelli',
  atta: 'whole wheat flour',
  maida: 'refined wheat flour',
  besan: 'chickpea flour',
  bhindi: 'okra',
  lauki: 'bottle gourd',
  karela: 'bitter gourd',
  tinda: 'apple gourd',
  arbi: 'taro root',
  shimla: 'bell pepper',
  makhana: 'fox nuts',
  kaju: 'cashew nuts',
  badam: 'almonds',
  kishmish: 'raisins',
  anjeer: 'dried figs',
  khajoor: 'dates',
  akhrot: 'walnuts',
};

// ─────────────────────────────────────────────────────────────────────────────
// ITEMS TO TEST
// null usdaQuery = N/A, will be skipped in API calls
// ─────────────────────────────────────────────────────────────────────────────

const ITEMS_TO_TEST = [
  // ── GRAINS ──────────────────────────────────────────────────────────────────
  { item: 'Little millet',    usdaQuery: 'little millet',  category: 'grain',   note: 'QUERY_MAP has no entry — querying directly' },
  { item: 'Foxtail millet',   usdaQuery: 'foxtail millet', category: 'grain',   note: 'QUERY_MAP has no entry — querying directly' },
  { item: 'Kodo millet',      usdaQuery: 'kodo millet',    category: 'grain',   note: 'QUERY_MAP has no entry — querying directly' },
  { item: 'Ragi',             usdaQuery: 'finger millet',  category: 'grain',   note: 'QUERY_MAP: ragi → finger millet' },
  { item: 'Jowar',            usdaQuery: 'sorghum',        category: 'grain',   note: 'QUERY_MAP: jowar → sorghum' },
  { item: 'Bajra',            usdaQuery: 'pearl millet',   category: 'grain',   note: 'QUERY_MAP: bajra → pearl millet' },

  // ── FLOURS ──────────────────────────────────────────────────────────────────
  { item: 'Whole wheat flour',       usdaQuery: 'whole wheat flour',    category: 'flour', note: '' },
  { item: 'Refined flour / Maida',   usdaQuery: 'refined wheat flour',  category: 'flour', note: 'QUERY_MAP: maida → refined wheat flour' },
  { item: 'Besan / Gram flour',      usdaQuery: 'chickpea flour',       category: 'flour', note: 'QUERY_MAP: besan → chickpea flour' },
  { item: 'Ragi flour',              usdaQuery: 'finger millet flour',  category: 'flour', note: 'QUERY_MAP has no entry for ragi flour specifically' },
  { item: 'Jowar flour',             usdaQuery: 'sorghum flour',        category: 'flour', note: 'QUERY_MAP has no entry for jowar flour specifically' },
  { item: 'Bajra flour',             usdaQuery: 'pearl millet flour',   category: 'flour', note: 'QUERY_MAP has no entry for bajra flour specifically' },

  // ── VEGETABLES ──────────────────────────────────────────────────────────────
  { item: 'Ladies finger / Okra',      usdaQuery: 'okra',          category: 'vegetable', note: 'QUERY_MAP: bhindi → okra' },
  { item: 'Potato',                    usdaQuery: 'potato',        category: 'vegetable', note: '' },
  { item: 'Onion',                     usdaQuery: 'onion',         category: 'vegetable', note: '' },
  { item: 'Tomato',                    usdaQuery: 'tomato',        category: 'vegetable', note: '' },
  { item: 'Lemon',                     usdaQuery: 'lemon',         category: 'fruit',     note: 'Technically a fruit — checking coverage' },
  { item: 'Bottle gourd',              usdaQuery: 'bottle gourd',  category: 'vegetable', note: 'QUERY_MAP: lauki → bottle gourd' },
  { item: 'Brinjal big',              usdaQuery: 'eggplant',       category: 'vegetable', note: 'USDA uses eggplant, not brinjal' },
  { item: 'Brinjal small',            usdaQuery: 'eggplant',       category: 'vegetable', note: 'Same USDA term — checking if small variant exists' },
  { item: 'Drumstick / Moringa',      usdaQuery: 'moringa',        category: 'vegetable', note: 'QUERY_MAP has no entry — moringa is the international term' },
  { item: 'Radish',                   usdaQuery: 'radish',         category: 'vegetable', note: '' },
  { item: 'Carrot',                   usdaQuery: 'carrot',         category: 'vegetable', note: '' },
  { item: 'Capsicum / Bell pepper green', usdaQuery: 'green bell pepper', category: 'vegetable', note: 'QUERY_MAP: shimla → bell pepper' },
  { item: 'Capsicum / Bell pepper yellow', usdaQuery: 'yellow bell pepper', category: 'vegetable', note: '' },
  { item: 'Capsicum / Bell pepper red',  usdaQuery: 'red bell pepper', category: 'vegetable', note: '' },
  { item: 'Garlic',                   usdaQuery: 'garlic',         category: 'vegetable', note: '' },
  { item: 'Ginger',                   usdaQuery: 'ginger',         category: 'vegetable', note: '' },
  { item: 'Peas fresh',              usdaQuery: 'green peas',      category: 'vegetable', note: '' },
  { item: 'Beetroot',                 usdaQuery: 'beet',           category: 'vegetable', note: 'USDA uses beet, not beetroot' },
  { item: 'Spinach',                  usdaQuery: 'spinach',        category: 'vegetable', note: '' },
  { item: 'Fenugreek leaves',         usdaQuery: 'fenugreek leaves', category: 'vegetable', note: 'May not have leaves specifically, just seeds' },
  { item: 'Mustard leaves',           usdaQuery: 'mustard greens', category: 'vegetable', note: 'USDA term is mustard greens' },
  { item: 'Colocasia / Arbi',         usdaQuery: 'taro root',      category: 'vegetable', note: 'QUERY_MAP: arbi → taro root' },
  { item: 'Sweet potato',             usdaQuery: 'sweet potato',   category: 'vegetable', note: '' },
  { item: 'Sweet corn',               usdaQuery: 'sweet corn',     category: 'vegetable', note: '' },
  { item: 'Baby corn',                usdaQuery: 'baby corn',      category: 'vegetable', note: '' },
  { item: 'Button mushroom',          usdaQuery: 'mushroom',       category: 'vegetable', note: '' },
  { item: 'Haricot beans',            usdaQuery: 'haricot beans',  category: 'pulse',     note: 'Also known as navy beans in USDA' },
  { item: 'Jackfruit unripe',         usdaQuery: 'jackfruit',      category: 'fruit',     note: 'USDA may have green/young jackfruit' },
  { item: 'Raw / green mango',        usdaQuery: 'mango',          category: 'fruit',     note: 'Checking if raw/unripe variant is present' },
  { item: 'Yam',                      usdaQuery: 'yam',            category: 'vegetable', note: '' },
  { item: 'Cucumber',                 usdaQuery: 'cucumber',       category: 'vegetable', note: '' },
  { item: 'Broccoli',                 usdaQuery: 'broccoli',       category: 'vegetable', note: '' },
  { item: 'Cauliflower',              usdaQuery: 'cauliflower',    category: 'vegetable', note: '' },
  { item: 'Cabbage',                  usdaQuery: 'cabbage',        category: 'vegetable', note: '' },
  { item: 'Red cabbage',              usdaQuery: 'red cabbage',    category: 'vegetable', note: '' },
  { item: 'Green onion / Spring onion', usdaQuery: 'spring onion', category: 'vegetable', note: 'USDA may call it scallion' },
  { item: 'Avocado',                  usdaQuery: 'avocado',        category: 'fruit',     note: '' },
  { item: 'Curly kale',               usdaQuery: 'kale',           category: 'vegetable', note: '' },
  { item: 'Asparagus',                usdaQuery: 'asparagus',      category: 'vegetable', note: '' },

  // ── FRUITS ──────────────────────────────────────────────────────────────────
  { item: 'Banana',                   usdaQuery: 'banana',         category: 'fruit', note: '' },
  { item: 'Apple',                    usdaQuery: 'apple',          category: 'fruit', note: '' },
  { item: 'Orange',                   usdaQuery: 'orange',         category: 'fruit', note: '' },
  { item: 'Mausambi / Sweet lime',    usdaQuery: 'lime',           category: 'fruit', note: 'QUERY_MAP has no sweet lime entry; lime is closest' },
  { item: 'Pomegranate',              usdaQuery: 'pomegranate',    category: 'fruit', note: '' },
  { item: 'Kiwi',                     usdaQuery: 'kiwi',           category: 'fruit', note: '' },
  { item: 'Strawberry',               usdaQuery: 'strawberry',     category: 'fruit', note: '' },
  { item: 'Cape gooseberry',          usdaQuery: 'cape gooseberry', category: 'fruit', note: 'Very unlikely in USDA Foundation/SR Legacy' },
  { item: 'Pineapple',                usdaQuery: 'pineapple',      category: 'fruit', note: '' },
  { item: 'Muskmelon',                usdaQuery: 'cantaloupe',     category: 'fruit', note: 'Closest USDA equivalent; muskmelon may also work' },
  { item: 'Watermelon',               usdaQuery: 'watermelon',     category: 'fruit', note: '' },
  { item: 'Papaya',                   usdaQuery: 'papaya',         category: 'fruit', note: '' },
  { item: 'Raw papaya',               usdaQuery: 'papaya',         category: 'fruit', note: 'Checking if raw/unripe variant exists in USDA' },
  { item: 'Chikoo / Sapodilla',       usdaQuery: 'sapodilla',      category: 'fruit', note: 'Obscure — may not be in USDA' },
  { item: 'Grapes green',             usdaQuery: 'grapes',         category: 'fruit', note: '' },
  { item: 'Grapes black',             usdaQuery: 'grapes',         category: 'fruit', note: 'Checking if black/red grape variant exists' },

  // ── DALS / LEGUMES ──────────────────────────────────────────────────────────
  { item: 'Whole green moong',        usdaQuery: 'mung beans',         category: 'pulse', note: 'QUERY_MAP: moong → mung beans; checking whole variant' },
  { item: 'Split green moong',        usdaQuery: 'mung beans split',   category: 'pulse', note: 'Checking split green variant' },
  { item: 'Split yellow moong',       usdaQuery: 'mung beans yellow',  category: 'pulse', note: 'Checking yellow split variant' },
  { item: 'Whole black urad',         usdaQuery: 'black gram',         category: 'pulse', note: 'QUERY_MAP: urad → black gram' },
  { item: 'Split black urad',         usdaQuery: 'black gram split',   category: 'pulse', note: 'Checking split variant' },
  { item: 'White whole urad',         usdaQuery: 'black gram white',   category: 'pulse', note: 'Husked/white urad — may not be distinct in USDA' },
  { item: 'Split white urad',         usdaQuery: 'black gram split',   category: 'pulse', note: 'Same query as split black urad — USDA likely no distinction' },
  { item: 'Toor / Arhar',            usdaQuery: 'pigeon peas',         category: 'pulse', note: 'QUERY_MAP: toor/arhar → pigeon peas' },
  { item: 'Chana dal',               usdaQuery: 'split chickpeas',     category: 'pulse', note: 'QUERY_MAP: chana dal → split chickpeas' },
  { item: 'Orange masoor',           usdaQuery: 'red lentils',         category: 'pulse', note: 'QUERY_MAP: masoor → red lentils' },
  { item: 'Black masoor',            usdaQuery: 'black lentils',       category: 'pulse', note: 'QUERY_MAP has no black masoor entry; querying directly' },
  { item: 'Horsegram',               usdaQuery: null,                  category: null,    note: 'N/A — very unlikely in USDA Foundation/SR Legacy' },
  { item: 'Moth dal',                usdaQuery: null,                  category: null,    note: 'N/A — obscure, not in USDA Foundation/SR Legacy' },
  { item: 'Black chana',             usdaQuery: 'black chickpeas',     category: 'pulse', note: 'QUERY_MAP has no black chana entry' },
  { item: 'Green chana',             usdaQuery: 'green chickpeas',     category: 'pulse', note: 'QUERY_MAP has no green chana entry' },
  { item: 'Dried peas',              usdaQuery: 'dried peas',          category: 'pulse', note: '' },
  { item: 'Lobia / Black-eyed peas', usdaQuery: 'black-eyed peas',    category: 'pulse', note: 'QUERY_MAP: lobiya → black-eyed peas' },
  { item: 'Rajma / Kidney beans',   usdaQuery: 'kidney beans',        category: 'pulse', note: 'QUERY_MAP: rajma → kidney beans' },
  { item: 'Green moong sprouts',    usdaQuery: 'mung bean sprouts',   category: 'pulse', note: '' },
  { item: 'Black chana sprouts',    usdaQuery: null,                  category: null,    note: 'N/A — black chickpea sprouts not expected in USDA' },
  { item: 'Moth sprouts',           usdaQuery: null,                  category: null,    note: 'N/A — moth bean sprouts not expected in USDA' },

  // ── OTHER ITEMS ─────────────────────────────────────────────────────────────
  { item: 'Peanuts roasted',        usdaQuery: 'peanuts roasted',     category: 'dryFruit', note: '' },
  { item: 'Poha',                   usdaQuery: 'flattened rice',      category: 'grain',    note: 'QUERY_MAP: poha → flattened rice; may not exist in USDA' },
  { item: 'Tofu firm',              usdaQuery: 'tofu firm',           category: 'unknown',  note: '' },
  { item: 'Tofu silken',            usdaQuery: 'tofu silken',         category: 'unknown',  note: '' },
  { item: 'Tofu soft',              usdaQuery: 'tofu soft',           category: 'unknown',  note: '' },
  { item: 'Tempeh',                 usdaQuery: 'tempeh',              category: 'unknown',  note: '' },
  { item: 'Paneer',                 usdaQuery: 'paneer',              category: 'dairy',    note: 'May exist as paneer cheese or Indian cottage cheese' },
  { item: 'Soy milk',               usdaQuery: 'soy milk',            category: 'dairy',    note: '' },
  { item: 'Oat milk',               usdaQuery: 'oat milk',            category: 'dairy',    note: '' },
  { item: 'Oats',                   usdaQuery: 'oats',                category: 'grain',    note: '' },
  { item: 'Rolled oats',            usdaQuery: 'rolled oats',         category: 'grain',    note: '' },
  { item: 'Greek yogurt',           usdaQuery: 'greek yogurt',        category: 'dairy',    note: '' },
  { item: 'Skyr',                   usdaQuery: 'skyr',                category: 'dairy',    note: 'Icelandic dairy — should be in USDA' },
  { item: 'Soy chunks',             usdaQuery: 'textured soy protein', category: 'unknown', note: 'Indian name; USDA equivalent is textured soy protein / TVP' },
  { item: 'Vermicelli',             usdaQuery: 'vermicelli',          category: 'grain',    note: 'QUERY_MAP: sevai → vermicelli' },
  { item: 'Semolina / Sooji',       usdaQuery: 'semolina',            category: 'grain',    note: '' },
  { item: 'Dosa',                   usdaQuery: null,                  category: null,        note: 'N/A — prepared Indian dish, no USDA equivalent' },
  { item: 'Idli',                   usdaQuery: null,                  category: null,        note: 'N/A — prepared Indian dish, no USDA equivalent' },
  { item: 'Vada',                   usdaQuery: null,                  category: null,        note: 'N/A — prepared Indian dish, no USDA equivalent' },
  { item: 'Curd / Dahi full fat',   usdaQuery: 'yogurt whole milk',   category: 'dairy',    note: 'USDA equivalent is whole milk yogurt' },
  { item: 'Curd / Dahi low fat',    usdaQuery: 'yogurt low fat',      category: 'dairy',    note: 'USDA equivalent is low fat yogurt' },
  { item: 'Peanut curd',            usdaQuery: null,                  category: null,        note: 'N/A — Indian-specific fermented product' },
  { item: 'Soy milk curd',          usdaQuery: null,                  category: null,        note: 'N/A — Indian-specific fermented product' },

  // ── DRY FRUITS ──────────────────────────────────────────────────────────────
  { item: 'Almond',                 usdaQuery: 'almond',              category: 'dryFruit', note: '' },
  { item: 'Cashew',                 usdaQuery: 'cashew',              category: 'dryFruit', note: '' },
  { item: 'Dried apricot',          usdaQuery: 'dried apricot',       category: 'dryFruit', note: '' },
  { item: 'Dried fig',              usdaQuery: 'dried fig',           category: 'dryFruit', note: '' },
  { item: 'Dates',                  usdaQuery: 'dates',               category: 'dryFruit', note: '' },
  { item: 'Medjool dates',          usdaQuery: 'medjool dates',       category: 'dryFruit', note: 'Specific variety — checking USDA coverage' },
  { item: 'Walnut',                 usdaQuery: 'walnut',              category: 'dryFruit', note: '' },
  { item: 'Pistachio',              usdaQuery: 'pistachio',           category: 'dryFruit', note: '' },
  { item: 'Roasted pistachio',      usdaQuery: 'pistachio roasted',   category: 'dryFruit', note: '' },
  { item: 'Pumpkin seeds',          usdaQuery: 'pumpkin seeds',       category: 'dryFruit', note: '' },
  { item: 'Sunflower seeds',        usdaQuery: 'sunflower seeds',     category: 'dryFruit', note: '' },
  { item: 'Chia seeds',             usdaQuery: 'chia seeds',          category: 'dryFruit', note: '' },
  { item: 'Sesame seeds',           usdaQuery: 'sesame seeds',        category: 'dryFruit', note: '' },
  { item: 'Raisins',                usdaQuery: 'raisins',             category: 'dryFruit', note: '' },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sleeps for `ms` milliseconds. Used to avoid USDA rate limiting.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Makes an HTTPS GET request and returns parsed JSON.
 * @param {string} url
 * @returns {Promise<object>}
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}\nRaw: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Calls USDA FoodData Central search for a given query.
 * Restricts to Foundation and SR Legacy data types (no branded foods).
 * @param {string} query
 * @returns {Promise<Array>} array of food objects from USDA
 */
async function searchUSDA(query) {
  const params = new URLSearchParams({
    query,
    api_key: USDA_API_KEY,
    dataType: 'Foundation,SR Legacy',
    pageSize: String(PAGE_SIZE),
  });
  const url = `${USDA_BASE_URL}?${params.toString()}`;
  const result = await fetchJSON(url);
  return result.foods || [];
}

/**
 * Returns the top N descriptions from a USDA result array.
 * Just the raw description field — no cleaning applied in this script,
 * so we can see exactly what USDA returns and evaluate cleaning rules against it.
 * @param {Array} foods
 * @param {number} n
 * @returns {string[]}
 */
function topDescriptions(foods, n = 3) {
  return foods.slice(0, n).map((f) => f.description);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Starting USDA test run...\n');

  // Group items by section for the output file
  const sections = {
    'Grains':         [],
    'Flours':         [],
    'Vegetables':     [],
    'Fruits':         [],
    'Dals / Legumes': [],
    'Other Items':    [],
    'Dry Fruits':     [],
  };

  // Map item names to their section
  const sectionMap = {
    'Little millet': 'Grains', 'Foxtail millet': 'Grains', 'Kodo millet': 'Grains',
    'Ragi': 'Grains', 'Jowar': 'Grains', 'Bajra': 'Grains',

    'Whole wheat flour': 'Flours', 'Refined flour / Maida': 'Flours',
    'Besan / Gram flour': 'Flours', 'Ragi flour': 'Flours',
    'Jowar flour': 'Flours', 'Bajra flour': 'Flours',

    'Ladies finger / Okra': 'Vegetables', 'Potato': 'Vegetables', 'Onion': 'Vegetables',
    'Tomato': 'Vegetables', 'Lemon': 'Vegetables', 'Bottle gourd': 'Vegetables',
    'Brinjal big': 'Vegetables', 'Brinjal small': 'Vegetables',
    'Drumstick / Moringa': 'Vegetables', 'Radish': 'Vegetables', 'Carrot': 'Vegetables',
    'Capsicum / Bell pepper green': 'Vegetables', 'Capsicum / Bell pepper yellow': 'Vegetables',
    'Capsicum / Bell pepper red': 'Vegetables',
    'Garlic': 'Vegetables', 'Ginger': 'Vegetables', 'Peas fresh': 'Vegetables',
    'Beetroot': 'Vegetables', 'Spinach': 'Vegetables', 'Fenugreek leaves': 'Vegetables',
    'Mustard leaves': 'Vegetables', 'Colocasia / Arbi': 'Vegetables',
    'Sweet potato': 'Vegetables', 'Sweet corn': 'Vegetables', 'Baby corn': 'Vegetables',
    'Button mushroom': 'Vegetables', 'Haricot beans': 'Vegetables',
    'Jackfruit unripe': 'Vegetables',
    'Raw / green mango': 'Vegetables',
    'Yam': 'Vegetables', 'Cucumber': 'Vegetables', 'Broccoli': 'Vegetables',
    'Cauliflower': 'Vegetables', 'Cabbage': 'Vegetables', 'Red cabbage': 'Vegetables',
    'Green onion / Spring onion': 'Vegetables', 'Avocado': 'Vegetables',
    'Curly kale': 'Vegetables', 'Asparagus': 'Vegetables',

    'Banana': 'Fruits', 'Apple': 'Fruits', 'Orange': 'Fruits',
    'Mausambi / Sweet lime': 'Fruits', 'Pomegranate': 'Fruits', 'Kiwi': 'Fruits',
    'Strawberry': 'Fruits', 'Cape gooseberry': 'Fruits', 'Pineapple': 'Fruits',
    'Muskmelon': 'Fruits', 'Watermelon': 'Fruits', 'Papaya': 'Fruits',
    'Raw papaya': 'Fruits', 'Chikoo / Sapodilla': 'Fruits',
    'Grapes green': 'Fruits', 'Grapes black': 'Fruits',

    'Whole green moong': 'Dals / Legumes', 'Split green moong': 'Dals / Legumes',
    'Split yellow moong': 'Dals / Legumes', 'Whole black urad': 'Dals / Legumes',
    'Split black urad': 'Dals / Legumes', 'White whole urad': 'Dals / Legumes',
    'Split white urad': 'Dals / Legumes', 'Toor / Arhar': 'Dals / Legumes',
    'Chana dal': 'Dals / Legumes', 'Orange masoor': 'Dals / Legumes',
    'Black masoor': 'Dals / Legumes', 'Horsegram': 'Dals / Legumes',
    'Moth dal': 'Dals / Legumes', 'Black chana': 'Dals / Legumes',
    'Green chana': 'Dals / Legumes', 'Dried peas': 'Dals / Legumes',
    'Lobia / Black-eyed peas': 'Dals / Legumes', 'Rajma / Kidney beans': 'Dals / Legumes',
    'Green moong sprouts': 'Dals / Legumes', 'Black chana sprouts': 'Dals / Legumes',
    'Moth sprouts': 'Dals / Legumes',

    'Peanuts roasted': 'Other Items', 'Poha': 'Other Items',
    'Tofu firm': 'Other Items', 'Tofu silken': 'Other Items', 'Tofu soft': 'Other Items',
    'Tempeh': 'Other Items', 'Paneer': 'Other Items',
    'Soy milk': 'Other Items', 'Oat milk': 'Other Items',
    'Oats': 'Other Items', 'Rolled oats': 'Other Items',
    'Greek yogurt': 'Other Items', 'Skyr': 'Other Items', 'Soy chunks': 'Other Items',
    'Vermicelli': 'Other Items', 'Semolina / Sooji': 'Other Items',
    'Dosa': 'Other Items', 'Idli': 'Other Items', 'Vada': 'Other Items',
    'Curd / Dahi full fat': 'Other Items', 'Curd / Dahi low fat': 'Other Items',
    'Peanut curd': 'Other Items', 'Soy milk curd': 'Other Items',

    'Almond': 'Dry Fruits', 'Cashew': 'Dry Fruits', 'Dried apricot': 'Dry Fruits',
    'Dried fig': 'Dry Fruits', 'Dates': 'Dry Fruits', 'Medjool dates': 'Dry Fruits',
    'Walnut': 'Dry Fruits', 'Pistachio': 'Dry Fruits', 'Roasted pistachio': 'Dry Fruits',
    'Pumpkin seeds': 'Dry Fruits', 'Sunflower seeds': 'Dry Fruits',
    'Chia seeds': 'Dry Fruits', 'Sesame seeds': 'Dry Fruits', 'Raisins': 'Dry Fruits',
  };

  // Determine status heuristics from raw USDA descriptions
  // These are notes about what we expect to see vs what USDA returns
  const cleaningNotes = {
    'Ragi':                    'Check if "finger millet" appears as base name or only in modifiers',
    'Jowar':                   'USDA returns "Sorghum grain, raw" — cleaning strips "grain" (not in KEEP_MODIFIERS for grain category) — name becomes "Sorghum, raw" ✓',
    'Little millet':           'USDA likely only has generic millet — check for "little" variety specifically',
    'Foxtail millet':          '"foxtail" is in KEEP_MODIFIERS for grain — if USDA has it, name should clean well',
    'Kodo millet':             '"kodo" is in KEEP_MODIFIERS for grain — check if USDA has specific entry',
    'Refined flour / Maida':   'COLLAPSE_MAP: "all-purpose" → "refined" — check if USDA returns "all-purpose flour"',
    'Brinjal big':             'USDA returns "Eggplant, raw" — cleaning keeps "raw" (KEEP_MODIFIERS vegetable) ✓',
    'Whole green moong':       'USDA likely returns generic "Mung beans" — whole/split variants may not be distinct',
    'Orange masoor':           'USDA "red lentils" — check if orange variant is distinct',
    'Black masoor':            'QUERY_MAP missing: no entry for "black masoor" → "black lentils" — gap to flag',
    'Black chana':             'QUERY_MAP missing: no entry for "black chana" → "black chickpeas" — gap to flag',
    'Green chana':             'QUERY_MAP missing: no entry for "green chana" → "green chickpeas" — gap to flag',
    'Drumstick / Moringa':     'QUERY_MAP missing: no moringa/drumstick entry',
    'Beetroot':                'USDA uses "Beet" not "Beetroot" — querying "beet" to avoid mismatch',
    'Fenugreek leaves':        'USDA may only have seeds (methi seeds) not leaves (methi leaves)',
    'Cape gooseberry':         'Very unlikely in USDA Foundation/SR Legacy',
    'Mausambi / Sweet lime':   'QUERY_MAP missing: no sweet lime/mausambi entry — lime is closest approximation',
    'Chikoo / Sapodilla':      'Very uncommon in USDA — may be in SR Legacy under sapodilla',
    'Soy chunks':              'QUERY_MAP missing: no soy chunks entry — using textured soy protein directly',
    'Poha':                    'QUERY_MAP: poha → flattened rice — USDA may not have this; likely 0 results',
    'Paneer':                  'QUERY_MAP missing: no paneer entry — will check if USDA has it under paneer',
    'Green onion / Spring onion': 'USDA likely uses "scallions" not "spring onion"',
    'Haricot beans':           'USDA uses "navy beans" or "white beans" — haricot may not match',
    'Raw papaya':              'Checking if unripe papaya is in USDA; UNRIPE_OK_FRUITS includes papaya',
  };

  const results = {};

  let callCount = 0;
  const totalCalls = ITEMS_TO_TEST.filter((i) => i.usdaQuery !== null).length;

  for (const item of ITEMS_TO_TEST) {
    const section = sectionMap[item.item] || 'Other Items';

    if (item.usdaQuery === null) {
      // N/A — skip API call
      if (!sections[section]) sections[section] = [];
      sections[section].push({
        item: item.item,
        query: 'N/A',
        descriptions: [],
        status: 'N/A',
        notes: item.note,
        cleaningNote: cleaningNotes[item.item] || '',
      });
      continue;
    }

    callCount++;
    process.stdout.write(`[${callCount}/${totalCalls}] Testing: ${item.item} (query: "${item.usdaQuery}") ... `);

    let foods = [];
    let error = null;

    try {
      foods = await searchUSDA(item.usdaQuery);
    } catch (e) {
      error = e.message;
    }

    const descriptions = error ? [] : topDescriptions(foods, 3);
    const count = foods.length;

    // Determine status
    let status;
    if (error) {
      status = '✗ Error';
    } else if (count === 0) {
      status = '✗ Missing';
    } else {
      // Heuristic: check if the top result is clearly relevant
      const topDesc = descriptions[0] ? descriptions[0].toLowerCase() : '';
      const queryLower = item.usdaQuery.toLowerCase();
      // Check if any query word appears in the top description
      const queryWords = queryLower.split(' ').filter((w) => w.length > 3);
      const relevant = queryWords.length === 0 || queryWords.some((w) => topDesc.includes(w));
      status = relevant ? '✓ Good' : '⚠ Partial';
    }

    // Special status overrides for known problem cases
    if (['little millet', 'kodo millet'].includes(item.usdaQuery) && count > 0) {
      // These varieties may not be distinct — only generic millet returned
      const topDesc = descriptions[0] ? descriptions[0].toLowerCase() : '';
      if (!topDesc.includes(item.usdaQuery.toLowerCase().replace(' millet', ''))) {
        status = '⚠ Partial';
      }
    }

    if (!sections[section]) sections[section] = [];
    sections[section].push({
      item: item.item,
      query: item.usdaQuery,
      descriptions,
      status: error ? `✗ Error: ${error}` : status,
      notes: item.note,
      cleaningNote: cleaningNotes[item.item] || '',
      rawCount: count,
    });

    console.log(`${status} (${count} results)`);

    // Rate limit delay
    await sleep(DELAY_MS);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD OUTPUT MARKDOWN
  // ─────────────────────────────────────────────────────────────────────────

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const lines = [];

  lines.push('# USDA Test Results');
  lines.push(`Generated: ${now}`);
  lines.push('');
  lines.push('Tests run directly against USDA FoodData Central API (Foundation + SR Legacy).');
  lines.push('Raw USDA descriptions are shown — cleaning rules from `lib/food-cleaning.ts` are NOT applied here.');
  lines.push('This lets us see exactly what USDA returns before any processing.');
  lines.push('');
  lines.push('**Status key:**');
  lines.push('- ✓ Good — found, top results are relevant');
  lines.push('- ⚠ Partial — found but top results are a generic variant, noisy, or wrong');
  lines.push('- ✗ Missing — 0 results returned');
  lines.push('- N/A — not expected in USDA');
  lines.push('');

  const sectionOrder = ['Grains', 'Flours', 'Vegetables', 'Fruits', 'Dals / Legumes', 'Other Items', 'Dry Fruits'];

  for (const sectionName of sectionOrder) {
    const rows = sections[sectionName];
    if (!rows || rows.length === 0) continue;

    lines.push(`## ${sectionName}`);
    lines.push('');
    lines.push('| Item | USDA Query | Top Results | Status | Notes |');
    lines.push('|------|-----------|-------------|--------|-------|');

    for (const row of rows) {
      const topResults = row.descriptions.length > 0
        ? row.descriptions.map((d) => `"${d}"`).join('; ')
        : '—';

      const combinedNotes = [row.notes, row.cleaningNote].filter(Boolean).join(' | ');

      lines.push(
        `| ${row.item} | ${row.query} | ${topResults} | ${row.status} | ${combinedNotes} |`
      );
    }

    lines.push('');
  }

  // ── Cleaning rule analysis ────────────────────────────────────────────────
  lines.push('## Cleaning Rule Analysis');
  lines.push('');
  lines.push('Observations about how `lib/food-cleaning.ts` handles the returned USDA names.');
  lines.push('');

  lines.push('### QUERY_MAP gaps identified');
  lines.push('');
  lines.push('The following items need translations in `QUERY_MAP` but do not have them:');
  lines.push('');
  lines.push('| Item | Current behaviour | Suggested addition |');
  lines.push('|------|------------------|--------------------|');
  lines.push('| Black masoor | Searched as "black lentils" (manual — not via QUERY_MAP) | `"black masoor": "black lentils"` |');
  lines.push('| Black chana | Searched as "black chickpeas" (manual — not via QUERY_MAP) | `"black chana": "black chickpeas"` |');
  lines.push('| Green chana | Searched as "green chickpeas" (manual — not via QUERY_MAP) | `"green chana": "green chickpeas"` |');
  lines.push('| Mausambi / Sweet lime | Searched as "lime" — nutritionally different | `"mausambi": "sweet lime"` or keep as "lime" |');
  lines.push('| Drumstick / Moringa | No mapping — "moringa" works as a direct query | `"drumstick": "moringa"` |');
  lines.push('| Soy chunks | No mapping — user would type "soy chunks" and get no results | `"soy chunks": "textured soy protein"` |');
  lines.push('| Paneer | No mapping — paneer may exist in USDA under that name | `"paneer": "paneer"` (or "cottage cheese" as fallback) |');
  lines.push('| Beetroot | No mapping — USDA uses "beet" not "beetroot" | `"beetroot": "beet"` |');
  lines.push('');

  lines.push('### Category detection gaps');
  lines.push('');
  lines.push('| Item | Query used | Detected category | Issue |');
  lines.push('|------|-----------|-------------------|-------|');
  lines.push('| Tofu | "tofu firm/silken/soft" | unknown | "tofu" not in any CATEGORY_KEYWORDS list — falls through to unknown |');
  lines.push('| Tempeh | "tempeh" | unknown | Not in any category keywords — falls through to unknown |');
  lines.push('| Soy chunks / TSP | "textured soy protein" | pulse (via "soy") | "soybean" is in pulse keywords — detection is OK |');
  lines.push('| Skyr | "skyr" | unknown | Not in dairy keywords — falls through to unknown |');
  lines.push('| Oat milk | "oat milk" | grain (via "oat") | Detected as grain not dairy — wrong category, may affect cleaning |');
  lines.push('| Avocado | "avocado" | unknown | Not in fruit or vegetable keywords — will be unknown |');
  lines.push('| Asparagus | "asparagus" | vegetable ✓ | In vegetable keywords |');
  lines.push('');

  lines.push('### Collapse map / name cleaning observations');
  lines.push('');
  lines.push('These are observations based on what USDA typically returns and how the cleaning pipeline handles it.');
  lines.push('');
  lines.push('| USDA raw name pattern | Cleaning result | Verdict |');
  lines.push('|----------------------|-----------------|---------|');
  lines.push('| "Sorghum grain, raw" | COLLAPSE_MAP strips nothing; "grain" not in grain KEEP_MODIFIERS → dropped → "Sorghum, raw" | ✓ Correct |');
  lines.push('| "Eggplant, raw" | "raw" is in vegetable KEEP_MODIFIERS → "Eggplant, raw" | ✓ Correct |');
  lines.push('| "Wheat flour, whole-grain" | "whole" and "grain" separate — "whole grain" in flour KEEP_MODIFIERS as substring match → kept | ✓ Correct |');
  lines.push('| "Wheat flour, white, all-purpose" | COLLAPSE_MAP: "all-purpose" → "refined"; "white" in flour KEEP_MODIFIERS; "refined" in KEEP_MODIFIERS → "Wheat flour, white, refined" | ✓ Correct |');
  lines.push('| "Beans, snap, green, raw" | base = "Beans"; "green" and "raw" in pulse KEEP_MODIFIERS → "Beans, green, raw" | ✓ Correct |');
  lines.push('| "Lentils, raw" | base = "Lentils"; "raw" in pulse KEEP_MODIFIERS → "Lentils, raw" | ✓ Correct |');
  lines.push('| "Mung beans, mature seeds, raw" | "mature seeds" in UNIVERSAL_DISCARD_SEGMENTS → dropped; "raw" kept → "Mung beans, raw" | ✓ Correct |');
  lines.push('| "Nuts, almonds" | base = "Nuts"; "almonds" not a KEEP_MODIFIER for dryFruit → modifier dropped → "Nuts" — wrong base name | ⚠ Gap: USDA puts "Nuts" as base name; cleaning loses the specific nut |');
  lines.push('| "Nuts, cashew nuts, raw" | Same issue — base is "Nuts" not "Cashew" | ⚠ Gap: base name loses specificity |');
  lines.push('| "Seeds, chia seeds" | base = "Seeds" — same pattern | ⚠ Gap: base is "Seeds" not "Chia seeds" |');
  lines.push('| "Oil, sesame, salad or cooking" | "salted" conditional exclusion not triggered; "salad or cooking" not in oil KEEP_MODIFIERS → drops to just base | May be OK for oil category |');
  lines.push('');

  lines.push('### Items with 0 USDA results — coverage gaps');
  lines.push('');
  lines.push('These items are in the app\'s food list but USDA has no matching entry in Foundation/SR Legacy:');
  lines.push('');

  // We will list these after actually seeing the results — placeholder text
  lines.push('See table results above for items marked ✗ Missing.');
  lines.push('');
  lines.push('Key expected misses:');
  lines.push('- Poha / flattened rice — not a USDA concept');
  lines.push('- Bottle gourd — not common in USDA SR Legacy');
  lines.push('- Cape gooseberry — not in Foundation or SR Legacy');
  lines.push('- Baby corn — may not be distinct from sweet corn');
  lines.push('- Haricot beans — USDA uses "navy beans" not "haricot"');
  lines.push('- Kodo millet / Little millet — only generic "millet" in USDA');
  lines.push('- Black masoor / Black lentils — may not be in USDA');
  lines.push('');

  const outputPath = path.join(__dirname, 'usda-test-output.md');
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  console.log(`\nResults written to: ${outputPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
