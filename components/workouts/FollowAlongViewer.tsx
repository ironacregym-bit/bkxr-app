
// components/workouts/FollowAlongViewer.tsx
"use client";

import { useMemo } from "react";
import ExerciseMedia from "./ExerciseMedia";
import TimerControls from "./TimerControls";
import { useFollowAlongMachine, TimelineRound } from "../../hooks/useFollowAlongMachine";

type KBStyle = "EMOM" | "AMRAP" | "LADDER";
type BoxingAction = { kind: "punch" | "defence"; code: string; count?: number; tempo?: string; notes?: string };

type ExerciseItemOut = {
  item_id: string;
  type: "Boxing" | "Kettlebell";
  style?: KBStyle | "Combo";
  order: number;

  // Boxing
  duration_s?: number;
  combo?: { name?: string; actions: BoxingAction[]; notes?: string };

  // Kettlebell
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
  duration_s?: number; // boxing uses this (default 180)
  items: ExerciseItemOut[];
};

export default function FollowAlongViewer({
  rounds,
  exerciseNameById,
  techVideoByCode, // reserved for future media mapping per action/exercise
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

  const timeline: TimelineRound[] = useMemo(
    () =>
      ordered.map((r) => ({
        id: r.round_id,
        name: r.name,
        duration: r.category === "Boxing" ? r.duration_s ?? 180 : 180, // KB is visually 3:00
        category: r.category,
        style: r.style,
        items: r.items || [],
      })),
    [ordered]
  );

  const {
    index,
    remaining,
    running,
    duration,
    current,
    nextRound,
    progress,
    play,
    pause,
    reset,
    next,
    prev,
    totalRounds,
  } = useFollowAlongMachine(timeline, {
    thresholds: [120, 60], // 2:00 & 1:00 mid‑round beeps
    onRoundChange: (i, round) => {
      // Optional: voice cue when switching from BOX to BELL
      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        i === boxRoundsCount
      ) {
        window.speechSynthesis.speak(
          new SpeechSynthesisUtterance("Switch to kettlebell")
        );
      }
    },
  });

  const sideLabel = index < boxRoundsCount ? "BOX" : "BELL";
  const leftChip = `Round ${index + 1}/${totalRounds} • ${sideLabel}`;
  const rightChips = [
    current?.category || "",
    current?.style || "",
  ].filter(Boolean);

  // Title/subtitle for ExerciseMedia
  function mediaTitle(): string {
    if (!current) return "Round";
    if (current.category === "Boxing") return current.name;
    // For KB show first exercise name if present
    const first = current.items?.[0];
    if (first?.exercise_id) {
      return exerciseNameById[first.exercise_id] || first.exercise_id || current.name;
    }
    return current.name;
  }

  function mediaSubtitle(): string | undefined {
    if (!current) return undefined;

    if (current.category === "Boxing") {
      const combo = current.items?.find((it: any) => it?.combo)?.combo;
      if (!combo || !Array.isArray(combo.actions) || combo.actions.length === 0) {
        return "Cycle the 3 combos for 3:00";
      }
      return combo.actions.map((a: BoxingAction) => a.code).join(" • ");
    }

    // Kettlebell: show first couple movements with brief meta
    const parts: string[] = [];
    (current.items || []).slice(0, 2).forEach((it: any) => {
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

  return (
    <section className="futuristic-card p-3 mb-3">
      {/* Transport + timer */}
      <TimerControls
        running={running}
        remaining={remaining}
        duration={duration}
        onPlay={play}
        onPause={pause}
        onPrev={prev}
        onNext={next}
        onReset={reset}
        leftChip={leftChip}
        rightChips={rightChips}
      />

      {/* Big media pane */}
      <ExerciseMedia
        title={mediaTitle()}
        subtitle={mediaSubtitle()}
        videoUrl={undefined /* map if/when you have per-exercise/combination video */}
        aspect="16x9"
      />

      {/* Next up */}
      {nextRound ? (
        <div className="mt-3 d-flex align-items-center justify-content-between">
          <div className="text-dim" style={{ fontSize: 12 }}>Next up</div>
          <div className="fw-semibold">{nextRound.name}</div>
        </div>
      ) : null}
    </section>
  );
}
