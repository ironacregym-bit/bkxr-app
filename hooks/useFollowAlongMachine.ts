
// hooks/useFollowAlongMachine.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type TimelineRound = {
  id: string;
  name: string;
  duration: number;     // seconds
  category?: string;    // "Boxing" | "Kettlebell"
  style?: string;       // "EMOM" | "AMRAP" | "LADDER"
  items?: any[];
};

export type FollowAlongOptions = {
  thresholds?: number[];            // e.g. [120,60]
  beepSrc?: string;                 // default "/beep.mp3"
  bellSrc?: string;                 // default "/triple-bell.mp3"
  muted?: boolean;                  // new: mute audio beeps
  onRoundChange?: (index: number, round: TimelineRound) => void;
  onFinish?: () => void;
  onMinuteChange?: (minuteIndex: number) => void; // new: 0..floor(duration/60)
};

export function useFollowAlongMachine(
  timeline: TimelineRound[],
  opts: FollowAlongOptions = {}
) {
  const thresholds = useMemo(
    () => (opts.thresholds?.length ? opts.thresholds.slice().sort((a,b)=>b-a) : [120,60]),
    [opts.thresholds]
  );

  // state
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState<number>(timeline[0]?.duration ?? 180);
  const [running, setRunning] = useState(false);

  // refs
  const indexRef = useRef(index);
  const remainingRef = useRef(remaining);
  const runningRef = useRef(running);
  const mutedRef = useRef(!!opts.muted);
  const prevMinuteRef = useRef<number | null>(null);

  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => { remainingRef.current = remaining; }, [remaining]);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { mutedRef.current = !!opts.muted; }, [opts.muted]);

  // audio
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
    if (mutedRef.current) return;
    const el = beepRef.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => {});
  };
  const playBell = () => {
    if (mutedRef.current) return;
    const el = bellRef.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => {});
  };

  const crossed = (prev: number, next: number, mark: number) => prev > mark && next <= mark;

  // tick
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;

        const dur = timeline[indexRef.current]?.duration ?? 180;

        // minute change callback (derived)
        const minuteNow = Math.floor((dur - Math.max(next,0)) / 60);
        if (minuteNow !== prevMinuteRef.current) {
          prevMinuteRef.current = minuteNow;
          opts.onMinuteChange?.(minuteNow);
        }

        // threshold beeps
        for (const m of thresholds) {
          if (m > 0 && m < dur && crossed(prev, next, m)) {
            playBeep();
            break;
          }
        }

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
          prevMinuteRef.current = null; // reset minute tracker
          return timeline[ni]?.duration ?? 180;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, thresholds, timeline, opts.onFinish, opts.onMinuteChange, opts.onRoundChange]);

  // controls
  function play() {
    setRunning(true);
    playBeep(); // unlock
  }
  function pause() { setRunning(false); }
  function reset() {
    setRunning(false);
    setIndex(0);
    setRemaining(timeline[0]?.duration ?? 180);
    prevMinuteRef.current = null;
  }
  function next() {
    setRunning(false);
    const ni = Math.min(timeline.length - 1, indexRef.current + 1);
    if (ni !== indexRef.current) {
      setIndex(ni);
      setRemaining(timeline[ni]?.duration ?? 180);
      prevMinuteRef.current = null;
      opts.onRoundChange?.(ni, timeline[ni]);
    }
  }
  function prev() {
    setRunning(false);
    const ni = Math.max(0, indexRef.current - 1);
    if (ni !== indexRef.current) {
      setIndex(ni);
      setRemaining(timeline[ni]?.duration ?? 180);
      prevMinuteRef.current = null;
      opts.onRoundChange?.(ni, timeline[ni]);
    }
  }

  const current = timeline[index] || timeline[0];
  const nextRound = timeline[index + 1];
  const duration = current?.duration ?? 180;
  const progress = Math.max(0, Math.min(1, (duration - remaining) / Math.max(1, duration)));

  return {
    index, remaining, running, duration, current, nextRound, progress,
    play, pause, reset, next, prev, setIndex,
    totalRounds: timeline.length,
  };
}
