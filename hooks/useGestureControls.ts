
// hooks/useGestureControls.ts
"use client";

import { useEffect, useRef } from "react";

type Callbacks = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
};

type Options = {
  swipeThresholdPx?: number; // default 60
  tapMoveTolPx?: number;     // default 8
  tapTimeMs?: number;        // default 220
  dblTapGapMs?: number;      // default 280
  longPressMs?: number;      // default 450
  lockScrollOnSwipe?: boolean; // default true
};

export default function useGestureControls<T extends HTMLElement>(
  ref: React.RefObject<T>,
  cbs: Callbacks,
  opts: Options = {}
) {
  const {
    onSwipeLeft, onSwipeRight, onTap, onDoubleTap, onLongPress,
  } = cbs;

  const SWIPE = opts.swipeThresholdPx ?? 60;
  const TAP_MOVE = opts.tapMoveTolPx ?? 8;
  const TAP_TIME = opts.tapTimeMs ?? 220;
  const DBL_GAP = opts.dblTapGapMs ?? 280;
  const LONG_MS = opts.longPressMs ?? 450;
  const LOCK_SCROLL = opts.lockScrollOnSwipe ?? true;

  const startX = useRef(0);
  const startY = useRef(0);
  const startT = useRef(0);
  const moved = useRef(false);
  const swiping = useRef<false | "h" | "v">(false);
  const lastTapT = useRef(0);
  const longTimer = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!e.touches.length) return;
      const t = e.touches[0];
      startX.current = t.clientX;
      startY.current = t.clientY;
      startT.current = Date.now();
      moved.current = false;
      swiping.current = false;

      if (onLongPress) {
        longTimer.current = window.setTimeout(() => {
          onLongPress?.();
          if (longTimer.current) {
            clearTimeout(longTimer.current);
            longTimer.current = null;
          }
        }, LONG_MS);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches.length) return;
      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (Math.hypot(dx, dy) > TAP_MOVE) moved.current = true;

      // Establish swipe axis once
      if (!swiping.current) {
        if (adx > 8 || ady > 8) {
          swiping.current = adx > ady ? "h" : "v";
        }
      }

      // Cancel long-press once they move
      if (longTimer.current && (adx > TAP_MOVE || ady > TAP_MOVE)) {
        clearTimeout(longTimer.current);
        longTimer.current = null;
      }

      // Stop page from scrolling when doing a horizontal swipe
      if (LOCK_SCROLL && swiping.current === "h") {
        e.preventDefault(); // needs non-passive listener
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (longTimer.current) {
        clearTimeout(longTimer.current);
        longTimer.current = null;
      }

      const endT = Date.now();
      const dt = endT - startT.current;

      const changed = e.changedTouches[0];
      if (!changed) return;

      const dx = changed.clientX - startX.current;
      const dy = changed.clientY - startY.current;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      // Swipe?
      if (adx >= SWIPE && adx > ady) {
        if (dx < 0) onSwipeLeft?.();
        else onSwipeRight?.();
        swiping.current = false;
        return;
      }

      // Tap / Double tap
      if (!moved.current && dt <= TAP_TIME) {
        const gap = endT - lastTapT.current;
        lastTapT.current = endT;
        if (gap <= DBL_GAP) onDoubleTap?.();
        else onTap?.();
      }

      swiping.current = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false }); // important for preventDefault
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [
    ref, onSwipeLeft, onSwipeRight, onTap, onDoubleTap, onLongPress,
    SWIPE, TAP_MOVE, TAP_TIME, DBL_GAP, LONG_MS, LOCK_SCROLL
  ]);
