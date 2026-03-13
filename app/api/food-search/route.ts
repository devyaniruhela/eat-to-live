// Server-side API route for food search.
// Checks the Indian food JSON first (primary source).
// Falls back to USDA FoodData Central only when Indian JSON returns no results.
// The USDA API key never leaves this file — the browser only calls /api/food-search.

import { NextRequest, NextResponse } from 'next/server';
import { searchIndianFoods } from '@/lib/indian-food-search';
import { transformQuery, processUSDAResults, USDAFood } from '@/lib/food-cleaning';

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get('query');

  if (!rawQuery || rawQuery.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  // ── Step 1: Search Indian food JSON (primary source) ──────────────────────
  // Fast, local, no API call needed. Returns results for any Indian staple.
  const indianResults = searchIndianFoods(rawQuery);

  if (indianResults.length > 0) {
    // Indian JSON had results — return them directly, no USDA call needed
    return NextResponse.json({ results: indianResults, source: 'indian' });
  }

  // ── Step 2: Fall back to USDA (secondary source) ─────────────────────────
  // Reached only when Indian JSON returned nothing — e.g. broccoli, kiwi, quinoa.
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  // Transform the query — maps Indian terms to USDA equivalents and detects food category.
  // Category drives which post-search filtering rules are applied to the results.
  const { usdaQuery, category } = transformQuery(rawQuery);

  try {
    // Fetch 20 results — more than we'll show, since we re-rank and filter before returning
    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.searchParams.set('query', usdaQuery);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('dataType', 'Foundation,SR Legacy'); // excludes branded/packaged foods
    url.searchParams.set('pageSize', '20');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`USDA API responded with ${response.status}`);
    }

    const data = await response.json();

    // Apply all cleaning, filtering, re-ranking and deduplication rules from food-cleaning.ts
    const results = processUSDAResults(
      (data.foods || []) as USDAFood[],
      rawQuery,
      category
    );

    return NextResponse.json({ results, source: 'usda' });
  } catch (error) {
    console.error('USDA API error:', error);
    return NextResponse.json({ error: 'Failed to fetch food data' }, { status: 500 });
  }
}
