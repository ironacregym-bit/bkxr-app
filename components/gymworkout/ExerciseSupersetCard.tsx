// File: components/gymworkout/ExerciseSupersetCard.tsx

import React, { useMemo, useState } from "react";
import type { CompletionSet, UISupersetItem } from "./types";
import SetGrid from "./SetGrid";
import { GREEN } from "./utils";

function parseRepsToNumber(reps?: string | null): number | null {
  if (!reps) return null;
  const m = String(reps).match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function normaliseKeyPart(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function buildSupersetMovementKey(args: { exerciseId: string; supersetOrder: number; supersetName?: string | null }) {
  const ex = String(args.exerciseId || "").trim();
  const order = Number.isFinite(args.supersetOrder) ? args.supersetOrder : 0;
  const name = normaliseKeyPart(args.supersetName || "superset");
  return `${ex}|ss:${name}|o:${order}`;
}

export default function ExerciseSupersetCard({
  item,
  media,
  prevByKey,
  currentByKey,
  onUpdateSet,
  onToggleTick,
  tickKeys,
  onOpenMedia,
}: {
  item: UISupersetItem;
  media: Record<string, { gif_url?: string; video_url?: string; exercise_name?: string }>;
  prevByKey: Record<string, { weight: number | null; reps: number | null }>;
  currentByKey: Record<string, { weight: number | null; reps: number | null }>;
  onUpdateSet: (exercise_id: string, set: number, patch: Partial<CompletionSet>) => void;
  onToggleTick: (exercise_id: string, set: number) => void;
  tickKeys: Record<string, boolean>;
  onOpenMedia: (exercise_id: string) => void;
}) {
  const sets = Number.isFinite(item.sets) ? Number(item.sets) : 3;
  const rest = item.rest_s ?? null;
  const [expanded, setExpanded] = useState(true);

  const supersetName = useMemo(() => (item.name || "").trim() || "Superset", [item.name]);
  const supersetOrder = Number.isFinite(item.order) ? Number(item.order) : 0;

  function keyFor(movementKeyBase: string, setNum: number) {
    return `${movementKeyBase}|${setNum}`;
  }

  function destHasCurrent(movementKeyBase: string, setNum: number) {
    return Object.prototype.hasOwnProperty.call(currentByKey, keyFor(movementKeyBase, setNum));
  }

  function getCurrent(movementKeyBase: string, setNum: number) {
    return currentByKey[keyFor(movementKeyBase, setNum)] ?? { weight: null as number | null, reps: null as number | null };
  }

  function copySet1ToSet(exerciseId: string, movementKeyBase: string, setNum: number, prefillReps: number | null) {
    const srcHas = destHasCurrent(movementKeyBase, 1);
    const src = getCurrent(movementKeyBase, 1);

    const srcWeight = srcHas ? src.weight : null;
    const srcReps = srcHas ? src.reps : prefillReps;

    if (srcWeight == null && srcReps == null) return;

    const destHas = destHasCurrent(movementKeyBase, setNum);
    const dest = getCurrent(movementKeyBase, setNum);

    const destWeightBlank = !destHas || dest.weight == null;
    const destRepsBlank = !destHas || dest.reps == null;

    if (!destWeightBlank && !destRepsBlank) return;

    const patch: Partial<CompletionSet> = { movement_key: movementKeyBase };
    if (destWeightBlank) patch.weight = srcWeight;
    if (destRepsBlank) patch.reps = srcReps;

    onUpdateSet(exerciseId, setNum, patch);
  }

  function copySet1ToAll(exerciseId: string, movementKeyBase: string, prefillReps: number | null) {
    for (let setNum = 2; setNum <= sets; setNum++) {
      copySet1ToSet(exerciseId, movementKeyBase, setNum, prefillReps);
    }
  }

  return (
    <div className="gx-ss">
      <div className="gx-ss-head">
        <div className="gx-ss-title">{supersetName}</div>

        <div className="gx-ss-right">
          <span className="gx-chip" style={{ borderColor: `${GREEN}88`, color: GREEN }}>
            {sets} sets
          </span>

          <button
            type="button"
            className="gx-chevron"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse" : "Expand"}
            title={expanded ? "Collapse" : "Expand"}
          >
            <i className={`fas fa-chevron-${expanded ? "up" : "down"}`} />
          </button>
        </div>
      </div>

      <div className="gx-ss-sub">
        {rest != null ? `Rest between sets: ${rest}s` : ""}
        {item.notes ? ` • ${item.notes}` : ""}
      </div>

      {expanded ? (
        <div className="gx-ss-body">
          {Array.from({ length: sets }).map((_, sIdx) => {
            const setNum = sIdx + 1;

            return (
              <div key={setNum} className="gx-ss-set">
                <div className="gx-ss-set-head">
                  <strong>Set {setNum}</strong>
                </div>

                {item.items.map((sub) => {
                  const m = media[sub.exercise_id] || {};
                  const title = m.exercise_name || sub.exercise_id;
                  const hasMedia = Boolean(m.gif_url || m.video_url);

                  const movementKeyBase = buildSupersetMovementKey({
                    exerciseId: sub.exercise_id,
                    supersetOrder,
                    supersetName,
                  });

                  const prev =
                    prevByKey[`${movementKeyBase}|${setNum}`] ??
                    prevByKey[`${sub.exercise_id}|${setNum}`];

                  const prefillReps = parseRepsToNumber(sub.reps);

                  return (
                    <div key={`${sub.exercise_id}|${setNum}`} className="gx-ss-ex">
                      <div className="gx-ss-ex-head">
                        <div className="gx-ss-ex-title text-truncate" title={title}>
                          {title}
                        </div>

                        <button
                          type="button"
                          className="gx-icon-circle gx-icon-circle-sm"
                          onClick={() => hasMedia && onOpenMedia(sub.exercise_id)}
                          disabled={!hasMedia}
                          aria-label={hasMedia ? "Open exercise media" : "No media available"}
                          title={hasMedia ? "Open media" : "No media"}
                        >
                          <i className="fas fa-play" />
                        </button>
                      </div>

                      <div
                        className="text-dim small"
                        style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 10 }}
                      >
                        <span>
                          Prev: {prev?.weight ?? "-"}kg × {prev?.reps ?? "-"}
                        </span>

                        <span style={{ display: "inline-flex", gap: 10 }}>
                          {setNum === 1 && sets > 1 ? (
                            <button
                              type="button"
                              className="gx-use"
                              onClick={() => copySet1ToAll(sub.exercise_id, movementKeyBase, prefillReps)}
                              title="Copy Set 1 into all other sets (fill blanks only)"
                            >
                              Copy to all
                            </button>
                          ) : null}

                          {setNum > 1 ? (
                            <button
                              type="button"
                              className="gx-use"
                              onClick={() => copySet1ToSet(sub.exercise_id, movementKeyBase, setNum, prefillReps)}
                              title="Copy Set 1 into this set (fill blanks only)"
                            >
                              Copy set 1
                            </button>
                          ) : null}
                        </span>
                      </div>

                      <SetGrid
                        exerciseId={sub.exercise_id}
                        sets={1}
                        prevByKey={prevByKey}
                        currentByKey={currentByKey}
                        targetKg={null}
                        showUseTarget={false}
                        showPrevRow={false}
                        movementKeyBase={movementKeyBase}
                        setNumberBase={setNum}
                        onUpdateSet={onUpdateSet}
                        tickKeys={tickKeys}
                        onToggleTick={onToggleTick}
                        prefillReps={prefillReps}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
