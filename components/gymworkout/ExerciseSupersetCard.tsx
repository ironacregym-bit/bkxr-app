import React, { useState } from "react";
import type { CompletionSet, UISupersetItem } from "./types";
import SetGrid from "./SetGrid";
import { ACCENT } from "./utils";

function parseRepsToNumber(reps?: string | null): number | null {
  if (!reps) return null;
  const m = String(reps).match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export default function ExerciseSupersetCard({
  item,
  media,
  prevByKey,
  onUpdateSet,
  onToggleTick,
  tickKeys,
  onOpenMedia,
}: {
  item: UISupersetItem;
  media: Record<string, { gif_url?: string; video_url?: string; exercise_name?: string }>;
  prevByKey: Record<string, { weight: number | null; reps: number | null }>;
  onUpdateSet: (exercise_id: string, set: number, patch: Partial<CompletionSet>) => void;
  onToggleTick: (exercise_id: string, set: number) => void;
  tickKeys: Record<string, boolean>;
  onOpenMedia: (exercise_id: string) => void;
}) {
  const sets = Number.isFinite(item.sets) ? Number(item.sets) : 3;
  const rest = item.rest_s ?? null;
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="gx-ss">
      <div className="gx-ss-head">
        <div className="gx-ss-title">{(item.name || "").trim() || "Superset"}</div>

        <div className="gx-ss-right">
          <span className="gx-chip" style={{ borderColor: `${ACCENT}88`, color: ACCENT }}>
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

      {expanded && (
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

                  const prev = prevByKey[`${sub.exercise_id}|${setNum}`];
                  const prefillReps = parseRepsToNumber(sub.reps);

                  return (
                    <div key={`${sub.exercise_id}|${setNum}`} className="gx-ss-ex">
                      {/* Name + play button on same row */}
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

                      {/* Keep only the Prev near the set row (this one) */}
                      <div className="text-dim small" style={{ marginTop: 6 }}>
                        Prev: {prev?.weight ?? "-"}kg × {prev?.reps ?? "-"}
                      </div>

                      {/* Single input row mapped to this setNum */}
                      <SetGrid
                        exerciseId={sub.exercise_id}
                        sets={1}
                        prevByKey={prevByKey}
                        targetKg={null}
                        showUseTarget={false}
                        showPrevRow={false}
                        onUpdateSet={(exercise_id, _ignored, patch) =>
                          onUpdateSet(exercise_id, setNum, patch)
                        }
                        tickKeys={tickKeys}
                        onToggleTick={(exercise_id, _ignored) => onToggleTick(exercise_id, setNum)}
                        prefillReps={prefillReps}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
