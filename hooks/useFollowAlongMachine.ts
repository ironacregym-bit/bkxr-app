
// hooks/useFollowAlongMachine.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Small state machine for follow‑along playback.
 * - 1s tick with threshold‑crossing beeps (handles skipped seconds)
 * - Play / Pause / Prev / Next / Reset
 * - Audio unlocked on first Play
 */

export type TimelineRound = {
  id: string;
  name: string;
  duration: number;             // seconds (e.g., 180)
  category?: string;            // "Boxing" | "Kettlebell" (optional for chips)
  style?: string;               // "EMOM" | "AMRAP" | "LADDER"
  items?: any[];
};

export type FollowAlongOptions = {
  thresholds?: number[];        // default [120, 60] (2:00, 1:00)
  beepSrc?: string;             // default "/beep.mp3"
  bellSrc?: string;             // default "/triple-bell.mp3"
  onRoundChange?: (nextIndex: number, round: TimelineRound) => void;
  onFinish?: () => void;
};

export function useFollowAlongMachine(
  timeline: TimelineRound[],
  opts: FollowAlongOptions = {}
) {
  const thresholds = useMemo(
    () => (opts.thresholds && opts.thresholds.length ? opts.thresholds.slice().sort((a, b) => b - a) : [120, 60]),
    [opts.thresholds]
  );

  // Core state
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState<number>(timeline[0]?.duration ?? 180);
  const [running, setRunning] = useState(false);

  // Refs to avoid stale closures inside the timer
  const indexRef = useRef(index);
  const remainingRef = useRef(remaining);
  const runningRef = useRef(running);
  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => { remainingRef.current = remaining; }, [remaining]);
  useEffect(() => { runningRef.current = running; }, [running]);

  // Audio refs
  const beepRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof Audio === "undefined") return;
    beepRef.current = new Audio(opts.beepSrc || "/beep.mp3");
    beepRef.current.volume = 0.85;
    bellRef.current = new Audio(opts.bellSrc || "/triple-bell.mp3");
    bellRef.current.volume = 0.9;
  }, [opts.beepSrc, opts.bellSrc]);

  const playBeep = () => {
    const el = beepRef.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => {});
  };
  const playBell = () => {
    const el = bellRef.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => {});
  };

  // Helper: threshold crossing between prev -> next (covers timer skips)
  const crossed = (prev: number, next: number, mark: number) => prev > mark && next <= mark;

  // Ticker
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;

        // Mid‑round threshold beeps (only for marks within current round duration)
        const dur = timeline[indexRef.current]?.duration ?? 180;
        for (const m of thresholds) {
          if (m > 0 && m < dur && crossed(prev, next, m)) {
            playBeep();
            break; // prevent multiple beeps if marks are too close
          }
        }

        // Round end
        if (next < 0) {
          const ni = indexRef.current + 1;

          if (ni >= timeline.length) {
            playBell();
            setRunning(false);
            opts.onFinish?.();
            return 0;
          }

          setIndex(ni);
          playBeep();
          opts.onRoundChange?.(ni, timeline[ni]);
          return timeline[ni]?.duration ?? 180;
        }

        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, thresholds, timeline]);

  // Controls
  function play() {
    setRunning(true);
    playBeep(); // unlock audio on iOS
  }
  function pause() {
    setRunning(false);
  }
  function reset() {
    setRunning(false);
    setIndex(0);
    setRemaining(timeline[0]?.duration ?? 180);
  }
  function next() {
    setRunning(false);
    const ni = Math.min(timeline.length - 1, indexRef.current + 1);
    if (ni !== indexRef.current) {
      setIndex(ni);
      setRemaining(timeline[ni]?.duration ?? 180);
      opts.onRoundChange?.(ni, timeline[ni]);
    }
  }
  function prev() {
    setRunning(false);
    const ni = Math.max(0, indexRef.current - 1);
    if (ni !== indexRef.current) {
      setIndex(ni);
      setRemaining(timeline[ni]?.duration ?? 180);
      opts.onRoundChange?.(ni, timeline[ni]);
    }
  }

  // Derived helpers
  const current = timeline[index] || timeline[0];
  const nextRound = timeline[index + 1];
  const duration = current?.duration ?? 180;
  const progress = Math.max(0, Math.min(1, (duration - remaining) / Math.max(1, duration)));

  return {
    // state
    index,
    remaining,
    running,
    duration,
    current,
    nextRound,
    progress,

    // controls
    play,
    pause,
    reset,
    next,
    prev,
    setIndex,

    // meta
    totalRounds: timeline.length,
  };
}
