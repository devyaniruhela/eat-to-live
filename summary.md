# Session Summary — 13 March 2026

## What Was Done

### P1 Bug Fixes — `lib/food-cleaning.ts` (all 5 done ✓)

1. **Nuts/Seeds base name bug** — `cleanFoodName()` now promotes the segment after "Nuts" or "Seeds" as the real base name. "Nuts, almonds, raw" now cleans to "Almonds, raw" instead of "Nuts, raw".

2. **Removed `urad → 'black gram'` from QUERY_MAP** — USDA has no black gram entry; query was returning chickpeas and pigeon peas. All urad variants are covered by `indian-foods.json`.

3. **Removed `'urad dal' → 'black gram'` from QUERY_MAP** — Same reason as above.

4. **Removed `'chana dal' → 'split chickpeas'` from QUERY_MAP** — Chana dal is split Bengal gram, not chickpeas. The USDA query was returning wrong results; chana dal is in the Indian JSON.

5. **Fixed `maida` QUERY_MAP** — Changed from `'refined wheat flour'` (which returned sorghum flour) to `'wheat flour all purpose'` (USDA's actual term).

6. **Bell pepper colour modifiers** — Added `'green'`, `'red'`, `'yellow'`, `'orange'` to `KEEP_MODIFIERS.vegetable`. Previously colour was being stripped from bell pepper results.

### P2 QUERY_MAP Additions — `lib/food-cleaning.ts` (all 10 done ✓)

Added 11 new entries to QUERY_MAP:
- `beetroot → 'beet'`
- `mausambi`, `mosambi`, `'sweet lime'` → `'lime'`
- `muskmelon`, `kharbooja`, `kharbuja` → `'cantaloupe'`
- `haricot`, `'haricot beans'` → `'navy beans'`
- `'soy chunks'` → `'textured vegetable protein'`
- `'dried peas'` → `'peas split green'`

Also added `'cantaloupe'` to `CATEGORY_KEYWORDS.fruit` and `'navy beans'` to `CATEGORY_KEYWORDS.pulse` to ensure correct category detection after QUERY_MAP translation.

### P5 Alias Gaps — `lib/indian-foods.json` (all 5 done ✓)

- **1001 Moong dal yellow split** — added: "split yellow moong", "moong dal yellow"
- **1004 Masoor dal red split** — added: "orange masoor", "malka masoor", "malka dal"
- **1005 Masoor dal whole brown** — added: "black masoor", "kali masoor"
- **2002 Kala chana** — added: "black chana", "bengal gram black"
- **5023 French beans** — added: "snap beans", "frasier beans"; **removed** "haricot beans" alias (haricot = navy bean, not French bean)

---

## What Was NOT Completed

### P4 Indian JSON Additions (USDA pre-populate) — BLOCKED

Task requires live HTTP calls to the USDA FoodData Central API to fetch per-100g nutrient values for 16 new food items. Both the Bash tool and WebFetch were unavailable in this session.

**Items queued for next session** (IDs pre-assigned in `fix-progress.md`):
- 6027 Muskmelon, 6028 Cape gooseberry, 6029 Grapes green, 6030 Grapes black
- 5024 Radish, 5025 Mustard greens, 5026 Yam, 5027 Red cabbage, 5028 Spring onion
- 5029 Button mushroom, 5030 Asparagus, 5031 Kale, 5032 Broccoli
- 6031 Avocado, 4007 Jowar flour, 2008 Haricot beans

---

## Decisions Made

- **Urad and chana dal are Indian-JSON-only items.** Any USDA fallback for these actively returns wrong results and is worse than no result at all.
- **Haricot beans ≠ French beans.** The existing alias was incorrect and has been removed from French beans (5023). Haricot will be its own separate entry (2008) once P4 is completed.
- **Nuts/Seeds fix uses Option 3** (promote the next segment as base) — cleanest approach that doesn't require special-casing every individual nut/seed.

---

## Trade-offs

- The `'sweet lime'` → `'lime'` QUERY_MAP mapping is an imperfect proxy — mausambi is nutritionally distinct from lime (sweeter, milder). A proper IFCT entry for mausambi is in P3, but for now USDA lime is better than no result.
- P4 items are pre-populated from USDA values rather than IFCT — appropriate for items like broccoli, asparagus, kale that aren't meaningfully documented in Indian nutrition databases.

---

## What's Next

1. **Complete P4** — Grant Bash/WebFetch access and re-run the USDA data fetch for the 16 pre-assigned items. See `fix-progress.md` for the full item list and IDs.
2. **P3 items** — Manual IFCT data entry for items USDA can't serve (fenugreek leaves, bajra flour, little/foxtail/kodo millets, mausambi, baby corn, lemon whole fruit).
3. **P7 UI items** — Near-term improvements (moong/peanuts surfacing bug, fast food filter, yellow capsicum, micronutrient display).
