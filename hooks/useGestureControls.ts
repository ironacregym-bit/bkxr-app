
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
  tapTimeMs?: number;        // default 250
  dblTapGapMs?: number;      // default 300
  longPressMs?: number;      // default 500
};

export default function useGestureControls<T extends HTMLElement>(
  ref: React.RefObject<T>,
  cbs: Callbacks,
  opts: Options = {}
) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onTap,
    onDoubleTap,
    onLongPress,
  } = cbs;

  const SWIPE = opts.swipeThresholdPx ?? 60;
  const TAP_MOVE = opts.tapMoveTolPx ?? 8;
  const TAP_TIME = opts.tapTimeMs ?? 250;
  const DBL_GAP = opts.dblTapGapMs ?? 300;
  const LONG_MS = opts.longPressMs ?? 500;

  const startX = useRef(0);
  const startY = useRef(0);
  const startT = useRef(0);
  const moved = useRef(false);
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

      // long press
      if (onLongPress) {
        longTimer.current = window.setTimeout(() => {
          onLongPress?.();
          longTimer.current && clearTimeout(longTimer.current);
          longTimer.current = null;
        }, LONG_MS);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches.length) return;
      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      if (Math.hypot(dx, dy) > TAP_MOVE) moved.current = true;

      // if moving far, cancel long press
      if (longTimer.current && Math.hypot(dx, dy) > TAP_MOVE) {
        clearTimeout(longTimer.current);
        longTimer.current = null;
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
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);

      // swipe
      if (ax >= SWIPE && ax > ay) {
        if (dx < 0) onSwipeLeft?.();
        else onSwipeRight?.();
        return;
      }

      // tap / double tap
      if (!moved.current && dt <= TAP_TIME) {
        const gap = endT - lastTapT.current;
        lastTapT.current = endT;
        if (gap <= DBL_GAP) onDoubleTap?.();
        else onTap?.();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, onSwipeLeft, onSwipeRight, onTap, onDoubleTap, onLongPress, SWIPE, TAP_MOVE, TAP_TIME, DBL_GAP, LONG_MS]);
}
