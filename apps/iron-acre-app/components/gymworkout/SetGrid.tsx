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
  const movementPatch = keyBase && keyBase !== exerciseId ? { movement_key: keyBase } : null;

  function getRealSetNum(i: number) {
    const localSetNum = i + 1;
    return typeof setNumberBase === "number" && Number.isFinite(setNumberBase) ? setNumberBase + i : localSetNum;
  }

  function getKey(realSetNum: number) {
    return `${keyBase}|${realSetNum}`;
  }

  function getLegacyKey(realSetNum: number) {
    return `${exerciseId}|${realSetNum}`;
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

  function getDisplayedForSet(realSetNum: number) {
    const hasCurrent = hasCurrentForSet(realSetNum);
    const current = getCurrentForSet(realSetNum);

    const displayedWeight = hasCurrent ? current.weight : prefillWeight != null ? prefillWeight : null;
    const displayedReps = hasCurrent ? current.reps : prefillReps != null ? prefillReps : null;

    return { hasCurrent, current, displayedWeight, displayedReps };
  }

  function copyFromSetToSet(srcSetNum: number, destSetNum: number) {
    const src = getDisplayedForSet(srcSetNum);
    const srcWeight = src.displayedWeight ?? null;
    const srcReps = src.displayedReps ?? null;

    if (srcWeight == null && srcReps == null) return;

    const destHasCurrent = hasCurrentForSet(destSetNum);
    const dest = getCurrentForSet(destSetNum);

    // Fill blanks only:
    // - If dest has NO current state row => treat as blank (even if it shows prefills)
    // - If dest HAS current row => only fill fields that are null
    const destWeightBlank = !destHasCurrent || dest.weight == null;
    const destRepsBlank = !destHasCurrent || dest.reps == null;

    if (!destWeightBlank && !destRepsBlank) return;

    const patch: Partial<CompletionSet> = { ...(movementPatch || {}) };
    if (destWeightBlank) patch.weight = srcWeight;
    if (destRepsBlank) patch.reps = srcReps;

    onUpdateSet(exerciseId, destSetNum, patch);
  }

  function copySet1ToAllBlanks() {
    if (sets <= 1) return;
    const srcSetNum = getRealSetNum(0);
    for (let i = 1; i < sets; i++) {
      const destSetNum = getRealSetNum(i);
      copyFromSetToSet(srcSetNum, destSetNum);
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

              {/* ✅ Copy from above (works even when Prev row is hidden elsewhere) */}
              {i > 0 ? (
                <button
                  type="button"
                  className="gx-use"
                  style={{ marginTop: 8 }}
                  onClick={() => copyFromSetToSet(getRealSetNum(i - 1), realSetNum)}
                  title="Copy from previous set (fill blanks only)"
                >
                  Copy
                </button>
              ) : null}
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

                  {/* ✅ Copy Set 1 to all other sets (fill blanks only, prefills count as blank) */}
                  {i === 0 && sets > 1 ? (
                    <button
                      type="button"
                      className="gx-use"
                      onClick={copySet1ToAllBlanks}
                      title="Copy Set 1 into all other sets (fill blanks only)"
                    >
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
