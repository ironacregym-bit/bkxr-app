// File: components/gymworkout/SetGrid.tsx

import React from "react";
import type { CompletionSet } from "./types";
import { GREEN } from "./utils";

function parseNullableNumber(raw: string): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function SetGrid({
  exerciseId,
  sets,
  prevByKey,
  currentByKey,
  targetKg,
  onUpdateSet,
  tickKeys,
  onToggleTick,
  showUseTarget,
  prefillReps,
  prefillWeight,
  showPrevRow = true,
  movementKeyBase,
}: {
  exerciseId: string;
  sets: number;
  prevByKey: Record<string, { weight: number | null; reps: number | null }>;
  currentByKey: Record<string, { weight: number | null; reps: number | null }>;
  targetKg: number | null;
  onUpdateSet: (exercise_id: string, set: number, patch: Partial<CompletionSet>) => void;
  tickKeys: Record<string, boolean>;
  onToggleTick: (exercise_id: string, set: number) => void;
  showUseTarget: boolean;
  prefillReps?: number | null;
  prefillWeight?: number | null;
  showPrevRow?: boolean;
  movementKeyBase?: string | null;
}) {
  const keyBase = (movementKeyBase || exerciseId || "").trim() || exerciseId;

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

        const prev = prevByKey[`${keyBase}|${setNum}`] ?? prevByKey[`${exerciseId}|${setNum}`];

        const current =
          currentByKey[`${keyBase}|${setNum}`] ?? currentByKey[`${exerciseId}|${setNum}`] ?? { weight: null, reps: null };

        const movementPatch = keyBase && keyBase !== exerciseId ? { movement_key: keyBase } : null;

        const displayedWeight =
          current.weight != null ? current.weight : prefillWeight != null ? prefillWeight : null;

        const displayedReps =
          current.reps != null ? current.reps : prefillReps != null ? prefillReps : null;

        const weightValue = displayedWeight != null ? String(displayedWeight) : "";
        const repsValue = displayedReps != null ? String(displayedReps) : "";

        const tickKey = `${keyBase}|${setNum}`;
        const tick = Boolean(tickKeys[tickKey]);

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
                  value={weightValue}
                  onChange={(e) => {
                    const weight = parseNullableNumber(e.target.value);
                    onUpdateSet(exerciseId, setNum, {
                      weight,
                      ...(movementPatch || {}),
                    });
                  }}
                />
                {targetKg != null && showUseTarget ? <span className="gx-dot" aria-hidden="true" /> : null}
              </div>
            </div>

            <div className="gx-col-reps">
              <input
                className="gx-input gx-input-reps"
                type="number"
                inputMode="numeric"
                placeholder="reps"
                value={repsValue}
                onChange={(e) => {
                  const reps = parseNullableNumber(e.target.value);
                  onUpdateSet(exerciseId, setNum, {
                    reps,
                    ...(movementPatch || {}),
                  });
                }}
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
                onClick={() => {
                  const nextTick = !tick;
                  onToggleTick(keyBase, setNum);

                  // When ticking on, commit whatever is currently displayed so it goes into formSets
                  if (nextTick) {
                    if (displayedWeight != null || displayedReps != null || movementPatch) {
                      onUpdateSet(exerciseId, setNum, {
                        weight: displayedWeight,
                        reps: displayedReps,
                        ...(movementPatch || {}),
                      });
                    }
                  }
                }}
                aria-label={tick ? "Unmark set" : "Mark set"}
              >
                <i className="fas fa-check" />
              </button>
            </div>

            {showPrevRow ? (
              <div className="gx-prev">
                <span>
                  Prev: {prev?.weight ?? "-"}kg × {prev?.reps ?? "-"}
                </span>

                {showUseTarget && targetKg != null ? (
                  <button
                    type="button"
                    className="gx-use"
                    onClick={() =>
                      onUpdateSet(exerciseId, setNum, {
                        weight: targetKg,
                        ...(movementPatch || {}),
                      })
                    }
                  >
                    Use target
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
