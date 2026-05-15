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

  return (
    <div className="gx-grid">
      <div className="gx-grid-head">
        <div className="gx-col-set">SET</div>
        <div className="gx-col-kg">KG</div>
        <div className="gx-col-reps">REPS</div>
        <div className="gx-col-tick">✓</div>
      </div>

      {Array.from({ length: sets }).map((_, i) => {
        const localSetNum = i + 1;

        const realSetNum =
          typeof setNumberBase === "number" && Number.isFinite(setNumberBase)
            ? setNumberBase + i
            : localSetNum;

        const key = getKey(realSetNum);
        const legacyKey = getLegacyKey(realSetNum);

        const prev = prevByKey[key] ?? prevByKey[legacyKey];

        const hasCurrent = Object.prototype.hasOwnProperty.call(currentByKey, key) ||
          Object.prototype.hasOwnProperty.call(currentByKey, legacyKey);

        const current =
          currentByKey[key] ??
          currentByKey[legacyKey] ??
          { weight: null, reps: null };

        const movementPatch = keyBase && keyBase !== exerciseId ? { movement_key: keyBase } : null;

        // ✅ If we already have a state row for this set, trust state fully.
        // If we do not, show prefills but don't "lock" the user.
        const displayedWeight =
          hasCurrent
            ? current.weight
            : prefillWeight != null
            ? prefillWeight
            : null;

        const displayedReps =
          hasCurrent
            ? current.reps
            : prefillReps != null
            ? prefillReps
            : null;

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

                    // ✅ If user edits weight first and the set doesn't exist yet,
                    // seed reps into state so reps don't snap back or become locked.
                    const seedReps = !hasCurrent ? (prefillReps ?? null) : undefined;

                    onUpdateSet(exerciseId, realSetNum, {
                      weight,
                      ...(seedReps !== undefined ? { reps: seedReps } : {}),
                      ...(movementPatch || {}),
                    });
                  }}
                />
                {targetKg != null && showUseTarget ? (
                  <span className="gx-dot" aria-hidden="true" />
                ) : null}
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

                  // ✅ If user edits reps first and the set doesn't exist yet,
                  // seed weight into state so KG doesn't drop to blank/0.
                  const seedWeight = !hasCurrent
                    ? (prefillWeight != null ? prefillWeight : targetKg != null ? targetKg : null)
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

                  // ✅ When ticking ON, commit displayed values so API always gets them.
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
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
