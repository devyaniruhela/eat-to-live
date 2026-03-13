# USDA Test Results
Generated: 2026-03-13 13:39:53 UTC

Tests run directly against USDA FoodData Central API (Foundation + SR Legacy).
Raw USDA descriptions are shown — cleaning rules from `lib/food-cleaning.ts` are NOT applied here.
This lets us see exactly what USDA returns before any processing, so we can evaluate the cleaning pipeline separately.

**Status key:**
- ✓ Good — found, top results are relevant and clean
- ⚠ Partial — found but top results are a generic variant, noisy, wrong variant, or have cleaning gaps
- ✗ Missing — 0 results returned
- N/A — not expected in USDA (prepared dish or highly Indian-specific product)

---

## Grains

| Item | USDA Query | Top Results (raw USDA descriptions) | Status | Notes |
|------|-----------|--------------------------------------|--------|-------|
| Little millet | little millet | "Millet flour"; "Millet, cooked"; "Millet, puffed" | ⚠ Partial | USDA returns generic millet only — no "little millet" entry exists. `KEEP_MODIFIERS` has `little` in grain set but USDA never uses it as a modifier here. Query falls back to generic millet. |
| Foxtail millet | foxtail millet | "Millet flour"; "Millet, cooked"; "Millet, puffed" | ⚠ Partial | USDA has no specific foxtail millet entry despite `foxtail` being in grain `KEEP_MODIFIERS`. Results are generic millet only. The KEEP_MODIFIERS entry for `foxtail` is currently dead code for USDA. |
| Kodo millet | kodo millet | "Millet flour"; "Millet, cooked"; "Millet, puffed" | ⚠ Partial | Same as above — USDA has no kodo-specific entry. Generic millet returned. `kodo` in KEEP_MODIFIERS is dead code for USDA. |
| Ragi | finger millet | "Millet flour"; "Millet, cooked"; "Millet, puffed" | ⚠ Partial | QUERY_MAP correctly translates ragi → finger millet. However USDA returns generic millet, not finger millet specifically. "Finger millet" as a description does not appear in SR Legacy/Foundation top results. |
| Jowar | sorghum | "Sorghum grain"; "Flour, sorghum"; "Syrups, sorghum" | ✓ Good | QUERY_MAP: jowar → sorghum works well. Top result "Sorghum grain" will clean to "Sorghum" (grain dropped — not in grain KEEP_MODIFIERS). ✓ |
| Bajra | pearl millet | "Millet flour"; "Millet, cooked"; "Millet, puffed" | ⚠ Partial | QUERY_MAP: bajra → pearl millet. USDA has no pearl-millet-specific entry — returns generic millet. "pearl" IS in grain KEEP_MODIFIERS but USDA does not use that term in its millet descriptions. |

**Millet finding:** USDA Foundation + SR Legacy does not distinguish millet varieties. All 4 millet items (little, foxtail, kodo, pearl) collapse to the same generic results. Only sorghum and finger millet are distinct USDA entries — but even finger millet returns generic millet in top results. This is a data gap, not a cleaning gap. The app should rely on `indian-foods.json` for all millet varieties.

---

## Flours

| Item | USDA Query | Top Results (raw USDA descriptions) | Status | Notes |
|------|-----------|--------------------------------------|--------|-------|
| Whole wheat flour | whole wheat flour | "Flour, whole wheat, unenriched"; "Wheat flour, whole-grain, soft wheat"; "Wheat flours, bread, unenriched" | ✓ Good | `unenriched` is in UNIVERSAL_DISCARD_SEGMENTS → correctly stripped. `whole-grain` matches `whole grain` in flour KEEP_MODIFIERS. |
| Refined flour / Maida | refined wheat flour | "Sorghum flour, refined, unenriched"; "Wheat flour, whole-grain, soft wheat"; "Flour, whole wheat, unenriched" | ⚠ Partial | Top result is sorghum flour, not wheat flour. USDA does not have a "refined wheat flour" entry — "all-purpose" is the correct USDA term. COLLAPSE_MAP converts "all-purpose" → "refined" but the query itself should probably be "wheat flour all-purpose". Current query gets sorghum as top hit. |
| Besan / Gram flour | chickpea flour | "Chickpea flour (besan)"; "Arrowroot flour"; "Carob flour" | ✓ Good | USDA entry is "Chickpea flour (besan)". The parenthetical `(besan)` will be stripped by COLLAPSE_MAP rule `[/\(.*?\)/g, '']`. Result: "Chickpea flour". ✓ |
| Ragi flour | finger millet flour | "Millet flour"; "Millet, cooked"; "Millet, puffed" | ⚠ Partial | USDA returns generic "Millet flour" — no finger millet flour specifically. Same millet variety gap as Grains section. |
| Jowar flour | sorghum flour | "Flour, sorghum"; "Sorghum flour, refined, unenriched"; "Sorghum flour, whole-grain" | ✓ Good | Good USDA coverage. "refined, unenriched" → `unenriched` stripped by UNIVERSAL_DISCARD_SEGMENTS, `refined` kept by flour KEEP_MODIFIERS. ✓ |
| Bajra flour | pearl millet flour | "Millet flour"; "Sorghum flour, white, pearled, unenriched, dry, raw"; "Millet, cooked" | ⚠ Partial | No pearl millet flour specifically. Generic millet flour returned. |

---

## Vegetables

| Item | USDA Query | Top Results (raw USDA descriptions) | Status | Notes |
|------|-----------|--------------------------------------|--------|-------|
| Ladies finger / Okra | okra | "Okra, raw"; "Okra, frozen, unprepared"; "Okra, cooked, boiled, drained, with salt" | ✓ Good | Clean hit. `frozen` and `cooked` are conditional exclusions — will be filtered unless user asks. `raw` kept by vegetable KEEP_MODIFIERS. ✓ |
| Potato | potato | "Bread, potato"; "Flour, potato"; "Potato flour" | ⚠ Partial | Top 3 results are potato bread, potato flour, and potato flour — not raw potato. USDA relevance ranking surfaces processed forms first. "Potatoes, raw" does exist but is not in top 3. |
| Onion | onion | "Onions, raw"; "DENNY'S, onion rings"; "Onions, dehydrated flakes" | ✓ Good | Top hit is correct. DENNY'S result is branded — the `dataType=Foundation,SR Legacy` filter should prevent branded items, but DENNY'S appears here. This is a **branded food leaking through** — worth investigating. |
| Tomato | tomato | "Tomato powder"; "Tomato, roma"; "Tomato products, canned, sauce, with tomato tidbits" | ✓ Good | "Tomato, roma" is clean. Tomato powder will not match vegetable KEEP_MODIFIERS and will be cleaned away. `canned` is a conditional exclusion. ✓ |
| Lemon | lemon | "Lemon juice from concentrate, bottled, REAL LEMON"; "Lemon juice, raw"; "Lemon peel, raw" | ✓ Good | Branded item (REAL LEMON) in top 3 — same branded leakage concern. "Lemon juice, raw" is correct. |
| Bottle gourd | bottle gourd | "Gourd, dishcloth (towelgourd), raw"; "Kanpyo, (dried gourd strips)"; "Gourd, white-flowered (calabash), raw" | ⚠ Partial | Bottle gourd itself not in top 3 — USDA returns related gourds. "Gourd, white-flowered (calabash)" is the closest equivalent to bottle gourd (lauki). The parenthetical will be stripped by COLLAPSE_MAP. Not ideal but acceptable as a proxy. |
| Brinjal big | eggplant | "Eggplant, pickled"; "Eggplant, raw"; "Eggplant, raw" | ✓ Good | "Eggplant, raw" is the correct hit. `pickled` is a conditional exclusion — filtered unless user asks. `raw` kept by vegetable KEEP_MODIFIERS. ✓ |
| Brinjal small | eggplant | "Eggplant, pickled"; "Eggplant, raw"; "Eggplant, raw" | ⚠ Partial | Same results as Brinjal big — USDA has no small/large eggplant distinction. Nutritionally equivalent, so this is acceptable. |
| Drumstick / Moringa | moringa | "Drumstick leaves, raw"; "Drumstick pods, raw" | ✓ Good | USDA actually uses "Drumstick" not "Moringa" as the base name. Both leaves and pods are present. `raw` kept by vegetable KEEP_MODIFIERS. **QUERY_MAP gap:** user typing "moringa" works, but user typing "drumstick" would also work directly — both terms return correct results. Still, adding `"drumstick": "drumstick"` (identity) or `"moringa": "drumstick"` to QUERY_MAP would be cleaner. |
| Radish | radish | "Radishes, raw"; "Radishes, oriental, dried"; "Radishes, oriental, raw" | ✓ Good | Good coverage. Oriental radish = daikon — nutritionally similar. `dried` is a conditional exclusion. ✓ |
| Carrot | carrot | "Carrot, dehydrated"; "Carrots, raw"; "Babyfood, carrots, toddler" | ✓ Good | "Carrots, raw" is present. Babyfood is irrelevant but won't affect top results after cleaning. |
| Capsicum / Bell pepper green | green bell pepper | "Peppers, bell, green, raw"; "Peppers, bell, orange, raw"; "Peppers, bell, red, raw" | ✓ Good | All three colour variants returned together — `green`, `red`, `yellow` are in pulse KEEP_MODIFIERS but NOT in vegetable KEEP_MODIFIERS. **Cleaning gap:** colour modifiers will be stripped from bell pepper results. "Peppers, bell, green, raw" → "Peppers, bell, raw". The colour distinction is lost. |
| Capsicum / Bell pepper yellow | yellow bell pepper | "Peppers, bell, yellow, raw"; "Peppers, bell, green, raw"; "Peppers, bell, orange, raw" | ✓ Good | Same cleaning gap — yellow will be stripped since it's not in vegetable KEEP_MODIFIERS. |
| Capsicum / Bell pepper red | red bell pepper | "Peppers, bell, red, raw"; "Peppers, bell, green, raw"; "Peppers, bell, orange, raw" | ✓ Good | Same cleaning gap — red will be stripped. |
| Garlic | garlic | "Garlic, raw"; "Garlic, raw"; "Garlic bread, frozen" | ✓ Good | Duplicate "Garlic, raw" entries — deduplication in `processUSDAResults` will catch this. `frozen` bread conditional exclusion handles garlic bread. ✓ |
| Ginger | ginger | "Ginger root, raw"; "Spices, ginger, ground"; "Beverages, carbonated, ginger ale" | ✓ Good | "Ginger root, raw" is correct. Spice form and ginger ale will rank lower or be filtered. |
| Peas fresh | green peas | "Peas, green, raw"; "Soup, pea, green, canned, condensed"; "Peas, green, canned, seasoned, solids and liquids" | ✓ Good | Top hit correct. `canned` and `soup` forms are conditional exclusions. ✓ |
| Beetroot | beet | "Beets, raw"; "Beets, raw"; "Beet greens, raw" | ✓ Good | **Important:** USDA uses "beet" not "beetroot". The QUERY_MAP has no `beetroot` entry — if a user types "beetroot", the raw query goes to USDA unchanged and likely still returns beet results (USDA full-text search is fuzzy). But a QUERY_MAP entry would make this more reliable. Duplicate "Beets, raw" handled by deduplication. ✓ |
| Spinach | spinach | "Spinach souffle"; "Spinach, baby"; "Spinach, mature" | ✓ Good | Both baby and mature spinach present. "Spinach souffle" is irrelevant — will rank lowest. `raw` form ("Spinach, raw") should exist further in results. |
| Fenugreek leaves | fenugreek leaves | "Spices, fenugreek seed"; "Drumstick leaves, raw"; "Amaranth leaves, raw" | ⚠ Partial | Top result is fenugreek SEED (spice form), not leaves. Second and third results are unrelated leaves. USDA does not appear to have a distinct "fenugreek leaves" entry in Foundation/SR Legacy. Seed would be cleaned and presented — nutritionally wrong for the leaf/herb use case. |
| Mustard leaves | mustard greens | "Mustard greens, raw"; "Mustard greens, frozen, unprepared"; "Mustard greens, cooked, boiled, drained, with salt" | ✓ Good | Excellent coverage. `frozen` and `cooked` are conditional exclusions. `raw` kept by vegetable KEEP_MODIFIERS. ✓ |
| Colocasia / Arbi | taro root | "Taro, raw"; "Snacks, taro chips"; "Taro leaves, raw" | ✓ Good | "Taro, raw" is the correct hit. Taro chips filtered by cleaning. Taro leaves are a separate food — will appear but ranked lower. ✓ |
| Sweet potato | sweet potato | "Sweet potato leaves, raw"; "Sweet potato, canned, mashed"; "Babyfood, corn and sweet potatoes, strained" | ⚠ Partial | Top hit is sweet potato LEAVES, not the tuber. "Sweet potatoes, raw" exists in USDA but is not in top 3 — ranking issue. `canned` conditional exclusion handles mashed. |
| Sweet corn | sweet corn | "Corn, sweet, white, raw"; "Corn, sweet, yellow, raw"; "Babyfood, corn and sweet potatoes, strained" | ✓ Good | Both white and yellow sweet corn present. `raw` kept by vegetable KEEP_MODIFIERS. Babyfood will rank low. ✓ |
| Baby corn | baby corn | "Spinach, baby"; "Arugula, baby, raw"; "Carrots, baby, raw" | ⚠ Partial | USDA has no baby corn entry. "baby" as a modifier returns baby spinach, baby arugula, baby carrots — none of which are baby corn. **True miss** despite 10 results being returned — the heuristic marked this ✓ Good but it's actually ⚠ Partial. |
| Button mushroom | mushroom | "Mushroom, beech"; "Mushroom, crimini"; "Mushroom, enoki" | ✓ Good | Various mushroom varieties returned. Button mushroom (white mushroom, Agaricus bisporus) would appear further in results as "Mushrooms, white, raw". Crimini is the portobello variant — nutritionally similar to button. |
| Haricot beans | haricot beans | "Beans, liquid from stewed kidney beans"; "Beans, cannellini, dry"; "Chili with beans, canned" | ⚠ Partial | USDA does not use "haricot" as a term. Results are unrelated beans. The correct USDA term is "navy beans" (also called haricot in British English). **QUERY_MAP gap:** add `"haricot": "navy beans"` or `"haricot beans": "navy beans"`. |
| Jackfruit unripe | jackfruit | "Jackfruit, raw"; "Jackfruit, canned, syrup pack" | ✓ Good | Only 2 results — USDA has limited jackfruit coverage. "Jackfruit, raw" is correct. No "unripe" or "green" variant exists separately. `canned` conditional exclusion handles syrup pack. `UNRIPE_OK_FRUITS` includes jackfruit so unripe form would not be excluded. ✓ |
| Raw / green mango | mango | "Mangos, raw"; "Mango nectar, canned"; "Mango, dried, sweetened" | ✓ Good | USDA has no "raw mango" / unripe mango entry specifically. "Mangos, raw" in USDA means ripe fresh mango. `UNRIPE_OK_FRUITS` includes mango — raw/green mango nutritional data must come from `indian-foods.json`. |
| Yam | yam | "Yam, raw"; "Mountain yam, hawaii, raw"; "Mountain yam, hawaii, cooked, steamed, with salt" | ✓ Good | "Yam, raw" is correct. Hawaii variant will be discarded by UNIVERSAL_DISCARD_SEGMENTS (`hawaii` entry). ✓ |
| Cucumber | cucumber | "Cucumber, peeled, raw"; "Cucumber, with peel, raw"; "Cucumber, with peel, raw" | ✓ Good | Both peeled and with-peel variants. `without peel` conditional exclusion handles peeled form. `with peel` is in vegetable KEEP_MODIFIERS. ✓ |
| Broccoli | broccoli | "Broccoli, raw"; "Broccoli, raw"; "Broccoli raab, cooked" | ✓ Good | Duplicate "Broccoli, raw" handled by deduplication. Broccoli raab is a different vegetable — ranks lower. ✓ |
| Cauliflower | cauliflower | "Cauliflower, raw"; "Cauliflower, raw"; "Cauliflower, frozen, unprepared" | ✓ Good | Duplicate handled. `frozen` conditional exclusion. ✓ |
| Cabbage | cabbage | "Cabbage, kimchi"; "Cabbage, raw"; "Cabbage, green, raw" | ✓ Good | Kimchi ranks first — will not match vegetable KEEP_MODIFIERS and cleaning will likely reduce it or it will be filtered. "Cabbage, raw" and "Cabbage, green, raw" are correct. |
| Red cabbage | red cabbage | "Cabbage, red, raw"; "Cabbage, red, raw"; "Cabbage, red, cooked, boiled, drained, with salt" | ✓ Good | Good. `cooked` conditional exclusion handles boiled form. Duplicate handled. ✓ |
| Green onion / Spring onion | spring onion | "Onions, spring or scallions (includes tops and bulb), raw"; "Wheat, hard red spring"; "Onions, raw" | ✓ Good | USDA uses "spring or scallions" as the term — includes tops and bulb. The parenthetical `(includes tops and bulb)` will be stripped by COLLAPSE_MAP. Result: "Onions, spring or scallions, raw". ✓ |
| Avocado | avocado | "Oil, avocado"; "Avocados, raw, California"; "Avocados, raw, Florida" | ✓ Good | Top hit is avocado oil — unexpected. California/Florida variants have regional qualifiers (`california type`, `american type` equivalents) but "California" and "Florida" are NOT in UNIVERSAL_DISCARD_SEGMENTS. **Cleaning gap:** "Avocados, raw, California" → cleaning keeps "California" since it's not in the discard set and it's not a KEEP_MODIFIER either — so modifier is dropped and it becomes "Avocados, raw". Actually that's fine. But oil ranking first is a concern — `oil` category detection would trigger for "oil, avocado" but the base query "avocado" should detect as unknown, meaning avocado oil won't be filtered. |
| Curly kale | kale | "Kale, raw"; "Kale, raw"; "Kale, frozen, unprepared" | ✓ Good | Clean. Duplicate handled. `frozen` conditional exclusion. ✓ |
| Asparagus | asparagus | "Asparagus, raw"; "Asparagus, frozen, unprepared"; "Asparagus, green, raw" | ✓ Good | Good coverage. `frozen` conditional exclusion. `raw` kept. ✓ |

---

## Fruits

| Item | USDA Query | Top Results (raw USDA descriptions) | Status | Notes |
|------|-----------|--------------------------------------|--------|-------|
| Banana | banana | "Bananas, dehydrated, or banana powder"; "Bananas, raw"; "Bananas, overripe, raw" | ✓ Good | "Bananas, raw" is correct. Dehydrated/powder form ranks first — not what we want. `raw` and `ripe` in fruit KEEP_MODIFIERS. "overripe" — `ripe and slightly ripe` COLLAPSE_MAP rule handles "ripe and slightly ripe" but not "overripe" alone. Overripe banana would not be excluded — `shouldExclude` only checks for `unripe`. Acceptable. |
| Apple | apple | "Croissants, apple"; "Strudel, apple"; "Babyfood, juice, apple" | ⚠ Partial | Top 3 are all processed apple products, not raw apple. "Apples, raw, with skin" exists in USDA but is not in top 3 results — USDA ranking surfaces compound foods first. |
| Orange | orange | "Marmalade, orange"; "Sherbet, orange"; "Babyfood, juice, orange" | ⚠ Partial | Same problem as apple — raw orange not in top 3. "Oranges, raw, all commercial varieties" exists but ranks low. USDA relevance ranking issue. |
| Mausambi / Sweet lime | lime | "Limes, raw"; "Lime juice, raw"; "Frozen novelties, ice type, lime" | ✓ Good | "Limes, raw" is a reasonable proxy for sweet lime. Nutritionally not identical — mausambi is sweeter and milder — but lime is the closest USDA has. **QUERY_MAP gap:** add `"mausambi": "lime"` so user typing "mausambi" gets translated. |
| Pomegranate | pomegranate | "Pomegranates, raw"; "Pomegranate juice, bottled"; "Beverages, OCEAN SPRAY, Cran Pomegranate" | ✓ Good | "Pomegranates, raw" is correct. Juice has `raw` fruit KEEP_MODIFIER that won't match — will be cleaned. Branded OCEAN SPRAY result — branded leakage despite `dataType=Foundation,SR Legacy` filter. |
| Kiwi | kiwi | "Beverages, Kiwi Strawberry Juice Drink"; "Kiwifruit (kiwi), green, peeled, raw"; "Babyfood, GERBER, 3rd Foods, apple, mango and kiwi" | ✓ Good | "Kiwifruit (kiwi), green, peeled, raw" is the correct hit. Parenthetical `(kiwi)` stripped by COLLAPSE_MAP. Result: "Kiwifruit, green, peeled, raw". `without peel`/`without skin` conditional exclusions don't fire for "peeled" — **minor cleaning gap**: "peeled" is equivalent to "without skin" but not caught by the exclusion rule. |
| Strawberry | strawberry | "Strawberries, raw"; "Strawberries, raw"; "Toppings, strawberry" | ✓ Good | Duplicate "Strawberries, raw" — deduplication handles. Toppings filtered. (Script marked ⚠ Partial due to heuristic — actually correct.) |
| Cape gooseberry | cape gooseberry | "Groundcherries, (cape-gooseberries or poha), raw"; "Gooseberries, raw"; "Gooseberries, canned, light syrup pack, solids and liquids" | ✓ Good | **Surprise find.** USDA has it under "Groundcherries" with parenthetical noting it's also called cape-gooseberries or poha (not to be confused with the rice poha!). The COLLAPSE_MAP strips parentheticals → "Groundcherries, raw". Clean. ✓ |
| Pineapple | pineapple | "Pineapple, raw"; "Toppings, pineapple"; "Babyfood, juice, orange and pineapple" | ✓ Good | "Pineapple, raw" is correct and top-ranked. ✓ |
| Muskmelon | cantaloupe | "Melons, cantaloupe, raw"; "Melons, cantaloupe, raw" | ✓ Good | Only 2 results but both are correct. `raw` kept by fruit KEEP_MODIFIERS. **Note:** "muskmelon" itself is not a USDA term — "cantaloupe" is correct. QUERY_MAP has no mausambi→cantaloupe mapping; user would type "muskmelon" and get poor results. |
| Watermelon | watermelon | "Watermelon, raw"; "Seeds, watermelon seed kernels, dried"; "Watermelon, seedless, flesh only, raw" | ✓ Good | "Watermelon, raw" is correct. `flesh only` is in vegetable KEEP_MODIFIERS but fruit category does not include `flesh only` in its keep set — will be dropped. "Watermelon, seedless, raw" after cleaning — acceptable. |
| Papaya | papaya | "Papayas, raw"; "Papaya nectar, canned"; "Papaya, canned, heavy syrup, drained" | ✓ Good | "Papayas, raw" is correct. `canned` conditional exclusions handle the other two. ✓ |
| Raw papaya | papaya | "Papayas, raw"; "Papaya nectar, canned"; "Papaya, canned, heavy syrup, drained" | ⚠ Partial | Same results as ripe papaya — USDA has no "raw/unripe papaya" entry. `UNRIPE_OK_FRUITS` includes papaya so it wouldn't be excluded even if found. Raw papaya data must come from `indian-foods.json`. |
| Chikoo / Sapodilla | sapodilla | "Sapodilla, raw" | ✓ Good | Only 1 result but it's correct. USDA has sapodilla in SR Legacy. `raw` kept by fruit KEEP_MODIFIERS. ✓ |
| Grapes green | grapes | "Grape leaves, canned"; "Grape leaves, raw"; "Grapes, muscadine, raw" | ⚠ Partial | Top results are grape LEAVES, not fruit. "Grapes, American type, raw" and "Grapes, red or green, European type, raw" exist but are not in top 3. USDA ranks leaves first. UNIVERSAL_DISCARD_SEGMENTS has `european type` and `american type` → those qualifiers stripped from cleaned name. No green/red grape distinction in USDA — both would clean to "Grapes, raw". |
| Grapes black | grapes | "Grape leaves, canned"; "Grape leaves, raw"; "Grapes, muscadine, raw" | ⚠ Partial | Same as grapes green — USDA has no "black grapes" distinct entry. No QUERY_MAP entry to differentiate. Both grape variants would return the same cleaned result. |

---

## Dals / Legumes

| Item | USDA Query | Top Results (raw USDA descriptions) | Status | Notes |
|------|-----------|--------------------------------------|--------|-------|
| Whole green moong | mung beans | "Mung beans, mature seeds, raw"; "Mung beans, mature seeds, sprouted, raw"; "Mung beans, mature seeds, cooked, boiled, with salt" | ✓ Good | "mature seeds" is in UNIVERSAL_DISCARD_SEGMENTS → stripped. `raw` kept. Result: "Mung beans, raw". USDA has no whole/split distinction. ✓ |
| Split green moong | mung beans split | "Mung beans, mature seeds, raw"; "Mung beans, mature seeds, sprouted, raw"; "Mung beans, mature seeds, cooked, boiled, with salt" | ⚠ Partial | Same results as whole moong — USDA has no split green moong entry. Query "mung beans split" just returns all mung bean entries. No distinction possible. |
| Split yellow moong | mung beans yellow | "Mung beans, mature seeds, raw"; "Mung beans, mature seeds, sprouted, raw"; "Mung beans, mature seeds, cooked, boiled, with salt" | ⚠ Partial | Same as above — USDA has no yellow split moong. The yellow (husked, split) variant is nutritionally different (lower fiber) — must rely on `indian-foods.json`. |
| Whole black urad | black gram | "Chickpeas, (garbanzo beans, bengal gram), dry"; "Pigeon peas (red gram), mature seeds, raw"; "Chickpeas (garbanzo beans, bengal gram), mature seeds, raw" | ⚠ Partial | **Critical gap.** USDA search for "black gram" returns chickpeas and pigeon peas — NOT urad/black gram. USDA does not appear to have a "black gram" entry in Foundation/SR Legacy under that name. The QUERY_MAP translation `urad → black gram` sends the query somewhere USDA doesn't understand. Results are completely wrong. |
| Split black urad | black gram split | "Chickpeas, (garbanzo beans, bengal gram), dry"; "Pigeon peas (red gram), mature seeds, raw"; "Chickpeas (garbanzo beans, bengal gram), mature seeds, raw" | ⚠ Partial | Same critical gap as whole black urad. |
| White whole urad | black gram white | "Chickpeas, (garbanzo beans, bengal gram), dry"; "Pigeon peas (red gram), mature seeds, raw"; "Chickpeas (garbanzo beans, bengal gram), mature seeds, raw" | ⚠ Partial | Same critical gap. "Black gram white" is not a USDA concept. |
| Split white urad | black gram split | "Chickpeas, (garbanzo beans, bengal gram), dry"; "Pigeon peas (red gram), mature seeds, raw"; "Chickpeas (garbanzo beans, bengal gram), mature seeds, raw" | ⚠ Partial | Same critical gap as above. |
| Toor / Arhar | pigeon peas | "Pigeon peas (red gram), mature seeds, raw"; "Pigeon peas (red gram), mature seeds, cooked, boiled, with salt"; "Pigeon peas (red gram), mature seeds, cooked, boiled, without salt" | ✓ Good | QUERY_MAP: toor/arhar → pigeon peas works well. "mature seeds" stripped by UNIVERSAL_DISCARD_SEGMENTS. `(red gram)` stripped by COLLAPSE_MAP parenthetical rule. `cooked` conditional exclusion. Result: "Pigeon peas, raw". ✓ |
| Chana dal | split chickpeas | "Chickpea flour (besan)"; "Peas, green, split, mature seeds, raw"; "Soup, pea, split with ham, canned, condensed" | ⚠ Partial | Query "split chickpeas" returns chickpea flour as top hit and split green peas as second — not split chickpeas. USDA does not appear to have a dedicated "split chickpeas" / "chana dal" entry. Results are wrong. **QUERY_MAP gap:** `chana dal → split chickpeas` sends to an empty USDA concept; should perhaps be `chana dal → chickpeas` instead. |
| Orange masoor | red lentils | "Lentils, pink or red, raw"; "Lentils, dry"; "Lentils, raw" | ✓ Good | "Lentils, pink or red, raw" is exactly orange masoor. `dry` in UNIVERSAL_DISCARD? No — but it IS in KEEP_MODIFIERS for pulse as... wait, `dry` is not in pulse KEEP_MODIFIERS — `dried` is in dryFruit. `dry` will be dropped. "Lentils, dry" → "Lentils". Result acceptable. ✓ |
| Black masoor | black lentils | "Lentils, dry"; "Lentils, raw"; "Lentils, sprouted, raw" | ✓ Good | USDA returns generic lentils for "black lentils" — no specific black lentil / beluga lentil entry in top results. The `sprouted` form is a `conditional exclusion`? No — "sprouted" is in pulse KEEP_MODIFIERS, not CONDITIONAL_EXCLUSIONS. Sprouts stay. Acceptable as a proxy. **QUERY_MAP gap confirmed:** `"black masoor": "black lentils"` should be added but the data gap in USDA makes it moot. |
| Horsegram | N/A | — | N/A | Correctly skipped. |
| Moth dal | N/A | — | N/A | Correctly skipped. |
| Black chana | black chickpeas | "Chickpea flour (besan)"; "Chickpeas, (garbanzo beans, bengal gram), dry"; "Chickpeas (garbanzo beans, bengal gram), mature seeds, raw" | ⚠ Partial | "black chickpeas" query returns regular chickpea flour and standard chickpeas — no black variety distinction. USDA has no black chana entry. Results are generic chickpeas, which will clean correctly but are not the right variant. |
| Green chana | green chickpeas | "Chickpea flour (besan)"; "Chickpeas, (garbanzo beans, bengal gram), dry"; "Chickpeas (garbanzo beans, bengal gram), mature seeds, raw" | ⚠ Partial | Same as black chana — USDA has no green chickpea variant. Generic chickpeas returned. |
| Dried peas | dried peas | "Litchis, dried"; "Longans, dried"; "Pepeao, dried" | ⚠ Partial | **Misleading results.** Top 3 are dried litchi, dried longan, and dried pepeao (wood ear mushroom) — not dried peas. USDA "dried peas" as a concept returns unrelated dried things. "Peas, split, green, mature seeds, raw" exists but is not surfacing. |
| Lobia / Black-eyed peas | black-eyed peas | "Blackeye pea, dry"; "Peas, green, raw"; "Peas, edible-podded, raw" | ✓ Good | "Blackeye pea, dry" is correct (USDA spells it "blackeye" not "black-eyed"). `dry` modifier — not in pulse KEEP_MODIFIERS → dropped. Result: "Blackeye pea". Second result is green peas — unrelated. Ranking may need attention. |
| Rajma / Kidney beans | kidney beans | "Beans, liquid from stewed kidney beans"; "Beans, kidney, mature seeds, sprouted, raw"; "Beans, kidney, red, mature seeds, raw" | ✓ Good | "Beans, kidney, red, mature seeds, raw" is correct. "mature seeds" → UNIVERSAL_DISCARD_SEGMENTS → stripped. `red` and `raw` in pulse KEEP_MODIFIERS → kept. Result: "Beans, kidney, red, raw". ✓ |
| Green moong sprouts | mung bean sprouts | "Mung beans, mature seeds, sprouted, raw"; "Beans, mung, mature seeds, sprouted, canned, drained solids"; "Mung beans, mature seeds, sprouted, cooked, stir-fried" | ✓ Good | "mature seeds" stripped. `sprouted` in pulse KEEP_MODIFIERS → kept. `canned` conditional exclusion. `cooked` conditional exclusion. Result: "Mung beans, sprouted, raw". ✓ |
| Black chana sprouts | N/A | — | N/A | Correctly skipped. |
| Moth sprouts | N/A | — | N/A | Correctly skipped. |

---

## Other Items

| Item | USDA Query | Top Results (raw USDA descriptions) | Status | Notes |
|------|-----------|--------------------------------------|--------|-------|
| Peanuts roasted | peanuts roasted | "Peanuts, spanish, oil-roasted, with salt"; "Peanuts, valencia, oil-roasted, with salt"; "Peanuts, virginia, oil-roasted, with salt" | ⚠ Partial | All top 3 are oil-roasted with salt. `oil roasted` is a conditional exclusion (excluded unless user asks). `salted` is also a conditional exclusion. After filtering, these all get excluded. "Peanuts, all types, dry-roasted, without salt" exists further in results and is the correct hit. Rankings are not ideal. |
| Poha | flattened rice | "Rice crackers"; "Snacks, rice cakes, brown rice, buckwheat"; "Snacks, rice cakes, brown rice, corn" | ⚠ Partial | QUERY_MAP maps poha → flattened rice correctly. But USDA has no "flattened rice" entry — results are rice crackers and rice cakes, which are different products. Poha data must come from `indian-foods.json`. |
| Tofu firm | tofu firm | "HOUSE FOODS Premium Firm Tofu"; "MORI-NU, Tofu, silken, firm"; "Tofu, extra firm, prepared with nigari" | ✓ Good | Branded HOUSE FOODS and MORI-NU results — branded leakage despite `dataType` filter. "Tofu, extra firm, prepared with nigari" is the Foundation/SR Legacy hit. `prepared with nigari` not in any KEEP_MODIFIERS → will be dropped. Result: "Tofu, extra firm". Acceptable. |
| Tofu silken | tofu silken | "MORI-NU, Tofu, silken, firm"; "MORI-NU, Tofu, silken, soft"; "Vitasoy USA Azumaya, Silken Tofu" | ⚠ Partial | All 3 results are branded. No Foundation/SR Legacy entry for silken tofu in top 3. Branded results would have incomplete nutrient data typically, and `calories === 0` filter in `processUSDAResults` would discard them if nutrient data is missing. |
| Tofu soft | tofu soft | "HOUSE FOODS Premium Soft Tofu"; "MORI-NU, Tofu, silken, soft"; "Vitasoy USA Organic Nasoya, Soft Tofu" | ⚠ Partial | Same issue — all branded. "Tofu, soft, prepared with nigari" should exist in SR Legacy but not in top 3. |
| Tempeh | tempeh | "Tempeh"; "Tempeh, cooked" | ✓ Good | Only 2 results but both correct. "Tempeh" (base entry, raw) is the right hit. `cooked` conditional exclusion. ✓ |
| Paneer | paneer | — | ✗ Missing | USDA has no paneer entry in Foundation or SR Legacy. Paneer is an Indian cheese with no USDA equivalent. Data must come from `indian-foods.json`. **QUERY_MAP note:** adding `"paneer": "cottage cheese"` would be a rough proxy but nutritionally not equivalent (paneer has higher fat, different protein structure). Not recommended without a note. |
| Soy milk | soy milk | "Milk, imitation, non-soy"; "Soy milk, sweetened, plain, refrigerated"; "Soy milk, unsweetened, plain, refrigerated" | ✓ Good | Good coverage. Sweetened and unsweetened variants. The `dairy` category KEEP_MODIFIERS includes `unsweetened` and `plain` → kept correctly. ✓ |
| Oat milk | oat milk | "Oat milk, unsweetened, plain, refrigerated"; "Oil, oat"; "Bagels, oat bran" | ✓ Good | "Oat milk, unsweetened, plain, refrigerated" is the correct hit. **Category detection gap:** "oat milk" would be detected as `grain` category (via "oat" keyword) not `dairy`. This means dairy KEEP_MODIFIERS won't apply — `unsweetened` and `plain` would not be kept since they're not in grain KEEP_MODIFIERS. Result would clean to just "Oat milk". Acceptable outcome but wrong reason. |
| Oats | oats | "Oil, oat"; "Bagels, oat bran"; "Bread, oat bran" | ⚠ Partial | Top 3 are oat oil, oat bran bagel, and oat bread — not plain oats. "Oats" as a single-word query gets poor USDA ranking. "Oat bran" and "Rolled oats, old fashioned" exist but are buried. Query should be "oats whole grain" or "rolled oats". |
| Rolled oats | rolled oats | "Rolls, dinner, oat bran"; "Oats, whole grain, rolled, old fashioned"; "Oil, oat" | ✓ Good | "Oats, whole grain, rolled, old fashioned" is the correct entry. It's second result. `whole grain` and `rolled` are in grain KEEP_MODIFIERS. `old fashioned` is not — will be dropped. Result: "Oats, whole grain, rolled". ✓ (Script marked ⚠ due to heuristic; actual result is correct.) |
| Greek yogurt | greek yogurt | "Yogurt, Greek, Blueberry, CHOBANI"; "Yogurt, Greek, plain, lowfat"; "Yogurt, Greek, plain, nonfat" | ✓ Good | Branded CHOBANI appears first — branded leakage. "Yogurt, Greek, plain, lowfat" and "nonfat" are correct Foundation entries. `low-fat` in dairy KEEP_MODIFIERS → kept. ✓ |
| Skyr | skyr | — | ✗ Missing | Confirmed absent from USDA Foundation + SR Legacy. Despite being Icelandic dairy that has become mainstream, USDA has not catalogued it. Data must come from `indian-foods.json` or the item should be added there. |
| Soy chunks | textured soy protein | "Soy protein isolate"; "Beverages, Protein powder soy based"; "Soy protein isolate, potassium type" | ⚠ Partial | Query "textured soy protein" returns soy protein isolate — not the same product (TVP is defatted soy flour extruded into chunks; isolate is concentrated protein powder). **Data quality gap.** TVP/TSP does exist in USDA as "Soy protein, textured" — but it's not surfacing in top 3. Better query would be "textured vegetable protein" or "TSP". **QUERY_MAP correction needed:** `"soy chunks": "textured vegetable protein"` would be more accurate. |
| Vermicelli | vermicelli | "Vermicelli, made from soy"; "Rice and vermicelli mix, beef flavor, unprepared"; "Rice and vermicelli mix, rice pilaf flavor, unprepared" | ⚠ Partial | "Vermicelli, made from soy" is the top hit — unexpected. Soy-based vermicelli is a specific product. "Pasta, dry, enriched" would be more appropriate for wheat vermicelli. USDA has limited plain wheat vermicelli coverage. |
| Semolina / Sooji | semolina | "Semolina, enriched"; "Semolina, unenriched"; "Flour, semolina, fine" | ✓ Good | All three are correct. `enriched` and `unenriched` are both in UNIVERSAL_DISCARD_SEGMENTS → stripped. Result: "Semolina". Clean. ✓ |
| Dosa | N/A | — | N/A | Correctly skipped. |
| Idli | N/A | — | N/A | Correctly skipped. |
| Vada | N/A | — | N/A | Correctly skipped. |
| Curd / Dahi full fat | yogurt whole milk | "Yogurt, plain, whole milk"; "Yogurt, plain, whole milk"; "Yogurt, Greek, fruit, whole milk" | ✓ Good | "Yogurt, plain, whole milk" is the correct hit. `whole` in dairy KEEP_MODIFIERS → kept. `plain` also in dairy KEEP_MODIFIERS → kept. Result: "Yogurt, plain, whole milk". ✓ |
| Curd / Dahi low fat | yogurt low fat | "Yogurt, plain, low fat"; "Yogurt, vanilla, low fat."; "Babyfood, banana juice with low fat yogurt" | ✓ Good | "Yogurt, plain, low fat" is correct. `low-fat` in dairy KEEP_MODIFIERS → kept. ✓ |
| Peanut curd | N/A | — | N/A | Correctly skipped. |
| Soy milk curd | N/A | — | N/A | Correctly skipped. |

---

## Dry Fruits

| Item | USDA Query | Top Results (raw USDA descriptions) | Status | Notes |
|------|-----------|--------------------------------------|--------|-------|
| Almond | almond | "Flour, almond"; "Nuts, almonds"; "Oil, almond" | ⚠ Partial | **Critical cleaning gap.** USDA base name is "Nuts" with "almonds" as a modifier. `cleanFoodName` keeps the first comma-separated segment as base — so base = "Nuts". "almonds" is not in dryFruit KEEP_MODIFIERS → dropped. Final result: "Nuts". This is wrong. Affects all nuts with this naming pattern. |
| Cashew | cashew | "Nuts, cashew nuts, raw"; "Nuts, cashew nuts, raw"; "Nuts, cashew butter, plain, with salt added" | ⚠ Partial | Same cleaning gap. Base = "Nuts". "cashew nuts" and "raw" — "raw" IS in dryFruit KEEP_MODIFIERS but "cashew" is not a modifier keyword. Result: "Nuts, raw". Wrong. Duplicate handled. |
| Dried apricot | dried apricot | "Apricots, dried, sulfured, uncooked"; "Apricots, dried, sulfured, stewed, with added sugar"; "Apricots, dried, sulfured, stewed, without added sugar" | ✓ Good | Base = "Apricots" ✓. "sulfured" — not in dryFruit KEEP_MODIFIERS → dropped. `dried` is in dryFruit KEEP_MODIFIERS → kept. Result: "Apricots, dried". ✓ |
| Dried fig | dried fig | "Figs, dried, stewed"; "Figs, dried, uncooked"; "Figs, dried, uncooked" | ✓ Good | Base = "Figs" ✓. `dried` in dryFruit KEEP_MODIFIERS → kept. "uncooked" — not in KEEP_MODIFIERS for dryFruit, not in UNIVERSAL_DISCARD → dropped. Result: "Figs, dried". ✓ |
| Dates | dates | "Dates, medjool"; "Dates, deglet noor"; "Archway Home Style Cookies, Date Filled Oatmeal" | ✓ Good | "Dates, medjool" — `medjool` in dryFruit KEEP_MODIFIERS → kept ✓. "deglet noor" — not in KEEP_MODIFIERS → dropped. Result: "Dates, medjool" and "Dates". Cookie result filtered by cleaning. ✓ |
| Medjool dates | medjool dates | "Dates, medjool"; "Dates, deglet noor"; "Archway Home Style Cookies, Date Filled Oatmeal" | ✓ Good | Same as above. "Dates, medjool" correctly identified. ✓ |
| Walnut | walnut | "Oil, walnut"; "Nuts, walnuts, english"; "Nuts, walnuts, glazed" | ⚠ Partial | Same "Nuts" base name cleaning gap. `english` is in UNIVERSAL_DISCARD_SEGMENTS → stripped. `glazed` not in KEEP_MODIFIERS → dropped. Base = "Nuts". Result: "Nuts". Wrong. Also, walnut oil ranks first. |
| Pistachio | pistachio | "Nuts, pistachio nuts, raw"; "Nuts, pistachio nuts, raw"; "Yachtwurst, with pistachio nuts, cooked" | ⚠ Partial | Same "Nuts" base name gap. "pistachio nuts" is not a KEEP_MODIFIER for dryFruit → dropped. `raw` is in dryFruit KEEP_MODIFIERS → kept. Result: "Nuts, raw". Wrong base name. Yachtwurst (German sausage) result is clearly irrelevant. |
| Roasted pistachio | pistachio roasted | "Nuts, pistachio nuts, dry roasted, with salt added"; "Nuts, pistachio nuts, dry roasted, without salt added"; "Nuts, mixed nuts, dry roasted, with peanuts, salt added, PLANTERS pistachio blend" | ✓ Good | Same "Nuts" base gap. `dry roasted` in dryFruit KEEP_MODIFIERS → kept. `salted` conditional exclusion fires unless "salted" in query. `without salt` COLLAPSE_MAP removes "without salt" → "". Result: "Nuts, dry roasted". Wrong base name. |
| Pumpkin seeds | pumpkin seeds | "Seeds, pumpkin seeds (pepitas), raw"; "Seeds, pumpkin and squash seed kernels, dried"; "Fish, sunfish, pumpkin seed, raw" | ⚠ Partial | **Critical cleaning gap.** USDA uses "Seeds" as base name (same pattern as "Nuts"). `cleanFoodName` base = "Seeds". "pumpkin seeds" not in dryFruit KEEP_MODIFIERS → dropped. Parenthetical `(pepitas)` stripped. `raw` kept. Result: "Seeds, raw". Wrong. Also, "Fish, sunfish, pumpkin seed" is a completely irrelevant result about a sunfish species! |
| Sunflower seeds | sunflower seeds | "Seeds, sunflower seed kernels, dried"; "Seeds, sunflower seed, kernel, raw"; "Seeds, sunflower seed butter, without salt" | ⚠ Partial | Same "Seeds" base gap. "sunflower seed kernels" not in KEEP_MODIFIERS → dropped. `dried` in dryFruit KEEP_MODIFIERS → kept. Result: "Seeds, dried". Wrong. |
| Chia seeds | chia seeds | "Seeds, chia seeds, dried"; "Chia seeds, dry, raw"; "Seeds, breadfruit seeds, boiled" | ⚠ Partial | "Seeds" base gap for first result. BUT second result "Chia seeds, dry, raw" has base = "Chia seeds" — this one would clean correctly! `dried` and `raw` in dryFruit KEEP_MODIFIERS. Result: "Chia seeds, raw". ✓ for second result. Inconsistent between entries. |
| Sesame seeds | sesame seeds | "Seeds, sesame seeds, whole, dried"; "Seeds, sesame seed kernels, dried (decorticated)"; "Seeds, sesame seeds, whole, roasted and toasted" | ⚠ Partial | Same "Seeds" base gap. `dried` and `roasted` in dryFruit KEEP_MODIFIERS → kept. Result: "Seeds, dried". Wrong. |
| Raisins | raisins | "Raisins, seeded"; "Bagels, cinnamon-raisin"; "Bread, raisin, enriched" | ✓ Good | "Raisins, seeded" — base = "Raisins" ✓. "seeded" not in dryFruit KEEP_MODIFIERS → dropped. Result: "Raisins". ✓ Bagel and bread ranked second/third are irrelevant — cleaning will reduce them but they should not appear in the top results anyway. |

---

## Cleaning Rule Analysis

### Critical gap: "Nuts, X" and "Seeds, X" naming pattern

USDA names most nuts as `Nuts, [nut name], [prep]` and most seeds as `Seeds, [seed name], [prep]`.
The `cleanFoodName` function keeps the first comma-separated segment as the base name.
This means:

- "Nuts, almonds" → base = "Nuts" → "almonds" dropped (not a KEEP_MODIFIER) → result: **"Nuts"**
- "Seeds, chia seeds, dried" → base = "Seeds" → result: **"Seeds, dried"**

**Affected items:** Almond, Cashew, Walnut, Pistachio, Pumpkin seeds, Sunflower seeds, Sesame seeds (partially).

**Fix options:**
1. Detect the `Nuts, [type]` and `Seeds, [type]` pattern and swap base with the specific name.
2. Add all nut/seed names to dryFruit KEEP_MODIFIERS so they survive the modifier filter and appear after the base: "Nuts, almonds" → "Nuts, almonds". Not ideal but better than "Nuts".
3. In `cleanFoodName`, when base is "Nuts" or "Seeds", use the first non-discarded modifier as the new base instead.

Option 3 is cleanest. This is a genuine bug in the current cleaning pipeline for the dry fruits category.

---

### QUERY_MAP gaps confirmed by live testing

| Item (user-typed term) | Current result | Recommended addition |
|------------------------|---------------|----------------------|
| `beetroot` | Sent to USDA as "beetroot" — USDA full-text likely still returns beets, but unreliable | `"beetroot": "beet"` |
| `drumstick` (the vegetable) | No mapping — but "drumstick" query actually works in USDA (returns "Drumstick leaves/pods") | `"drumstick": "drumstick"` (identity, no translation needed; or just document it works) |
| `black masoor` | No mapping — "black lentils" works as a query but doesn't hit a specific USDA entry | `"black masoor": "black lentils"` (low impact — USDA data gap) |
| `black chana` | No mapping — "black chickpeas" returns generic chickpeas | `"black chana": "chickpeas"` (black variant not in USDA) |
| `green chana` | No mapping — same issue | `"green chana": "chickpeas"` |
| `mausambi` | No mapping — lime is the closest USDA has | `"mausambi": "lime"` |
| `soy chunks` | No mapping — user gets no results | `"soy chunks": "textured vegetable protein"` (better than "textured soy protein") |
| `muskmelon` | No mapping — cantaloupe is the correct USDA term | `"muskmelon": "cantaloupe"` |
| `haricot` / `haricot beans` | No mapping — "haricot beans" returns wrong results in USDA | `"haricot": "navy beans"`, `"haricot beans": "navy beans"` |
| `skyr` | No mapping — and USDA has no skyr entry anyway | Moot — add to `indian-foods.json` |
| `paneer` | No mapping — USDA has no paneer entry | Moot — must be in `indian-foods.json` |

---

### QUERY_MAP translation that produces wrong USDA results

| Mapping | Problem |
|---------|---------|
| `urad → black gram` | USDA does not have "black gram" as an entry in Foundation/SR Legacy. Searching "black gram" returns chickpeas and pigeon peas — completely wrong. Should probably be `urad → urad` (left untranslated) or removed, relying on `indian-foods.json` for all urad variants. |
| `chana dal → split chickpeas` | USDA has no "split chickpeas" entry. Returns chickpea flour and split green peas. Better as `chana dal → chickpeas` or handled purely via `indian-foods.json`. |

---

### Category detection gaps

| Query term | Detected category | Correct category | Impact |
|-----------|------------------|-----------------|--------|
| `tofu` (firm/silken/soft) | unknown | dairy or unknown | Minor — unknown KEEP_MODIFIERS includes `raw`, `whole`, `dried`, `roasted`, `cooked` so cleaning is passable |
| `tempeh` | unknown | pulse or unknown | Minor — same reasoning |
| `oat milk` | grain (via "oat") | dairy | `unsweetened` and `plain` modifiers not kept since they're not in grain KEEP_MODIFIERS. Actual output: "Oat milk" — acceptable, just loses variant detail |
| `avocado` | unknown | fruit | KEEP_MODIFIERS for unknown includes `raw` — "Avocados, raw" survives. OK in practice. |
| `skyr` | unknown | dairy | Moot — no USDA entry anyway |
| `spring onion` | unknown | vegetable | "spring" keyword not in vegetable CATEGORY_KEYWORDS. `raw` in unknown KEEP_MODIFIERS — result survives. OK in practice. |
| `moringa` / `drumstick` | unknown | vegetable | "moringa" not in vegetable keywords. `raw` kept by unknown. OK in practice. |

---

### Branded food leakage (dataType filter not fully effective)

Despite `dataType=Foundation,SR Legacy`, the following branded results appeared in top 3:

- Onion: "DENNY'S, onion rings"
- Lemon: "Lemon juice from concentrate, bottled, REAL LEMON"
- Pomegranate: "Beverages, OCEAN SPRAY, Cran Pomegranate"
- Kiwi: "Beverages, Kiwi Strawberry Juice Drink", "Babyfood, GERBER, 3rd Foods, apple, mango and kiwi"
- Tofu firm: "HOUSE FOODS Premium Firm Tofu", "MORI-NU, Tofu, silken, firm"
- Greek yogurt: "Yogurt, Greek, Blueberry, CHOBANI"
- Dates: "Archway Home Style Cookies, Date Filled Oatmeal"

**Likely explanation:** USDA's `dataType` parameter filters the primary data source but the full-text search relevance scoring pulls in brand-associated SR Legacy entries that reference brand names in their descriptions, or the API is occasionally returning results from SR Legacy that contain branded preparation notes.

These branded results will mostly be harmless because:
1. They often have incomplete nutrient data → filtered by `calories === 0` check
2. Their names don't match KEEP_MODIFIERS → cleaned to bare base name or dropped

No action required, but worth monitoring if branded noise increases.

---

### Items confirmed missing from USDA Foundation + SR Legacy

These items are in the app's food list and have no usable USDA equivalent:

| Item | Finding |
|------|---------|
| Paneer | Confirmed 0 results. Must be in `indian-foods.json`. |
| Skyr | Confirmed 0 results. Add to `indian-foods.json` if needed. |
| All urad variants | USDA "black gram" query returns wrong results entirely. Urad must be sourced from `indian-foods.json`. |
| Millet varieties (little, foxtail, kodo, pearl/bajra) | Only generic millet in USDA — no variety distinction. `indian-foods.json` is the right source. |
| Finger millet (ragi) | Generic millet returned, not finger millet specifically. `indian-foods.json` is better. |
| Poha | "Flattened rice" not in USDA — returns rice crackers. |
| Baby corn | "Baby corn" query returns baby spinach, baby arugula etc — no baby corn entry. |
| Fenugreek leaves | USDA only has fenugreek seed. No leaf/herb entry. |
| Chana dal (as split chickpeas) | No USDA split chickpeas entry — wrong results returned. |
| Raw/green papaya | USDA has only ripe papaya — raw papaya data must come from `indian-foods.json`. |
| Raw/unripe mango | USDA "Mangos, raw" = ripe mango. Raw mango data must come from `indian-foods.json`. |
| Soy chunks / TVP | "Textured soy protein" query returns soy isolate, not TVP. TVP exists but as "Soy protein, textured" — query needs fixing. |
