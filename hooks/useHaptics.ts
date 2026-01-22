
// hooks/useHaptics.ts
"use client";

export function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined") return;
  // @ts-ignore
  if ("vibrate" in navigator) {
    // @ts-ignore
    navigator.vibrate(pattern);
  }
}

export function pulseSoft() {
  vibrate(25);
}

export function pulseMedium() {
  vibrate([30, 40, 30]);
}

export function pulseStrong() {
  vibrate([50, 60, 50]);
}
