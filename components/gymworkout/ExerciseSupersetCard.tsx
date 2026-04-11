import React, { useState } from "react";
import type { CompletionSet, UISupersetItem } from "./types";
import SetGrid from "./SetGrid";
import { ACCENT, fixGifUrl } from "./utils";

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
    <div>
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
          {item.items.map((sub, idx) => {
            const m = media[sub.exercise_id] || {};
            const title = m.exercise_name || sub.exercise_id;

            const thumbUrl = m.gif_url ? fixGifUrl(m.gif_url) : undefined;
            const hasMedia = Boolean(thumbUrl || m.video_url);

            return (
              <div key={idx} className="gx-ex gx-ex--sub">
                <div className="gx-ex-head">
                  <div className="gx-ex-title">{title}</div>

                  {/* ✅ Same “thumb instead of …” behaviour */}
                  <button
                    type="button"
                    className="gx-more"
                    onClick={() => onOpenMedia(sub.exercise_id)}
                    aria-label={hasMedia ? "Open exercise media" : "No media available"}
                    title={hasMedia ? "Open media" : "No media"}
                    style={{
                      width: 44,
                      height: 44,
                      padding: 0,
                      overflow: "hidden",
                      opacity: hasMedia ? 1 : 0.6,
                    }}
                    disabled={!hasMedia}
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <div
                        className="d-flex align-items-center justify-content-center"
                        style={{ width: "100%", height: "100%" }}
                      >
                        <i className="fas fa-play" />
                      </div>
                    )}
                  </button>
                </div>

                <div className="gx-ex-sub">
                  {sub.reps ? `• ${sub.reps} reps` : ""}
                </div>

                <SetGrid
                  exerciseId={sub.exercise_id}
                  sets={sets}
                  prevByKey={prevByKey}
                  targetKg={null}
                  showUseTarget={false}
                  onUpdateSet={onUpdateSet}
                  tickKeys={tickKeys}
                  onToggleTick={onToggleTick}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
``
