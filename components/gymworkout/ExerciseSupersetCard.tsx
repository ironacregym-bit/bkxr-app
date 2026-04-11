import React, { useMemo, useState } from "react";
import type { CompletionSet, UISupersetItem } from "./types";
import SetGrid from "./SetGrid";
import { ACCENT, fixGifUrl } from "./utils";

function parseRepsToNumber(reps?: string | null): number | null {
  if (!reps) return null;
  // Handles "10", "6 reps", "10-12" -> take first number
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
                  {rest != null && <span className="text-dim small">Rest {rest}s</span>}
                </div>

                {item.items.map((sub) => {
                  const m = media[sub.exercise_id] || {};
                  const title = m.exercise_name || sub.exercise_id;

                  const thumbUrl = m.gif_url ? fixGifUrl(m.gif_url) : undefined;
                  const hasMedia = Boolean(thumbUrl || m.video_url);

                  const prev = prevByKey[`${sub.exercise_id}|${setNum}`];
                  const prefillReps = parseRepsToNumber(sub.reps);

                  return (
                    <div key={`${sub.exercise_id}|${setNum}`} className="gx-ss-ex">
                      <div className="gx-ss-ex-head">
                        <div className="gx-ss-ex-title text-truncate">{title}</div>

                        <div className="gx-ss-ex-prev text-dim small">
                          Prev: {prev?.weight ?? "-"}kg × {prev?.reps ?? "-"}
                        </div>

                        <button
                          type="button"
                          className="gx-ss-ex-thumb"
                          onClick={() => onOpenMedia(sub.exercise_id)}
                          aria-label={hasMedia ? "Open exercise media" : "No media available"}
                          title={hasMedia ? "Open media" : "No media"}
                          disabled={!hasMedia}
                          style={{ opacity: hasMedia ? 1 : 0.6 }}
                        >
                          {thumbUrl ? (
                            <img src={thumbUrl} alt={title} />
                          ) : (
                            <i className="fas fa-play" />
                          )}
                        </button>
                      </div>

                      <div className="gx-ss-ex-meta text-dim small">
                        {sub.reps ? `${sub.reps}` : ""}
                        {sub.reps && rest != null ? " • " : ""}
                        {rest != null ? `Rest ${rest}s` : ""}
                      </div>

                      {/* One set row worth of inputs, repeated by SetGrid */}
                      <SetGrid
                        exerciseId={sub.exercise_id}
                        sets={1}
                        prevByKey={prevByKey}
                        targetKg={null}
                        showUseTarget={false}
                        onUpdateSet={(exercise_id, _, patch) => onUpdateSet(exercise_id, setNum, patch)}
                        tickKeys={tickKeys}
                        onToggleTick={(exercise_id) => onToggleTick(exercise_id, setNum)}
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
