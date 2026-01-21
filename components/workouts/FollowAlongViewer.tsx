
// components/workouts/FollowAlongViewer.tsx
"use client";

import { useMemo } from "react";
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
  duration_s?: number; // boxing default 180
  items: ExerciseItemOut[];
};

const ACCENT = "#FF8A2A";

export default function FollowAlongViewer({
  rounds,
  exerciseNameById,
  videoByExerciseId, // optional: map exercise_id -> video_url (from /api/exercises/media)
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
        duration: r.category === "Boxing" ? r.duration_s ?? 180 : 180, // 3:00 for KB display
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
    thresholds: [120, 60], // beep at 2:00 and 1:00
    onRoundChange: (i) => {
      // Announce when switching from Boxing to Kettlebell
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

  // Minute-of-round index for 3:00 (0..2)
  const minuteIndex = useMemo(() => {
    const elapsed = (duration || 180) - remaining;
    return Math.min(2, Math.max(0, Math.floor(elapsed / 60)));
  }, [duration, remaining]);

  /* ---------------- Boxing: 1 combo per minute ---------------- */
  function BoxingPane() {
    const combos = (current?.items || []).filter((it: any) => !!it.combo);
    const activeCombo = combos.length ? combos[minuteIndex % combos.length].combo : null;
    const nextCombo =
      combos.length && minuteIndex < combos.length - 1
        ? combos[minuteIndex + 1].combo
        : null;

    const activeTitle = activeCombo?.name || current?.name || "Boxing";
    const codesLine =
      activeCombo?.actions?.length
        ? activeCombo.actions.map((a: BoxingAction) => a.code).join(" • ")
        : "Cycle the 3 combos";

    // Next-up label: next combo inside the round, else next round when on last minute
    const nextUpLabel =
      nextCombo?.name
        ? `Next: ${nextCombo.name}`
        : nextRound
        ? `Next round: ${nextRound.name}`
        : "";

    return (
      <div>
        {/* Minute dots (which combo is active) */}
        <div className="d-flex align-items-center mb-2" style={{ gap: 6 }}>
          {[0, 1, 2].map((m) => (
            <span
              key={m}
              title={`Minute ${m + 1}`}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: m === minuteIndex ? ACCENT : "rgba(255,255,255,0.22)",
                boxShadow: m === minuteIndex ? `0 0 8px ${ACCENT}88` : "none",
              }}
            />
          ))}
        </div>

        {/* Big media (fallback card unless you wire per-combo videos) */}
        <ExerciseMedia
          title={activeTitle}
          subtitle={codesLine}
          videoUrl={undefined}
          aspect="16x9"
        />

        {/* Technique chips for the current combo */}
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

        {/* Next up (combo-in-round first; next round only when appropriate) */}
        {nextUpLabel ? (
          <div className="mt-3 d-flex align-items-center justify-content-between">
            <div className="text-dim" style={{ fontSize: 12 }}>
              Next up
            </div>
            <div className="fw-semibold">{nextUpLabel}</div>
          </div>
        ) : null}
      </div>
    );
  }

  /* ---------------- Kettlebell: full exercise list via rail ---------------- */
  function KettlebellPane() {
    const items = current?.items || [];

    // Subtitle now lists ALL exercises for this round (not just two)
    const subtitleAll =
      items
        .map((it: any) => {
          const nm =
            (it.exercise_id && (exerciseNameById[it.exercise_id] || it.exercise_id)) ||
            it.exercise_id ||
            "";
          const meta = [
            it.reps ? `${it.reps} reps` : "",
            typeof it.time_s === "number" ? `${it.time_s}s` : "",
          ]
            .filter(Boolean)
            .join(" ");
          return [nm, meta].filter(Boolean).join(" — ");
        })
        .filter(Boolean)
        .join("  •  ") || "Work for 3:00";

    return (
      <div>
        <div className="mb-2 d-flex align-items-center" style={{ gap: 8 }}>
          <div className="fw-semibold">{current?.name || "Kettlebell Round"}</div>
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

        {/* Big media rail (shows ALL exercises in the round; tap to switch) */}
        <RoundMediaRail
          items={items}
          exerciseNameById={exerciseNameById}
          videoByExerciseId={videoByExerciseId}
          aspect="16x9"
        />

        {/* Full round summary under the rail */}
        <div className="mt-2 text-dim" style={{ fontSize: 12 }}>
          {subtitleAll}
        </div>
      </div>
    );
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

      {/* If BoxingPane already shows next combo, we only show next round when applicable in BoxingPane.
          For KB, we always show next round here. */}
      {current?.category === "Kettlebell" && nextRound ? (
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
