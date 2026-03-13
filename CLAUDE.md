# Eat to Live — Project Guidelines

Global rules in `/projects/CLAUDE.md` apply here. This file adds project-specific context only.

---

## What This App Is

A personal nutrition awareness tool — not a calorie counter or fitness app. It should feel like writing in a journal: calm, reflective, no judgment.

**Core loop:** Search a food → log quantity → see today's macros.

**Never:** streaks, aggressive warnings, gradients, glassmorphism, fitness-app aesthetics.

---

## MVP Scope

Do not add features outside this scope without explicit discussion.

**In:** food entry logging (ingredient + quantity + meal tag), daily macro summary (Calories, Protein, Fat, Fiber), water quick-logging, date navigation, food search, localStorage persistence.

**Out:** goals tracking, user profile, micronutrient display, PWA manifest, auth + cloud sync, standalone ingredient lookup, swipe navigation, recent items, edit/duplicate entries.

---

## Data Sources

**Primary — `lib/indian-foods.json`:** Common Indian staples sourced from IFCT 2017. Search checks here first.

**Fallback — USDA FoodData Central API:** Used when Indian food JSON has no match. API key in `.env.local`, never exposed to browser. All calls proxied through `app/api/food-search/route.ts`. Cleaning and intelligence rules in `lib/food-cleaning.ts`. Foundation + SR Legacy data types only (no branded foods).

**Core rule:** All nutrition values stored per 100g. Actual amounts calculated at display time from logged quantity. Never store pre-calculated values.

---

## Design

Full design system in `design.md`. This section is a quick reference only.

**Palette:** Navy `#1a2744` (primary), off-white `#faf9f6` (background), rose `#c87080` (accent), stone-400 for muted text.

**Fonts:** System font stack for all UI. Homemade Apple (Google, via `--font-homemade-apple` CSS var) for the "Eat to Live" wordmark only.

**Texture:** Body has paper grain (`::after` SVG feTurbulence, opacity 0.035) + subtle grid lines (32px, opacity 0.04). Together these give the notebook feel. Never remove these.

**Cards:** White bg, `rounded-2xl`, light border `rgba(26,39,68,0.07)`, paper-lift shadow. No coloured card backgrounds except navy primary macro card.

**Interactions:** Press = `scale(0.97)` or `translateY(1px)` at `80ms ease-out`. Quick and physical. No bounce, no floaty easing.

**Never:** gradients (except bottom fade for sticky button), glassmorphism, neon, pure white backgrounds, fitness-app aesthetics, streaks.

---

## Folder Structure

```
app/
  layout.tsx          # Root layout — viewport and global styles
  page.tsx            # Homepage — daily journal view, all shared state lives here
  globals.css         # Tailwind imports + CSS color tokens
  api/food-search/
    route.ts          # USDA API proxy — API key never leaves this file
components/
  DailySummary.tsx    # Date nav + macro cards
  WhatIAte.tsx        # Entries grouped by meal tag
  AddEntryModal.tsx   # Add entry flow: search → quantity → tag → save
  WaterLog.tsx        # Water quick-add buttons
lib/
  types.ts            # All shared TypeScript types — single source of truth
  storage.ts          # All localStorage logic — components never call localStorage directly
  nutrition.ts        # Macro calculation helpers
  food-cleaning.ts    # USDA name cleaning + result intelligence
  indian-foods.json   # Primary food database — IFCT 2017 values
.env.local            # API key — never commit, never touch
log.md                # Personal log — never read or modify
prd-eat-to-live-v1.md # Product requirements — reference only, never modify
summary.md            # Updated at end of every session
```

- One component per file, named after what it renders
- Business logic belongs in `lib/`, not in components
- No new top-level folders without discussion

---

## Coding Principles

- Write for readability. This codebase may be read by someone with limited coding experience — prefer explicit over clever.
- One file, one responsibility. If a file exceeds ~150 lines, consider splitting.
- All types in `lib/types.ts` — no inline type definitions in components. Use `interface` for object shapes, `type` for unions.
- Interactive components need `'use client'` at the top.
- Shared state lives in `page.tsx` and is passed as props — no global state managers needed at this scale.
- All styling via Tailwind utility classes. Use `var(--color-navy)` etc. for inline styles when a Tailwind class isn't available.
