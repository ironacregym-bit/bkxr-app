"use client";

import { useMemo, useRef, useState } from "react";
import TimerControls from "./TimerControls";
import RoundMediaRail from "./RoundMediaRail";
import TechniqueChips, { BoxingAction } from "./TechniqueChips";
import ModalMedia from "./ModalMedia";
import KbCompositeMedia from "./KbCompositeMedia";
import { useFollowAlongMachine, TimelineRound } from "../../hooks/useFollowAlongMachine";
import useGestureControls from "../../hooks/useGestureControls";
import useWakeLock from "../../hooks/useWakeLock";
import useFullscreen from "../../hooks/useFullscreen";
import { pulseSoft, pulseMedium } from "../../hooks/useHaptics";
import KbRoundTracker from "./KbRoundTracker";
import { KbTrackingController } from "../../components/hooks/useKbTracking";

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
  style?: KBStyle;
  duration_s?: number;
  items: ExerciseItemOut[];
};

const ACCENT = "#FF8A2A";

// Fix for Firestore gif_url containing "public/"
function fixGifUrl(u?: string) {
  if (!u) return u;
  if (u.startsWith("public/")) return "/" + u.replace(/^public\//, "");
  return u;
}

export default function FollowAlongViewer({
  rounds,
  exerciseNameById,
  videoByExerciseId,
  gifByExerciseId,
  techVideoByCode,
  boxRoundsCount = 5,
  kbController,
}: {
  rounds: RoundOut[];
  exerciseNameById: Record<string, string>;
  videoByExerciseId?: Record<string, string | undefined>;
  gifByExerciseId?: Record<string, string | undefined>;
  techVideoByCode?: Record<string, string | undefined>;
  boxRoundsCount?: number;
  kbController: KbTrackingController;
}) {
  // Sorted by order
  const ordered = useMemo(
    () => rounds.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [rounds]
  );

  // Build timeline: add 1:00 rest after each round; 5:00 half-time after boxing 5
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
        style: r.style,
        items: r.items || [],
      });

      const isLast = idx === total - 1;
      if (isBox && idx === boxRoundsCount - 1) {
        segs.push({ id: `rest-half-${idx}`, name: "Half-time Rest", duration: 300, category: "Rest" });
      } else if (!isLast) {
        segs.push({ id: `rest-${idx}`, name: "Rest", duration: 60, category: "Rest" });
      }
    });
    return segs;
  }, [ordered, boxRoundsCount]);

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
  const side = current?.category === "Boxing" ? "BOX" : current?.category === "Kettlebell" ? "BELL" : "REST";
  const leftChip = `Segment ${index + 1}/${totalRounds} • ${side}`;
  const rightChips = [current?.category || "", current?.style || ""].filter(Boolean);

  // 0..n minute index
  const minuteIndex = Math.max(0, Math.floor(((duration || 180) - remaining) / 60));

  // Keep screen on while running
  useWakeLock(running);

  // Fullscreen (tiny icon above)
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { toggle: toggleFullscreen } = useFullscreen(cardRef);

  // Gesture strip
  const stripRef = useRef<HTMLDivElement | null>(null);
  useGestureControls(
    stripRef,
    {
      onSwipeLeft: () => next(),
      onSwipeRight: () => prev(),
      onTap: () => (running ? pause() : play()),
      onDoubleTap: () => toggleFullscreen(),
      onLongPress: () => pause(),
    },
    { lockScrollOnSwipe: true }
  );

  // Modal (punch or exercise)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalGif, setModalGif] = useState<string | undefined>(undefined);
  const [modalVideo, setModalVideo] = useState<string | undefined>(undefined);

  const openPunchModal = (code: string) => {
    setModalTitle(code);
    setModalGif(undefined);
    setModalVideo(techVideoByCode?.[code]);
    setModalOpen(true);
  };
  const openExerciseModal = (id: string) => {
    const title = exerciseNameById[id] || id;
    setModalTitle(title);
    setModalGif(fixGifUrl(gifByExerciseId?.[id]));
    setModalVideo(videoByExerciseId?.[id]);
    setModalOpen(true);
  };

  const containerStyle: React.CSSProperties = {
    overscrollBehavior: "contain",
    touchAction: "pan-y",
    borderRadius: 12,
    paddingBottom: "env(safe-area-inset-bottom)",
  };

  /* ---------------- Boxing content ---------------- */
  function BoxingPane() {
    const combos = (current?.items || []).filter((it: any) => !!it.combo);
    const activeCombo = combos.length ? combos[Math.min(minuteIndex, combos.length - 1)].combo : null;
    const nextCombo =
      combos.length && minuteIndex < combos.length - 1 ? combos[minuteIndex + 1].combo : null;

    const title = activeCombo?.name || current?.name || "Boxing";
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
        <div className="fw-semibold">{current?.name}</div>
        {current?.style ? (
          <div className="text-dim mb-2" style={{ fontSize: 12 }}>{current.style}</div>
        ) : null}

        {/* Minute dots */}
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

        {/* Simple media card */}
        <div className="futuristic-card p-2" style={{ overflow: "hidden" }}>
          <div className="ratio ratio-16x9" style={{ borderRadius: 12, overflow: "hidden" }}>
            <div className="d-flex align-items-center justify-content-center text-center px-3">
              <div>
                <div className="fw-bold">{title}</div>
                <div className="text-dim" style={{ fontSize: 12 }}>{codesLine}</div>
              </div>
            </div>
          </div>
        </div>

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

  /* ---------------- Kettlebell content ---------------- */
  function KettlebellPane() {
    const items = current?.items || [];

    // KB index within KB rounds
    const kbIndex = useMemo(() => {
      const idxInAll = ordered.findIndex(r => r.round_id === (current as any)?.id);
      if (idxInAll < 0) {
        const byName = ordered.findIndex(r => r.name === current?.name && r.category === "Kettlebell");
        if (byName >= 0) {
          const nthKb = ordered.slice(0, byName + 1).filter(r => r.category === "Kettlebell").length - 1;
          return Math.max(0, nthKb);
        }
        return 0;
      }
      const nthKb = ordered.slice(0, idxInAll + 1).filter(r => r.category === "Kettlebell").length - 1;
      return Math.max(0, nthKb);
    }, [ordered, current]);

    const row = kbController.state.rounds[kbIndex];
    const minuteReps = (row?.emom?.minuteReps as [number, number, number]) || [0, 0, 0];

    // Fix GIF URLs for the composite grid
    const fixedGifById = useMemo(() => {
      const out: Record<string, string | undefined> = {};
      Object.keys(gifByExerciseId || {}).forEach((k) => (out[k] = fixGifUrl(gifByExerciseId?.[k])));
      return out;
    }, [gifByExerciseId]);

    return (
      <div>
        <div className="fw-semibold">{current?.name || "Kettlebell Round"}</div>
        {current?.style ? (
          <div className="d-flex align-items-center justify-content-end mb-2">
            <span
              className="badge bg-transparent"
              style={{ border: "1px solid rgba(255,255,255,0.18)", color: "#cfd7df" }}
              title={
                current.style === "EMOM"
                  ? "Every Minute On the Minute: Do the work at each minute, rest the remainder."
                  : current.style === "AMRAP"
                  ? "As Many Rounds/Reps As Possible: Cycle movements steadily for the duration."
                  : current.style === "LADDER"
                  ? "Ladder: Alternate movements while increasing reps smoothly."
                  : current.style
              }
            >
              {current.style}
            </span>
          </div>
        ) : null}

        {/* Composite grid of all exercise GIFs */}
        <KbCompositeMedia
          items={items}
          gifByExerciseId={fixedGifById}
          exerciseNameById={exerciseNameById}
          aspect="16x9"
        />

        {/* Tracker (expanded on active round, responsive) */}
        <KbRoundTracker
          styleType={current?.style as KBStyle | undefined}
          compact={false}
          activeMinute={minuteIndex}
          rounds={row?.completedRounds ?? 0}
          onRoundsChange={(v) => kbController.setRounds(kbIndex, v)}
          onIncRounds={(d) => kbController.incRounds(kbIndex, d)}
          minuteReps={minuteReps}
          onMinuteChange={(m, v) => kbController.setEmomMinute(kbIndex, m, v)}
          onMinuteInc={(m, d) => kbController.incEmomMinute(kbIndex, m, d)}
        />

        {/* Chips for all exercises (tap -> modal) */}
        <RoundMediaRail
          items={items}
          exerciseNameById={exerciseNameById}
          onOpenMedia={openExerciseModal}
        />

        {nextRound ? (
          <div className="mt-3 d-flex align-items-center justify-content-between">
            <div className="text-dim" style={{ fontSize: 12 }}>Next up</div>
            <div className="fw-semibold">{nextRound.name}</div>
          </div>
        ) : null}
      </div>
    );
  }

  /* ---------------- Rest content ---------------- */
  function RestPane() {
    return (
      <div className="text-center">
        <div className="fw-semibold">{current?.name || "Rest"}</div>
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
      {/* Tiny icons (top-right) */}
      <div className="d-flex justify-content-end" style={{ gap: 8, marginTop: -6, marginBottom: 4 }}>
        <button
          className="btn btn-bxkr-outline btn-sm"
          style={{ borderRadius: 999, width: 32, height: 32, padding: 0, lineHeight: 1 }}
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
          title={muted ? "Unmute" : "Mute"}
        >
          <i className={`fas ${muted ? "fa-volume-xmark" : "fa-volume-high"}`} />
        </button>
        <button
          className="btn btn-bxkr-outline btn-sm"
          style={{ borderRadius: 999, width: 32, height: 32, padding: 0, lineHeight: 1 }}
          onClick={() => toggleFullscreen()}
          aria-label="Fullscreen"
          title="Fullscreen"
        >
          <i className="fas fa-maximize" />
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

      {/* Content */}
      <div style={{ touchAction: "pan-y" }}>
        {isRest
          ? <RestPane />
          : current?.category === "Boxing"
          ? <BoxingPane />
          : <KettlebellPane />
        }
      </div>

      {/* Swipe strip */}
      <div
        ref={stripRef}
        className="mt-2 d-flex align-items-center justify-content-center"
        style={{
          userSelect: "none",
          touchAction: "none",
          border: "1px dashed rgba(255,255,255,0.2)",
          borderRadius: 999,
          fontSize: 12,
          color: "#cfd7df",
          padding: "6px 10px",
        }}
        title="Swipe here to change"
      >
        <i className="fas fa-arrows-left-right" /> <span className="ms-2">Swipe here</span>
      </div>

      {/* Media modal */}
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
