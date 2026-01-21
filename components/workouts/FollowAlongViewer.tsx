
// components/workouts/FollowAlongViewer.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ExerciseMedia from "./ExerciseMedia";

/**
 * Guided follow‑along:
 * - Big pane (ExerciseMedia fallback card)
 * - Per‑round 3:00 countdown
 * - Play / Pause / Prev / Next
 * - “Next up”
 *
 * NOTE: This file is self-contained (no external hooks).
 * In the next step we can replace the internal timer with `useFollowAlongMachine`
 * and swap the inlined controls with `TimerControls`.
 */

type KBStyle = "EMOM" | "AMRAP" | "LADDER";
type BoxingAction = { kind: "punch" | "defence"; code: string };
type ExerciseItemOut = {
  item_id: string;
  type: "Boxing" | "Kettlebell";
  style?: KBStyle | "Combo";
  order: number;
  duration_s?: number;
  combo?: { name?: string; actions: BoxingAction[]; notes?: string };
  exercise_id?: string;
  reps?: string;
  time_s?: number;
  weight_kg?: number;
  tempo?: string;
  rest_s?: number;
};
type RoundOut = {
  round_id: string;
  name: string;
  order: number;
  category: "Boxing" | "Kettlebell";
  style?: KBStyle;
  duration_s?: number; // boxing uses this (usually 180)
  items: ExerciseItemOut[];
};

const ACCENT = "#FF8A2A";

export default function FollowAlongViewer({
  rounds,
  exerciseNameById,
  techVideoByCode,
  boxRoundsCount = 5,
}: {
  rounds: RoundOut[];
  exerciseNameById: Record<string, string>;
  techVideoByCode?: Record<string, string | undefined>;
  boxRoundsCount?: number;
}) {
  const ordered = useMemo(
    () => rounds.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [rounds]
  );

  // Timeline: 3:00 each, boxing uses duration_s ?? 180 for safety
  const timeline = useMemo(
    () =>
      ordered.map((r) => ({
        id: r.round_id,
        name: r.name,
        category: r.category,
        style: r.style,
        items: r.items || [],
        duration: r.category === "Boxing" ? r.duration_s ?? 180 : 180,
      })),
    [ordered]
  );

  // --- Runner state (internal until we swap to useFollowAlongMachine) ---
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState<number>(timeline[0]?.duration ?? 180);
  const [running, setRunning] = useState(false);

  const idxRef = useRef(idx);
  const remainingRef = useRef(remaining);
  const runningRef = useRef(running);
  useEffect(() => { idxRef.current = idx; }, [idx]);
  useEffect(() => { remainingRef.current = remaining; }, [remaining]);
  useEffect(() => { runningRef.current = running; }, [running]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const beep = useRef<HTMLAudioElement | null>(null);
  const triple = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof Audio !== "undefined") {
      beep.current = new Audio("/beep.mp3");
      beep.current.volume = 0.8;
      triple.current = new Audio("/triple-bell.mp3");
      triple.current.volume = 0.9;
    }
  }, []);
  const playBeep = () => {
    if (!beep.current) return;
    beep.current.currentTime = 0;
    void beep.current.play().catch(() => {});
  };
  const playTriple = () => {
    if (!triple.current) return;
    triple.current.currentTime = 0;
    void triple.current.play().catch(() => {});
  };

  // threshold beeps (handle timer skips)
  function crossed(prev: number, next: number, mark: number) {
    return prev > mark && next <= mark;
  }

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;

        // mid-round beeps: 2:00 and 1:00
        if (crossed(prev, next, 120) || crossed(prev, next, 60)) playBeep();

        if (next < 0) {
          const nextIdx = idxRef.current + 1;
          if (nextIdx >= timeline.length) {
            playTriple();
            setRunning(false);
            return 0;
          }
          setIdx(nextIdx);
          playBeep();
          return timeline[nextIdx]?.duration ?? 180;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, timeline]);

  function start() {
    setRunning(true);
    playBeep(); // unlock audio
  }
  function pause() {
    setRunning(false);
  }
  function reset() {
    setRunning(false);
    setIdx(0);
    setRemaining(timeline[0]?.duration ?? 180);
  }
  function prev() {
    setRunning(false);
    const ni = Math.max(0, idx - 1);
    setIdx(ni);
    setRemaining(timeline[ni]?.duration ?? 180);
  }
  function next() {
    setRunning(false);
    const ni = Math.min(timeline.length - 1, idx + 1);
    setIdx(ni);
    setRemaining(timeline[ni]?.duration ?? 180);
  }

  // derived
  const current = timeline[idx] || timeline[0];
  const nextRound = timeline[idx + 1];
  const sideLabel = idx < boxRoundsCount ? "BOX" : "BELL";

  function mmss(s: number) {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(Math.max(s % 60, 0)).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  // Content rendering helpers
  function contentTitle(): string {
    if (!current) return "Round";
    if (current.category === "Boxing") return current.name;
    // Prefer first item’s display name for KB
    const first = current.items[0];
    if (first?.exercise_id) {
      return exerciseNameById[first.exercise_id] || first.exercise_id || current.name;
    }
    return current.name;
  }

  function contentSubtitle(): string | undefined {
    if (!current) return undefined;
    if (current.category === "Boxing") {
      // Show the first combo codes as a hint
      const c = current.items.find((it) => it.combo)?.combo;
      if (!c || !Array.isArray(c.actions) || c.actions.length === 0) return "Cycle the 3 combos for 3:00";
      return c.actions.map((a) => a.code).join(" • ");
    } else {
      const parts: string[] = [];
      current.items.slice(0, 2).forEach((it) => {
        const name =
          (it.exercise_id && (exerciseNameById[it.exercise_id] || it.exercise_id)) ||
          it.exercise_id ||
          "";
        const meta = [
          it.reps ? `${it.reps} reps` : "",
          typeof it.time_s === "number" ? `${it.time_s}s` : "",
        ]
          .filter(Boolean)
          .join(" ");
        parts.push([name, meta].filter(Boolean).join(" — "));
      });
      return parts.join("  |  ") || "Work for 3:00";
    }
  }

  return (
    <section className="futuristic-card p-3 mb-3">
      {/* Header / transport */}
      <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
        <div className="d-flex align-items-center" style={{ gap: 10 }}>
          <span style={{ letterSpacing: ".06em", color: "#9fb3c8" }}>
            Round {idx + 1}/{timeline.length} • {sideLabel}
          </span>
          <span
            className="badge bg-transparent"
            style={{ border: "1px solid rgba(255,255,255,0.18)", color: "#cfd7df" }}
          >
            {current?.category || "Round"}
          </span>
          {current?.style ? (
            <span
              className="badge bg-transparent"
              style={{ border: "1px solid rgba(255,255,255,0.18)", color: "#cfd7df" }}
              title={current.style}
            >
              {current.style}
            </span>
          ) : null}
        </div>

        <div className="d-flex" style={{ gap: 8 }}>
          <button className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }} onClick={prev} disabled={idx === 0}>
            ← Prev
          </button>
          {running ? (
            <button className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }} onClick={pause}>
              Pause
            </button>
          ) : (
            <button
              className="btn btn-sm"
              onClick={start}
              style={{
                borderRadius: 24,
                color: "#fff",
                background: "linear-gradient(135deg, #FF8A2A, #ff7f32)",
                boxShadow: "0 0 14px #FF8A2A66",
                border: "none",
                paddingInline: 14,
              }}
            >
              Play
            </button>
          )}
          <button className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }} onClick={next} disabled={idx >= timeline.length - 1}>
            Next →
          </button>
          <button className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }} onClick={reset}>
            Reset
          </button>
        </div>
      </div>

      {/* Timer */}
      <div className="mb-2">
        <div style={{ fontSize: 36, fontWeight: 800 }}>{mmss(remaining)}</div>
        <div className="capacity mt-1">
          <div className="bar">
            <span
              style={{
                width: `${
                  ((current?.duration || 1) - remaining) / (current?.duration || 1) * 100
                }%`,
                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                boxShadow: `0 0 10px ${ACCENT}55`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Big pane */}
      <ExerciseMedia
        title={contentTitle()}
        subtitle={contentSubtitle()}
        // Pass a video URL if you have one mapped; leaving undefined falls back to a nice card.
        videoUrl={undefined}
        aspect="16x9"
      />

      {/* Next up */}
      {nextRound ? (
        <div className="mt-3 d-flex align-items-center justify-content-between">
          <div className="text-dim" style={{ fontSize: 12 }}>
            Next up
          </div>
          <div className="fw-semibold">{nextRound.name}</div>
        </div>
      ) : null}
    </section>
  );
}
