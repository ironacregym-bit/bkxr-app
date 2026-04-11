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
    <div>
      <div className="d-flex align-items-center justify-content-between mb-1 flex-wrap gap-2">
        <strong className="text-truncate">{(item.name || "").trim() || "Superset"}</strong>
        <div className="d-flex align-items-center gap-2">
          <span className="badge border" style={{ borderColor: ACCENT, color: ACCENT }}>
            {sets} sets
          </span>
          <button
            className="btn btn-sm"
            style={{
              borderRadius: 999,
              border: `1px solid ${ACCENT}88`,
              color: ACCENT,
              background: "transparent",
              fontWeight: 700,
            }}
            onClick={() => setExpanded((v) => !v)}
          >
            <i className={`fas fa-chevron-${expanded ? "up" : "down"}`} />
          </button>
        </div>
      </div>

      <div className="text-dim small mb-2">
        {rest != null ? `Rest between sets: ${rest}s` : ""}
        {item.notes ? ` • ${item.notes}` : ""}
      </div>

      {expanded && (
        <div>
          {item.items.map((sub, idx) => {
            const title = media[sub.exercise_id]?.exercise_name || sub.exercise_id;
            return (
              <div key={idx} className="mb-3">
                <div className="fw-semibold">{title}</div>
                <div className="text-dim small">{sub.reps ? `• ${sub.reps} reps` : ""}</div>
                <div className="mt-2">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
