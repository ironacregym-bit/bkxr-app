
// components/workouts/FollowAlongViewer.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import ExerciseMedia from "./ExerciseMedia";
import TimerControls from "./TimerControls";
import RoundMediaRail from "./RoundMediaRail";
import TechniqueChips, { BoxingAction } from "./TechniqueChips";
import ModalMedia from "./ModalMedia";
import { useFollowAlongMachine, TimelineRound } from "../../hooks/useFollowAlongMachine";
import useGestureControls from "../../hooks/useGestureControls";
import useWakeLock from "../../hooks/useWakeLock";
import useFullscreen from "../../hooks/useFullscreen";
import { pulseSoft, pulseMedium } from "../../hooks/useHaptics";

type KBStyle = "EMOM" | "AMRAP" | "LADDER";
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
  style?: KBStyle;           // KB style
  duration_s?: number;       // boxing default 180
  items: ExerciseItemOut[];
};

const ACCENT = "#FF8A2A";

export default function FollowAlongViewer({
  rounds,
  exerciseNameById,
  videoByExerciseId,
  gifByExerciseId,          // optional: GIF map { exercise_id: gif_url }
  techVideoByCode,
  boxRoundsCount = 5,
}: {
  rounds: RoundOut[];
  exerciseNameById: Record<string, string>;
  videoByExerciseId?: Record<string, string | undefined>;
  gifByExerciseId?: Record<string, string | undefined>;
  techVideoByCode?: Record<string, string | undefined>;
  boxRoundsCount?: number;
}) {
  // Sorted input rounds
  const ordered = useMemo(
    () => rounds.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [rounds]
  );

  // Build segments: add 1:00 rest after every round, except final; add 5:00 after boxing #5
  const timeline: TimelineRound[] = useMemo(() => {
    const segs: TimelineRound[] = [];
    const total = ordered.length;
    ordered.forEach((r, idx) => {
      const isBox = r.category === "Boxing";
      const dur = isBox ? (r.duration_s ?? 180) : 180;
      segs.push({
        id: r.round_id,
        name: r.name,
        duration: dur,
        category: r.category,
        style: r.style || (isBox ? r.name : undefined), // show boxing type label under title
        items: r.items || [],
      });

      const isLast = idx === total - 1;
      // Half-time rest after Boxing round 5
      if (isBox && idx === boxRoundsCount - 1) {
        segs.push({ id: `rest-half-${idx}`, name: "Half-time Rest", duration: 300, category: "Rest" });
      } else if (!isLast) {
        segs.push({ id: `rest-${idx}`, name: "Rest", duration: 60, category: "Rest" });
      }
    });
    return segs;
  }, [ordered, boxRoundsCount]);

  // Runner with haptics
  const [muted, setMuted] = useState(false);
  const {
    index, remaining, running, duration, current, nextRound,
    play, pause, reset, next, prev, totalRounds,
  } = useFollowAlongMachine(timeline, {
    thresholds: [120, 60],
    muted,
    onRoundChange: () => pulseMedium(),
    onMinuteChange: (m) => { if (m > 0) pulseSoft(); },
  });

  const isRest = current?.category === "Rest";
  const sideLabel = current?.category === "Boxing" ? "BOX" : current?.category === "Kettlebell" ? "BELL" : "REST";
  const leftChip = `Segment ${index + 1}/${totalRounds} • ${sideLabel}`;
  const rightChips = [current?.category || "", current?.style || ""].filter(Boolean);

  // minute index 0..floor(duration/60)
  const minuteIndex = Math.max(0, Math.floor(((duration || 180) - remaining) / 60));

  // wake lock while running
  useWakeLock(running);

  // fullscreen toggles (tiny icons above)
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(cardRef);

  // gestures (avoid page scroll)
  const gestureRef = useRef<HTMLDivElement | null>(null);
  useGestureControls(gestureRef, {
    onSwipeLeft: () => next(),
    onSwipeRight: () => prev(),
    onTap: () => (running ? pause() : play()),
    onDoubleTap: () => toggleFullscreen(),
    onLongPress: () => pause(),
  }, { lockScrollOnSwipe: true });

  // Modal state (boxing punch or KB exercise)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalGif, setModalGif] = useState<string | undefined>(undefined);
  const [modalVideo, setModalVideo] = useState<string | undefined>(undefined);

  function openPunchModal(code: string) {
    const label = code;
    setModalTitle(label);
    // map code->tech if available (video; GIF mapping future)
    const vid = techVideoByCode?.[code];
    setModalVideo(vid || undefined);
    setModalGif(undefined);
    setModalOpen(true);
  }
  function openExerciseModal(exId: string) {
    const title =
      exerciseNameById[exId] || exId || "Exercise";
    setModalTitle(title);
    setModalGif(gifByExerciseId?.[exId]);
    setModalVideo(videoByExerciseId?.[exId]);
    setModalOpen(true);
  }

  const containerStyle: React.CSSProperties = {
    overscrollBehavior: "contain",
    touchAction: "pan-y",
    borderRadius: 12,
    paddingBottom: "env(safe-area-inset-bottom)",
  };

  /* ---- Boxing: 1 combo per minute; next up = next combo inside round ---- */
  function BoxingPane() {
    const combos = (current?.items || []).filter((it: any) => !!it.combo);
    const activeCombo = combos.length ? combos[Math.min(minuteIndex, combos.length - 1)].combo : null;
    const nextCombo =
      combos.length && minuteIndex < combos.length - 1 ? combos[minuteIndex + 1].combo : null;

    const activeTitle = activeCombo?.name || current?.name || "Boxing";
    const codesLine = activeCombo?.actions?.length
      ? activeCombo.actions.map((a: BoxingAction) => a.code).join(" • ")
      : "Cycle the 3 combos";

    const nextUp =
      nextCombo?.name
        ? `Next: ${nextCombo.name}`
        : nextRound?.category === "Rest"
        ? `Next: ${nextRound.name}`
        : nextRound
        ? `Next round: ${nextRound.name}`
        : "";

    return (
      <div>
        <div className="mb-1 fw-semibold">{current?.name}</div>
        {/* Boxing-type label below title */}
        {current?.style ? (
          <div className="text-dim mb-2" style={{ fontSize: 12 }}>{current.style}</div>
        ) : null}

        {/* minute dots */}
        <div className="d-flex align-items-center mb-2" style={{ gap: 6 }}>
          {[0, 1, 2].map((m) => (
            <span
              key={m}
              style={{
                width: 10, height: 10, borderRadius: "50%",
                background: m === Math.min(minuteIndex, 2) ? ACCENT : "rgba(255,255,255,0.22)",
                boxShadow: m === Math.min(minuteIndex, 2) ? `0 0 8px ${ACCENT}88` : "none",
              }}
              title={`Minute ${m + 1}`}
            />
          ))}
        </div>

        <ExerciseMedia
          title={activeTitle}
          subtitle={codesLine}
          aspect="16x9"
        />

        {/* Tap a punch → modal */}
        {activeCombo?.actions?.length ? (
          <div className="mt-2">
            <TechniqueChips actions={activeCombo.actions} techVideoByCode={techVideoByCode} onActionClick={openPunchModal} />
          </div>
        ) : null}

        {activeCombo?.notes ? (
          <div className="mt-2 text-dim" style={{ fontSize: 12 }}>{activeCombo.notes}</div>
        ) : null}

        {nextUp ? (
          <div className="mt-3 d-flex align-items-center justify-content-between">
            <div className="text-dim" style={{ fontSize: 12 }}>Next up</div>
            <div className="fw-semibold">{nextUp}</div>
          </div>
        ) : null}
      </div>
    );
  }

  /* ---- Kettlebell: chips for ALL exercises; modal per exercise ---- */
  function KettlebellPane() {
    const items = current?.items || [];

    return (
      <div>
        <div className="mb-1 fw-semibold">{current?.name || "Kettlebell Round"}</div>
        {/* KB style label below title */}
        {current?.style ? (
          <div className="text-dim mb-2" style={{ fontSize: 12 }}>{current.style}</div>
        ) : null}

        <RoundMediaRail
          items={items}
          exerciseNameById={exerciseNameById}
          onOpenMedia={(id) => openExerciseModal(id)}
        />

        {/* Optional: 'Next up' shows next segment (usually rest or next round) */}
        {nextRound ? (
          <div className="mt-3 d-flex align-items-center justify-content-between">
            <div className="text-dim" style={{ fontSize: 12 }}>Next up</div>
            <div className="fw-semibold">{nextRound.name}</div>
          </div>
        ) : null}
      </div>
    );
  }

  /* ---- Rest pane (simple) ---- */
  function RestPane() {
    return (
      <div className="text-center">
        <div className="mb-1 fw-semibold">{current?.name || "Rest"}</div>
        <div className="text-dim" style={{ fontSize: 12 }}>Breathe, shake out, hydrate.</div>
      </div>
    );
  }

  return (
    <section
      ref={cardRef}
      className="futuristic-card p-3 mb-3"
      style={containerStyle}
    >
      {/* Tiny icon row (top-right): sound & fullscreen */}
      <div className="d-flex justify-content-end" style={{ gap: 8, marginTop: -6, marginBottom: 4 }}>
        <button
          className="btn btn-bxkr-outline btn-sm"
          style={{ borderRadius: 999, width: 32, height: 32, padding: 0, lineHeight: 1 }}
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button
          className="btn btn-bxkr-outline btn-sm"
          style={{ borderRadius: 999, width: 32, height: 32, padding: 0, lineHeight: 1 }}
          onClick={() => toggleFullscreen()}
          aria-label="Fullscreen"
          title="Fullscreen"
        >
          ⤢
        </button>
      </div>

      {/* Transport & timer */}
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
        rightChips={[...(isRest ? ["Rest"] : []), ...rightChips]}
      />

      {/* Content – wrapped in gesture area */}
      <div ref={gestureRef} style={{ touchAction: "pan-y" }}>
        {isRest
          ? <RestPane />
          : current?.category === "Boxing"
            ? <BoxingPane />
            : <KettlebellPane />
        }
      </div>

      {/* Media modal (punch or exercise) */}
      <ModalMedia
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        gifUrl={modalGif}
        videoUrl={modalVideo}
      />
    </section>
  );
}
