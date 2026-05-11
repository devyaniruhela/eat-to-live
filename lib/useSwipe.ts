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
  /**
   * Called every touchmove with the raw horizontal delta (px).
   * Use this to drive a live drag-reveal effect (e.g. red delete panel).
   * Only fires when the gesture is more horizontal than vertical.
   */
  onSwipeProgress?: (dx: number) => void;
  /**
   * Called when the touch ends without reaching the swipe threshold.
   * Use this to snap the row back to its resting position.
   */
  onSwipeCancel?: () => void;
  /**
   * Vibration duration (ms) fired on a completed swipe via navigator.vibrate().
   * Silently ignored on iOS and desktop. Omit to disable.
   */
  hapticMs?: number;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  stopPropagation = false,
  onSwipeProgress,
  onSwipeCancel,
  hapticMs,
}: UseSwipeOptions) {
  const startX = useRef(0);
  const startY = useRef(0);

  function onTouchStart(e: React.TouchEvent) {
    if (stopPropagation) e.stopPropagation();
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (stopPropagation) e.stopPropagation();
    if (!onSwipeProgress) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    // Only report horizontal progress — ignore if the gesture is mostly vertical
    if (Math.abs(dx) > 0 && Math.abs(dy) / Math.abs(dx) < SWIPE_CONFIG.maxVerticalRatio) {
      onSwipeProgress(dx);
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (stopPropagation) e.stopPropagation();
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = e.changedTouches[0].clientY - startY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < SWIPE_CONFIG.minDistance || absDy / absDx > SWIPE_CONFIG.maxVerticalRatio) {
      onSwipeCancel?.();
      return;
    }

    // Fire haptic before state changes so it feels simultaneous with the action
    if (hapticMs && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(hapticMs);
    }

    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  }

  return { onTouchStart, onTouchMove, onTouchEnd };
}
