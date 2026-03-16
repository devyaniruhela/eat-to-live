// Shared swipe detection hook.
// Spread the returned { onTouchStart, onTouchEnd } props onto any element to
// make it respond to left/right swipe gestures.
//
// All sensitivity is controlled by SWIPE_CONFIG — change values here and
// every swipe-enabled component in the app updates automatically.

import { useRef } from 'react';

// ─── Tune all swipe behaviour here ──────────────────────────────────────────
export const SWIPE_CONFIG = {
  /** Minimum horizontal travel (px) before a touch counts as a swipe. */
  minDistance: 50,
  /** |dy| / |dx| ceiling — keeps vertical scrolls from triggering swipes. */
  maxVerticalRatio: 0.5,
} as const;
// ────────────────────────────────────────────────────────────────────────────

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /**
   * Pass true for child elements whose swipe should NOT bubble to a parent
   * swipe handler (e.g. list rows inside a swipeable page). Stops touch event
   * propagation so the page-level date-swipe won't also fire when the user
   * swipes a row.
   */
  stopPropagation?: boolean;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  stopPropagation = false,
}: UseSwipeOptions) {
  const startX = useRef(0);
  const startY = useRef(0);

  function onTouchStart(e: React.TouchEvent) {
    if (stopPropagation) e.stopPropagation();
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (stopPropagation) e.stopPropagation();
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = e.changedTouches[0].clientY - startY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < SWIPE_CONFIG.minDistance) return;
    if (absDy / absDx > SWIPE_CONFIG.maxVerticalRatio) return;

    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  }

  return { onTouchStart, onTouchEnd };
}
