// Shared food search hook — debounce, in-session cache, custom-food prepending, request cancellation.
// Single source of truth for the fetch pipeline used by AddEntryModal and SearchScreen.
//
// Design decisions:
//   - Cache is per-hook-instance (per component mount), not global. The two consumers are never
//     open simultaneously, so a shared global cache would provide no benefit and add complexity.
//   - AbortController cancels in-flight requests when the query changes mid-type, preventing
//     a slow earlier request from overwriting results from a faster later one.
//   - The entire pipeline lives inside the useEffect to satisfy exhaustive-deps without useCallback.

'use client';

import { useState, useEffect, useRef } from 'react';
import { FoodSearchResult } from './types';
import { getCustomFoods, customFoodToSearchResult } from './storage';

/**
 * Manages food search: debounce → in-memory cache → API fetch → custom food prepend.
 *
 * @param query        - Current search query string, controlled by the caller (tied to the input).
 * @param selectedName - Name of the currently selected food, or null.
 *                       When query === selectedName the search is suppressed — user just picked a result.
 *
 * @returns results, loading, error — read-only; update automatically as query changes.
 */
export function useFoodSearch(
  query: string,
  selectedName: string | null,
): {
  results: FoodSearchResult[];
  loading: boolean;
  error: string;
} {
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Per-instance cache: key = lowercased query, value = raw API results (custom foods added at render time).
  // Storing only API results means custom foods added mid-session are always fresh on cache hits.
  const cache = useRef<Map<string, FoodSearchResult[]>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Suppress search when user just selected a result (query mirrors selection name)
    if (selectedName && query === selectedName) {
      setResults([]);
      return;
    }

    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    // AbortController lets us cancel in-flight fetches when query changes before the response arrives.
    // This prevents a slow response for "ch" from overwriting results for "chicken".
    const controller = new AbortController();

    debounceRef.current = setTimeout(async () => {
      const key = query.trim().toLowerCase();

      // Custom foods are always checked first — no API call needed, always up-to-date
      const customMatches = getCustomFoods()
        .filter((cf) => cf.name.toLowerCase().includes(key))
        .map(customFoodToSearchResult);

      // Cache hit — combine with fresh custom matches and return immediately
      if (cache.current.has(key)) {
        setResults([...customMatches, ...cache.current.get(key)!]);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/food-search?query=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        cache.current.set(key, data.results);
        setResults([...customMatches, ...data.results]);
      } catch (err) {
        // AbortError is expected when query changes — not a real error
        if ((err as Error).name === 'AbortError') return;
        setError('Could not fetch results. Check your connection.');
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Cancel any in-flight request for the previous query
      controller.abort();
    };
  }, [query, selectedName]);

  return { results, loading, error };
}
