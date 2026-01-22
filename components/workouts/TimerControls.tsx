
// components/workouts/TimerControls.tsx
"use client";

export default function TimerControls({
  running,
  remaining,
  duration,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onReset,
  leftChip,
  rightChips,
}: {
  running: boolean;
  remaining: number;
  duration: number;
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

  const outlineBtn: React.CSSProperties = {
    borderRadius: 24,
    border: `1px solid ${ACCENT}88`,
    color: ACCENT,
    background: "transparent",
    padding: "6px 12px",
    lineHeight: 1,
  };
  const playBtn: React.CSSProperties = {
    borderRadius: 24,
    color: "#fff",
    background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
    boxShadow: `0 0 14px ${ACCENT}66`,
    border: "none",
    padding: "6px 16px",
    lineHeight: 1,
  };

  return (
    <div>
      {/* Chips row */}
      <div className="d-flex align-items-center justify-content-between mb-1" style={{ gap: 8 }}>
        <div className="d-flex align-items-center" style={{ gap: 10 }}>
          {leftChip ? <span style={{ letterSpacing: ".06em", color: "#9fb3c8" }}>{leftChip}</span> : null}
        </div>
        <div className="d-flex" style={{ gap: 6 }}>
          {rightChips?.map((txt, i) => (
            <span
              key={`${txt}-${i}`}
              className="badge bg-transparent"
              style={{ border: "1px solid rgba(255,255,255,0.18)", color: "#cfd7df" }}
              title={txt}
            >
              {txt}
            </span>
          ))}
        </div>
      </div>

      {/* Transport row (icon-only) */}
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex" style={{ gap: 6 }}>
          <button className="btn btn-sm" style={outlineBtn} onClick={onPrev} aria-label="Previous">
            <i className="fas fa-chevron-left" />
          </button>
          {running ? (
            <button className="btn btn-sm" style={outlineBtn} onClick={onPause} aria-label="Pause">
              <i className="fas fa-pause" />
            </button>
          ) : (
            <button className="btn btn-sm" style={playBtn} onClick={onPlay} aria-label="Play">
              <i className="fas fa-play" />
            </button>
          )}
          <button className="btn btn-sm" style={outlineBtn} onClick={onNext} aria-label="Next">
            <i className="fas fa-chevron-right" />
          </button>
        </div>

        <button className="btn btn-sm" style={outlineBtn} onClick={onReset} aria-label="Reset">
          <i className="fas fa-rotate-right" />
        </button>
      </div>

      {/* Timer bar */}
      <div className="mt-1">
        <div style={{ fontSize: 34, fontWeight: 800 }}>
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
