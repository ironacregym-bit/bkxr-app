
// components/workouts/TimerControls.tsx
"use client";

/**
 * Shared transport + time readout + progress bar.
 * Leave container styling to the parent; this renders the controls & timer block.
 */

export default function TimerControls({
  running,
  remaining,
  duration,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onReset,
  leftChip,   // e.g. "Round 3/10 • BOX"
  rightChips, // e.g. ["Boxing","EMOM"]
}: {
  running: boolean;
  remaining: number; // seconds
  duration: number;  // seconds
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  leftChip?: string;
  rightChips?: string[];
}) {
  const ACCENT = "#FF8A2A";
  const pct = Math.max(0, Math.min(1, (duration - remaining) / Math.max(1, duration)));

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(Math.max(remaining % 60, 0)).padStart(2, "0");

  return (
    <div>
      {/* Top row: chips + transport */}
      <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
        <div className="d-flex align-items-center" style={{ gap: 10 }}>
          {leftChip ? (
            <span style={{ letterSpacing: ".06em", color: "#9fb3c8" }}>{leftChip}</span>
          ) : null}
          {rightChips?.map((txt, i) => (
            <span
              key={`${txt}-${i}`}
              className="badge bg-transparent"
              style={{ border: "1px solid rgba(255,255,255,0.18)", color: "#cfd7df" }}
            >
              {txt}
            </span>
          ))}
        </div>

        <div className="d-flex" style={{ gap: 8 }}>
          <button className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }} onClick={onPrev}>
            ← Prev
          </button>
          {running ? (
            <button className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }} onClick={onPause}>
              Pause
            </button>
          ) : (
            <button
              className="btn btn-sm"
              onClick={onPlay}
              style={{
                borderRadius: 24,
                color: "#fff",
                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                boxShadow: `0 0 14px ${ACCENT}66`,
                border: "none",
                paddingInline: 14,
              }}
            >
              Play
            </button>
          )}
          <button className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }} onClick={onNext}>
            Next →
          </button>
          <button className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }} onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      {/* Timer + progress */}
      <div className="mb-2">
        <div style={{ fontSize: 36, fontWeight: 800 }}>
          {mm}:{ss}
        </div>
        <div className="capacity mt-1" aria-label="Round progress">
          <div className="bar" style={{ background: "rgba(255,255,255,0.06)" }}>
            <span
              style={{
                width: `${Math.round(pct * 100)}%`,
                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                boxShadow: `0 0 10px ${ACCENT}55`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
