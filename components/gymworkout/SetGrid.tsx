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
  setNumberBase,
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
  setNumberBase?: number | null;
}) {
  const keyBase = (movementKeyBase || exerciseId || "").trim() || exerciseId;

  function getKey(realSetNum: number) {
    return `${keyBase}|${realSetNum}`;
  }

  function getLegacyKey(realSetNum: number) {
    return `${exerciseId}|${realSetNum}`;
  }

  function getRealSetNum(i: number) {
    const localSetNum = i + 1;
    return typeof setNumberBase === "number" && Number.isFinite(setNumberBase) ? setNumberBase + i : localSetNum;
  }

  function hasCurrentForSet(realSetNum: number) {
    const key = getKey(realSetNum);
    const legacyKey = getLegacyKey(realSetNum);
    return (
      Object.prototype.hasOwnProperty.call(currentByKey, key) ||
      Object.prototype.hasOwnProperty.call(currentByKey, legacyKey)
    );
  }

  function getCurrentForSet(realSetNum: number) {
    const key = getKey(realSetNum);
    const legacyKey = getLegacyKey(realSetNum);
    return (
      currentByKey[key] ??
      currentByKey[legacyKey] ??
      { weight: null as number | null, reps: null as number | null }
    );
  }

  const movementPatch = keyBase && keyBase !== exerciseId ? { movement_key: keyBase } : null;

  function getDisplayedForSet(realSetNum: number) {
    const hasCurrent = hasCurrentForSet(realSetNum);
    const current = getCurrentForSet(realSetNum);

    const displayedWeight = hasCurrent ? current.weight : prefillWeight != null ? prefillWeight : null;
    const displayedReps = hasCurrent ? current.reps : prefillReps != null ? prefillReps : null;

    return { hasCurrent, current, displayedWeight, displayedReps };
  }

  function copySet1ToBlanks() {
    if (sets <= 1) return;

    const firstSetNum = getRealSetNum(0);
    const first = getDisplayedForSet(firstSetNum);

    const srcWeight = first.displayedWeight ?? null;
    const srcReps = first.displayedReps ?? null;

    // Nothing meaningful to copy
    if (srcWeight == null && srcReps == null) return;

    // Copy into “blank” sets:
    // - If a set has NO current state row -> considered blank even if it shows prefills (target/prescribed)
    // - If it HAS a current row, only fill if weight/reps are still null (true blank in edit)
    for (let i = 1; i < sets; i++) {
      const realSetNum = getRealSetNum(i);
      const destHasCurrent = hasCurrentForSet(realSetNum);
      const dest = getCurrentForSet(realSetNum);

      const destWeightIsBlank = !destHasCurrent || dest.weight == null;
      const destRepsIsBlank = !destHasCurrent || dest.reps == null;

      // If nothing blank, skip
      if (!destWeightIsBlank && !destRepsIsBlank) continue;

      const patch: Partial<CompletionSet> = {
        ...(movementPatch || {}),
      };

      if (destWeightIsBlank) patch.weight = srcWeight;
      if (destRepsIsBlank) patch.reps = srcReps;

      onUpdateSet(exerciseId, realSetNum, patch);
    }
  }

  return (
    <div className="gx-grid">
      <div className="gx-grid-head">
        <div className="gx-col-set">SET</div>
        <div className="gx-col-kg">KG</div>
        <div className="gx-col-reps">REPS</div>
        <div className="gx-col-tick">✓</div>
      </div>

      {Array.from({ length: sets }).map((_, i) => {
        const realSetNum = getRealSetNum(i);

        const key = getKey(realSetNum);
        const legacyKey = getLegacyKey(realSetNum);

        const prev = prevByKey[key] ?? prevByKey[legacyKey];

        const { hasCurrent, displayedWeight, displayedReps } = getDisplayedForSet(realSetNum);

        const weightValue = displayedWeight != null ? String(displayedWeight) : "";
        const repsValue = displayedReps != null ? String(displayedReps) : "";

        const tick = Boolean(tickKeys[key]);

        return (
          <div key={i} className="gx-row">
            <div className="gx-col-set">{realSetNum}</div>

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

                    // If user edits weight first and the set doesn't exist yet,
                    // seed reps so reps doesn't snap back / feel locked.
                    const seedReps = !hasCurrent ? (prefillReps ?? null) : undefined;

                    onUpdateSet(exerciseId, realSetNum, {
                      weight,
                      ...(seedReps !== undefined ? { reps: seedReps } : {}),
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

                  // If user edits reps first and the set doesn't exist yet,
                  // seed weight so KG doesn't drop to blank/0.
                  const seedWeight = !hasCurrent
                    ? prefillWeight != null
                      ? prefillWeight
                      : targetKg != null
                      ? targetKg
                      : null
                    : undefined;

                  onUpdateSet(exerciseId, realSetNum, {
                    reps,
                    ...(seedWeight !== undefined ? { weight: seedWeight } : {}),
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
                  onToggleTick(keyBase, realSetNum);

                  if (nextTick) {
                    onUpdateSet(exerciseId, realSetNum, {
                      weight: displayedWeight ?? null,
                      reps: displayedReps ?? null,
                      ...(movementPatch || {}),
                    });
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

                <div style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                  {showUseTarget && targetKg != null ? (
                    <button
                      type="button"
                      className="gx-use"
                      onClick={() =>
                        onUpdateSet(exerciseId, realSetNum, {
                          weight: targetKg,
                          ...(movementPatch || {}),
                        })
                      }
                    >
                      Use target
                    </button>
                  ) : null}

                  {/* ✅ Copy Set 1 -> fill blanks (but treat “prefilled only” as blank, and don’t overwrite edited values) */}
                  {i === 0 && sets > 1 ? (
                    <button type="button" className="gx-use" onClick={copySet1ToBlanks} title="Copy set 1 into blank sets">
                      Copy down
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
