
// components/workouts/FollowAlongViewer.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import ExerciseMedia from "./ExerciseMedia";
import TimerControls from "./TimerControls";
import RoundMediaRail from "./RoundMediaRail";
import TechniqueChips from "./TechniqueChips";
import { useFollowAlongMachine, TimelineRound } from "../../hooks/useFollowAlongMachine";
import useGestureControls from "../../hooks/useGestureControls";
import useWakeLock from "../../hooks/useWakeLock";
import useFullscreen from "../../hooks/useFullscreen";
import { pulseSoft, pulseMedium } from "../../hooks/useHaptics";

type KBStyle = "EMOM" | "AMRAP" | "LADDER";
type BoxingAction = { kind: "punch" | "defence"; code: string; count?: number; tempo?: string; notes?: string };

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
  duration_s?: number;
  items: ExerciseItemOut[];
};

const ACCENT = "#FF8A2A";

export default function FollowAlongViewer({
  rounds,
  exerciseNameById,
  videoByExerciseId,
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

  // sound + mobile niceties
  const [muted, setMuted] = useState(false);

  // playback machine
  const {
    index, remaining, running, duration, current, nextRound, play, pause, reset, next, prev, totalRounds,
  } = useFollowAlongMachine(timeline, {
    thresholds: [120, 60],
    muted,
    onRoundChange: () => {
      pulseMedium(); // haptic on round change
    },
    onMinuteChange: (m) => {
      if (m > 0) pulseSoft(); // haptic on minute tick (except 0)
    },
  });

  const sideLabel = index < boxRoundsCount ? "BOX" : "BELL";
  const leftChip = `Round ${index + 1}/${totalRounds} • ${sideLabel}`;
  const rightChips = [current?.category || "", current?.style || ""].filter(Boolean);

  // derive minute index 0..2
  const minuteIndex = Math.min(2, Math.max(0, Math.floor(((duration || 180) - remaining) / 60)));

  // wake lock while running
  useWakeLock(running);

  // fullscreen control
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(cardRef);

  // gestures
  const gestureRef = useRef<HTMLDivElement | null>(null);
  useGestureControls(gestureRef, {
    onSwipeLeft: () => next(),
    onSwipeRight: () => prev(),
    onTap: () => (running ? pause() : play()),
    onDoubleTap: () => toggleFullscreen(),
    onLongPress: () => pause(),
  });

  // iOS pull‑to‑refresh avoidance (contain overscroll) + safe area
  const containerStyle: React.CSSProperties = {
    overscrollBehavior: "contain",
    paddingBottom: "env(safe-area-inset-bottom)",
    borderRadius: 12,
  };

  /* ------------- Boxing: one combo per minute ------------- */
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

    const nextUpLabel =
      nextCombo?.name
        ? `Next: ${nextCombo.name}`
        : nextRound
        ? `Next round: ${nextRound.name}`
        : "";

    return (
      <div>
        <div className="d-flex align-items-center mb-2" style={{ gap: 6 }}>
          {[0, 1, 2].map((m) => (
            <span
              key={m}
              title={`Minute ${m + 1}`}
              style={{
                width: 10, height: 10, borderRadius: "50%",
                background: m === minuteIndex ? ACCENT : "rgba(255,255,255,0.22)",
                boxShadow: m === minuteIndex ? `0 0 8px ${ACCENT}88` : "none",
              }}
            />
          ))}
        </div>

        <ExerciseMedia title={activeTitle} subtitle={codesLine} aspect="16x9" />

        {activeCombo?.actions?.length ? (
          <div className="mt-2">
            <TechniqueChips actions={activeCombo.actions} techVideoByCode={techVideoByCode} />
          </div>
        ) : null}

        {activeCombo?.notes ? (
          <div className="mt-2 text-dim" style={{ fontSize: 12 }}>{activeCombo.notes}</div>
        ) : null}

        {nextUpLabel ? (
          <div className="mt-3 d-flex align-items-center justify-content-between">
            <div className="text-dim" style={{ fontSize: 12 }}>Next up</div>
            <div className="fw-semibold">{nextUpLabel}</div>
          </div>
        ) : null}
      </div>
    );
  }

  /* ------------- Kettlebell: media rail shows all exercises ------------- */
  function KettlebellPane() {
    const items = current?.items || [];

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
          ].filter(Boolean).join(" ");
          return [nm, meta].filter(Boolean).join(" — ");
        })
        .filter(Boolean)
        .join("  •  ") || "Work for 3:00";

    return (
      <div>
        <div className="mb-2 d-flex align-items-center" style={{ gap: 8 }}>
          <div className="fw-semibold">{current?.name || "Kettlebell Round"}</div>
          {current?.style ? (
            <span className="badge bg-transparent" style={{ border: "1px solid rgba(255,255,255,0.18)", color: "#cfd7df" }}>
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

        <div className="mt-2 text-dim" style={{ fontSize: 12 }}>{subtitleAll}</div>

        {nextRound ? (
          <div className="mt-3 d-flex align-items-center justify-content-between">
            <div className="text-dim" style={{ fontSize: 12 }}>Next up</div>
            <div className="fw-semibold">{nextRound.name}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section
      ref={cardRef}
      className="futuristic-card p-3 mb-3"
      style={containerStyle}
    >
      <div ref={gestureRef}>
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
          muted={muted}
          onToggleSound={() => setMuted((m) => !m)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />

        {current?.category === "Boxing" ? <BoxingPane /> : <KettlebellPane />}
      </div>
    </section>
  );
}
