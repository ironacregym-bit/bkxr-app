"use client";

import React from "react";
import { KBStyle } from "../..//components/hooks/useKbTracking";

const ACCENT = "#FF8A2A";

type Props = {
  styleType?: KBStyle;
  // AMRAP/LADDER
  rounds?: number;
  onRoundsChange?: (next: number) => void;
  onIncRounds?: (delta: number) => void;

  // EMOM
  minuteReps?: [number, number, number];
  onMinuteChange?: (minuteIndex: number, value: number) => void;
  onMinuteInc?: (minuteIndex: number, delta: number) => void;

  // Styling/behaviour
  compact?: boolean;         // List view = compact; Follow-along active = expanded
  activeMinute?: number;     // 0..2 highlight
};

export default function KbRoundTracker({
  styleType,
  rounds = 0,
  onRoundsChange,
  onIncRounds,
  minuteReps = [0, 0, 0],
  onMinuteChange,
  onMinuteInc,
  compact = false,
  activeMinute = -1,
}: Props) {
  if (styleType === "EMOM") {
    // EMOM tracker: 3 minute cells, each with +1 / +3 and input
    return (
      <div
        className="mt-2"
        style={{
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          padding: compact ? 6 : 10,
        }}
      >
        <div className="d-flex align-items-center justify-content-between" style={{ gap: 8 }}>
          {[0, 1, 2].map((m) => {
            const val = minuteReps[m] ?? 0;
            const hl = m === activeMinute;
            return (
              <div
                key={m}
                className="flex-fill"
                style={{
                  border: `1px solid ${hl ? `${ACCENT}88` : "rgba(255,255,255,0.14)"}`,
                  borderRadius: 10,
                  padding: compact ? "6px 8px" : "8px 10px",
                  boxShadow: hl ? `0 0 10px ${ACCENT}55 inset` : undefined,
                }}
                title={`Minute ${m + 1} reps`}
              >
                <div className="d-flex align-items-center justify-content-between" style={{ gap: 6 }}>
                  <small className="text-dim">min {m + 1}</small>
                  <div className="d-flex align-items-center" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-bxkr-outline btn-sm"
                      style={{ borderRadius: 999, padding: "2px 8px" }}
                      onClick={(e) => { e.stopPropagation(); onMinuteInc?.(m, -1); }}
                      aria-label={`Minus 1 rep minute ${m + 1}`}
                    >
                      −1
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="form-control"
                      value={val}
                      onChange={(e) => onMinuteChange?.(m, Math.max(0, Number(e.target.value || 0)))}
                      style={{ width: compact ? 60 : 72, textAlign: "center", paddingBlock: compact ? 2 : 4 }}
                      aria-label={`Reps minute ${m + 1}`}
                    />
                    <button
                      type="button"
                      className="btn btn-bxkr-outline btn-sm"
                      style={{ borderRadius: 999, padding: "2px 8px" }}
                      onClick={(e) => { e.stopPropagation(); onMinuteInc?.(m, +1); }}
                      aria-label={`Plus 1 rep minute ${m + 1}`}
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      className="btn btn-bxkr-outline btn-sm"
                      style={{ borderRadius: 999, padding: "2px 8px" }}
                      onClick={(e) => { e.stopPropagation(); onMinuteInc?.(m, +3); }}
                      aria-label={`Plus 3 reps minute ${m + 1}`}
                      title="Quick add +3"
                    >
                      +3
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // AMRAP / LADDER tracker: rounds counter
  return (
    <div
      className="mt-2 d-flex align-items-center justify-content-between"
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
        padding: compact ? 6 : 10,
        gap: 10,
      }}
    >
      <div className="text-dim" style={{ fontSize: 12 }}>
        Rounds completed
      </div>
      <div className="d-flex align-items-center" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn btn-bxkr-outline btn-sm"
          style={{ borderRadius: 999, paddingInline: 10 }}
          onClick={(e) => { e.stopPropagation(); onIncRounds?.(-1); }}
          aria-label="Decrease rounds"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          className="form-control"
          value={rounds}
          onChange={(e) => onRoundsChange?.(Math.max(0, Number(e.target.value || 0)))}
          style={{ width: compact ? 66 : 80, textAlign: "center" }}
          aria-label="Rounds completed"
        />
        <button
          type="button"
          className="btn btn-bxkr-outline btn-sm"
          style={{ borderRadius: 999, paddingInline: 10 }}
          onClick={(e) => { e.stopPropagation(); onIncRounds?.(+1); }}
          aria-label="Increase rounds"
        >
          +
        </button>
      </div>
    </div>
  );
}
