
// components/workouts/FollowAlongViewer.tsx
"use client";

import { useMemo, useState } from "react";
import ExerciseMedia from "./ExerciseMedia";
import TimerControls from "./TimerControls";
import RoundMediaRail from "./RoundMediaRail";
import TechniqueChips from "./TechniqueChips";
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
  duration_s?: number; // boxing = 180
  items: ExerciseItemOut[];
};

export default function FollowAlongViewer({
  rounds,
  exerciseNameById,
  videoByExerciseId, // NEW: pass a Firestore-derived mapping { exercise_id: video_url }
  techVideoByCode,
  boxRoundsCount = 5,
}: {
  rounds: RoundOut[];
  exerciseNameById: Record<string, string>;
  videoByExerciseId?: Record<string, string | undefined>;
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
        duration: r.category === "Boxing" ? r.duration_s ?? 180 : 180,
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
    thresholds: [120, 60], // beeps at 2:00 & 1:00
    onRoundChange: (i) => {
      // Voice cue at the transition from Boxing → Kettlebell
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
  const rightChips = [current?.category || "", current?.style || ""].filter(Boolean);

  // Minute-of-round index for 3:00 rounds (0,1,2)
  const minuteIndex = useMemo(() => {
    const elapsed = (duration || 180) - remaining;
    return Math.min(2, Math.max(0, Math.floor(elapsed / 60)));
  }, [duration, remaining]);

  // --- Boxing view: 1 combo per minute ---
  function BoxingPane() {
    const combos = (current?.items || []).filter((it: any) => !!it.combo);
    const activeCombo = combos.length ? combos[minuteIndex % combos.length].combo : null;

    const activeTitle = activeCombo?.name || current?.name || "Boxing";
    const codesLine =
      activeCombo?.actions?.length
        ? activeCombo.actions.map((a: BoxingAction) => a.code).join(" • ")
        : "Cycle the 3 combos";

    return (
      <div>
        {/* Minute dots */}
        <div className="d-flex align-items-center mb-2" style={{ gap: 6 }}>
          {[0, 1, 2].map((m) => (
            <span
              key={m}
              title={`Minute ${m + 1}`}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: m === minuteIndex ? "#FF8A2A" : "rgba(255,255,255,0.22)",
                boxShadow: m === minuteIndex ? "0 0 8px #FF8A2A88" : "none",
              }}
            />
          ))}
        </div>

        <ExerciseMedia
          title={activeTitle}
          subtitle={codesLine}
          // If you later store per-combo video URLs, pass them here
          videoUrl={undefined}
          aspect="16x9"
        />

        {/* Technique chips for the active combo */}
        {activeCombo?.actions?.length ? (
          <div className="mt-2">
            <TechniqueChips actions={activeCombo.actions} techVideoByCode={techVideoByCode} />
          </div>
        ) : null}

        {activeCombo?.notes ? (
          <div className="mt-2 text-dim" style={{ fontSize: 12 }}>
            {activeCombo.notes}
          </div>
        ) : null}
      </div>
    );
  }

  // --- Kettlebell view: show each exercise's video via a rail ---
  function KettlebellPane() {
    const items = current?.items || [];

    return (
      <div>
        <div className="mb-2 d-flex align-items-center" style={{ gap: 8 }}>
          <div className="fw-semibold">{current?.name || "Kettlebell Round"}</div>
          {current?.style ? (
            <span
              className="badge bg-transparent"
              style={{ border: "1px solid rgba(255,255,255,0.18)", color: "#cfd7df" }}
            >
              {current.style}
            </span>
          ) : null}
        </div>

        <RoundMediaRail
          items={items}
          exerciseNameById={exerciseNameById}
          videoByExerciseId={videoByExerciseId}
          aspect="16x9"
        />

        {/* Optional UX guidance under the rail */}
        <div className="mt-2 text-dim" style={{ fontSize: 12 }}>
          {current?.style === "EMOM"
            ? "EMOM: perform the same prescribed work each minute; rest the remainder."
            : current?.style === "LADDER"
            ? "LADDER: alternate movements while increasing reps smoothly."
            : "AMRAP: cycle movements steadily for the full 3 minutes."}
        </div>
      </div>
    );
  }

  // Title/subtitle for the big header pane (used only when we don’t delegate to sub‑panes)
  function headerTitle(): string {
    if (!current) return "Round";
    if (current.category === "Boxing") return current.name;
    const first = current.items?.[0];
    if (first?.exercise_id) {
      return exerciseNameById[first.exercise_id] || first.exercise_id || current.name;
    }
    return current.name;
  }

  return (
    <section className="futuristic-card p-3 mb-3">
      {/* Transport + progress */}
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

      {/* Content */}
      {current?.category === "Boxing" ? <BoxingPane /> : <KettlebellPane />}

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
