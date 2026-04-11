import React from "react";
import type { CompletionSet } from "./types";
import { GREEN } from "./utils";

export default function SetGrid({
  exerciseId,
  sets,
  prevByKey,
  targetKg,
  onUpdateSet,
  tickKeys,
  onToggleTick,
  showUseTarget,
}: {
  exerciseId: string;
  sets: number;
  prevByKey: Record<string, { weight: number | null; reps: number | null }>;
  targetKg: number | null;
  onUpdateSet: (exercise_id: string, set: number, patch: Partial<CompletionSet>) => void;
  tickKeys: Record<string, boolean>;
  onToggleTick: (exercise_id: string, set: number) => void;
  showUseTarget: boolean;
}) {
  return (
    <div className="d-flex flex-column" style={{ gap: 8 }}>
      <div className="d-flex align-items-center text-dim small" style={{ paddingLeft: 8, paddingRight: 8 }}>
        <div style={{ width: 46, textAlign: "right" }}>SET</div>
        <div style={{ width: 12 }} />
        <div style={{ width: "var(--kgw)" }}>KG</div>
        <div style={{ width: 12 }} />
        <div style={{ width: "var(--repsw)" }}>REPS</div>
        <div className="ms-auto" style={{ width: 44, textAlign: "center" }}>✓</div>
      </div>

      {Array.from({ length: sets }).map((_, i) => {
        const setNum = i + 1;
        const prev = prevByKey[`${exerciseId}|${setNum}`];
        const tick = Boolean(tickKeys[`${exerciseId}|${setNum}`]);

        return (
          <div
            key={i}
            className="d-flex align-items-center flex-wrap"
            style={{
              gap: 10,
              background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 14,
              padding: 10,
            }}
          >
            <div className="text-dim small" style={{ width: 46, textAlign: "right", flex: "0 0 auto" }}>
              {setNum}
            </div>

            <input
              className="form-control"
              type="number"
              inputMode="decimal"
              placeholder={targetKg != null ? String(targetKg) : "kg"}
              onChange={(e) => onUpdateSet(exerciseId, setNum, { weight: Number(e.target.value) || null })}
              style={{ width: "var(--kgw)", fontSize: "0.95rem", flex: "0 0 auto", borderRadius: 12 }}
            />

            <input
              className="form-control"
              type="number"
              inputMode="numeric"
              placeholder="reps"
              onChange={(e) => onUpdateSet(exerciseId, setNum, { reps: Number(e.target.value) || null })}
              style={{ width: "var(--repsw)", fontSize: "0.95rem", flex: "0 0 auto", borderRadius: 12 }}
            />

            {showUseTarget && targetKg != null && (
              <button
                type="button"
                className="btn btn-sm btn-outline-light"
                style={{ borderRadius: 12, paddingLeft: 10, paddingRight: 10 }}
                onClick={() => onUpdateSet(exerciseId, setNum, { weight: targetKg })}
              >
                Use target
              </button>
            )}

            <div className="small text-dim ms-auto" style={{ minWidth: 160 }}>
              Prev: {prev?.weight ?? "-"}kg × {prev?.reps ?? "-"}
            </div>

            <button
              type="button"
              className="btn btn-sm"
              style={{
                borderRadius: 999,
                border: `1px solid ${GREEN}66`,
                color: tick ? "#0b0f14" : GREEN,
                background: tick ? GREEN : "transparent",
                width: 40,
                height: 40,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => onToggleTick(exerciseId, setNum)}
            >
              <i className="fas fa-check" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
