// File: components/gymworkout/SetGrid.tsx

import React, { useRef } from "react";
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
  movementKeyBase?: string | null;
}) {
  const keyBase = (movementKeyBase || exerciseId || "").trim() || exerciseId;

  const kgRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const repsRefs = useRef<Record<number, HTMLInputElement | null>>({});

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

        const tickKey = `${keyBase}|${setNum}`;
        const tick = Boolean(tickKeys[tickKey]);

        const movementPatch = keyBase && keyBase !== exerciseId ? { movement_key: keyBase } : null;

        return (
          <div key={i} className="gx-row">
            <div className="gx-col-set">{setNum}</div>

            <div className="gx-col-kg">
              <div className="gx-kg-wrap">
                <input
                  ref={(el) => {
                    kgRefs.current[setNum] = el;
                  }}
                  className="gx-input gx-input-kg"
                  type="number"
                  inputMode="decimal"
                  placeholder={targetKg != null ? String(targetKg) : "kg"}
                  defaultValue={prefillWeight != null ? prefillWeight : undefined}
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
                ref={(el) => {
                  repsRefs.current[setNum] = el;
                }}
                className="gx-input gx-input-reps"
                type="number"
                inputMode="numeric"
                placeholder="reps"
                defaultValue={prefillReps != null ? prefillReps : undefined}
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

                  if (nextTick) {
                    const kgEl = kgRefs.current[setNum];
                    const repsEl = repsRefs.current[setNum];

                    const weight = kgEl ? parseNullableNumber(kgEl.value) : null;
                    const reps = repsEl ? parseNullableNumber(repsEl.value) : null;

                    if (weight != null || reps != null || movementPatch) {
                      onUpdateSet(exerciseId, setNum, {
                        weight,
                        reps,
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
                    onClick={() => {
                      const kgEl = kgRefs.current[setNum];
                      if (kgEl) kgEl.value = String(targetKg);

                      onUpdateSet(exerciseId, setNum, {
                        weight: targetKg,
                        ...(movementPatch || {}),
                      });
                    }}
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
