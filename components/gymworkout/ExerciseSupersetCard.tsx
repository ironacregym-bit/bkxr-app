import React, { useState } from "react";
import type { CompletionSet, UISupersetItem } from "./types";
import SetGrid from "./SetGrid";
import { ACCENT } from "./utils";

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
            const title = media[sub.exercise_id]?.exercise_name || sub.exercise_id;
            return (
              <div key={idx} className="gx-ex gx-ex--sub">
                <div className="gx-ex-head">
                  <div className="gx-ex-title">{title}</div>
                  <button type="button" className="gx-more" aria-label="More options">
                    <i className="fas fa-ellipsis-h" />
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
