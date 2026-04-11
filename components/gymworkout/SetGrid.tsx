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
    <div className="gx-grid">
      <div className="gx-grid-head">
        <div className="gx-col-set">SET</div>
        <div className="gx-col-kg">KG</div>
        <div className="gx-col-reps">REPS</div>
        <div className="gx-col-tick">✓</div>
      </div>

      {Array.from({ length: sets }).map((_, i) => {
        const setNum = i + 1;
        const prev = prevByKey[`${exerciseId}|${setNum}`];
        const tick = Boolean(tickKeys[`${exerciseId}|${setNum}`]);

        return (
          <div key={i} className="gx-row">
            <div className="gx-col-set">{setNum}</div>

            <div className="gx-col-kg">
              <div className="gx-kg-wrap">
                <input
                  className="gx-input gx-input-kg"
                  type="number"
                  inputMode="decimal"
                  placeholder={targetKg != null ? String(targetKg) : "kg"}
                  onChange={(e) =>
                    onUpdateSet(exerciseId, setNum, { weight: Number(e.target.value) || null })
                  }
                />
                {targetKg != null && showUseTarget && <span className="gx-dot" aria-hidden="true" />}
              </div>
            </div>

            <div className="gx-col-reps">
              <input
                className="gx-input gx-input-reps"
                type="number"
                inputMode="numeric"
                placeholder="reps"
                onChange={(e) =>
                  onUpdateSet(exerciseId, setNum, { reps: Number(e.target.value) || null })
                }
              />
            </div>

            <div className="gx-col-tick">
              <button
                type="button"
                className="gx-tick"
                style={{
                  borderColor: `${GREEN}88`,
                  color: tick ? "#0b0f14" : GREEN,
                  background: tick ? GREEN : "transparent",
                }}
                onClick={() => onToggleTick(exerciseId, setNum)}
                aria-label={tick ? "Unmark set" : "Mark set"}
              >
                <i className="fas fa-check" />
              </button>
            </div>

            <div className="gx-prev">
              Prev: {prev?.weight ?? "-"}kg × {prev?.reps ?? "-"}
              {showUseTarget && targetKg != null ? (
                <button
                  type="button"
                  className="gx-use"
                  onClick={() => onUpdateSet(exerciseId, setNum, { weight: targetKg })}
                >
                  Use target
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
