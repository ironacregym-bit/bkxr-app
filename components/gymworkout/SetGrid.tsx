// File: components/gymworkout/SetGrid.tsx

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
  prefillReps,
  prefillWeight,
  showPrevRow = true,
  movementKeyBase,
}: {
  exerciseId: string;
  sets: number;
  prevByKey: Record<string, { weight: number | null; reps: number | null }>;
  targetKg: number | null;
  onUpdateSet: (exercise_id: string, set: number, patch: Partial<CompletionSet>) => void;
  tickKeys: Record<string, boolean>;
  onToggleTick: (exercise_id: string, set: number) => void;
  showUseTarget: boolean;
  prefillReps?: number | null;
  prefillWeight?: number | null;
  showPrevRow?: boolean;

  // ✅ New (optional): used for Prev matching when the same exercise appears multiple times at different % exposures
  // If not provided, falls back to exerciseId.
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

        // Prefer exposure-aware key, fall back to legacy key so older data still works
        const prev =
          prevByKey[`${keyBase}|${setNum}`] ?? prevByKey[`${exerciseId}|${setNum}`];

        // Tick remains keyed by exerciseId to avoid breaking existing tick state
        const tick = Boolean(tickKeys[`${exerciseId}|${setNum}`]);

        const movementPatch =
          keyBase && keyBase !== exerciseId ? { movement_key: keyBase } : null;

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
                  defaultValue={prefillWeight != null ? prefillWeight : undefined}
                  onChange={(e) => {
                    const weight = Number(e.target.value) || null;
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
                defaultValue={prefillReps != null ? prefillReps : undefined}
                onChange={(e) => {
                  const reps = Number(e.target.value) || null;
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
                onClick={() => onToggleTick(exerciseId, setNum)}
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
