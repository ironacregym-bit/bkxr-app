import React, { useState } from "react";
import type { CompletionSet, UISupersetItem } from "./types";
import { ACCENT, GREEN, fixGifUrl } from "./utils";

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
                  {rest != null && <span className="text-dim small">Rest {rest}s</span>}
                </div>

                {item.items.map((sub) => {
                  const m = media[sub.exercise_id] || {};
                  const title = m.exercise_name || sub.exercise_id;
                  const thumb = m.gif_url ? fixGifUrl(m.gif_url) : null;
                  const tick = Boolean(tickKeys[`${sub.exercise_id}|${setNum}`]);
                  const prev = prevByKey[`${sub.exercise_id}|${setNum}`];

                  return (
                    <div key={`${sub.exercise_id}-${setNum}`} className="gx-ss-row">
                      {/* Top row */}
                      <div className="gx-ss-row-top">
                        <button
                          type="button"
                          className="gx-thumb"
                          onClick={() => onOpenMedia(sub.exercise_id)}
                        >
                          {thumb ? (
                            {thumb}
                          ) : (
                            <div className="gx-thumb-ph">
                              <i className="fas fa-play" />
                            </div>
                          )}
                        </button>

                        <div className="gx-ss-row-info">
                          <div className="fw-semibold text-truncate">{title}</div>
                          <div className="text-dim small">{sub.reps ? `${sub.reps} reps` : ""}</div>
                          <div className="text-dim small">
                            Prev: {prev?.weight ?? "-"}kg × {prev?.reps ?? "-"}
                          </div>
                        </div>
                      </div>

                      {/* Bottom row */}
                      <div className="gx-ss-row-inputs">
                        <input
                          className="gx-input"
                          type="number"
                          inputMode="decimal"
                          placeholder="kg"
                          onChange={(e) =>
                            onUpdateSet(sub.exercise_id, setNum, {
                              weight: Number(e.target.value) || null,
                            })
                          }
                        />
                        <input
                          className="gx-input"
                          type="number"
                          inputMode="numeric"
                          placeholder="reps"
                          onChange={(e) =>
                            onUpdateSet(sub.exercise_id, setNum, {
                              reps: Number(e.target.value) || null,
                            })
                          }
                        />
                        <button
                          type="button"
                          className="gx-tick"
                          style={{
                            borderColor: `${GREEN}88`,
                            color: tick ? "#0b0f14" : GREEN,
                            background: tick ? GREEN : "transparent",
                          }}
                          onClick={() => onToggleTick(sub.exercise_id, setNum)}
                        >
                          <i className="fas fa-check" />
                        </button>
                      </div>
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
