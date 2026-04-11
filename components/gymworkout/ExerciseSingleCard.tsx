import React, { useMemo, useState } from "react";
import type { CompletionSet, UISingleItem } from "./types";
import RestTimer from "./RestTimer";
import SetGrid from "./SetGrid";
import { computeTargetKg, GREEN, ACCENT, fixGifUrl } from "./utils";

export default function ExerciseSingleCard({
  item,
  media,
  prevByKey,
  trainingMaxes,
  defaultRounding,
  onUpdateSet,
  onToggleTick,
  tickKeys,
  onOpenMedia,
}: {
  item: UISingleItem;
  media?: { gif_url?: string; video_url?: string; exercise_name?: string };
  prevByKey: Record<string, { weight: number | null; reps: number | null }>;
  trainingMaxes: Record<string, number>;
  defaultRounding: number;
  onUpdateSet: (exercise_id: string, set: number, patch: Partial<CompletionSet>) => void;
  onToggleTick: (exercise_id: string, set: number) => void;
  tickKeys: Record<string, boolean>;
  onOpenMedia: (exercise_id: string) => void;
}) {
  const baseSets = Number.isFinite(item.sets) ? Number(item.sets) : 3;
  const [extraSets, setExtraSets] = useState(0);
  const sets = Math.max(1, baseSets + extraSets);

  const [expanded, setExpanded] = useState(true);

  const target = useMemo(
    () => computeTargetKg({ strength: item.strength, trainingMaxes, defaultRounding }),
    [item.strength, trainingMaxes, defaultRounding]
  );

  const title = media?.exercise_name || item.exercise_name || item.exercise_id;

  return (
    <div>
      <div className="d-flex align-items-center gap-2 gap-md-3 mb-2 flex-wrap">
        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          style={{ borderRadius: 12, padding: 0, overflow: "hidden", flex: "0 0 auto" }}
          onClick={() => onOpenMedia(item.exercise_id)}
          aria-label={`Open media for ${title}`}
        >
          {media?.gif_url ? (
            <img
              src={fixGifUrl(media.gif_url)}
              alt={title}
              style={{ width: 64, height: 64, objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              className="d-flex align-items-center justify-content-center"
              style={{ width: 64, height: 64, background: "rgba(255,255,255,0.06)" }}
            >
              <i className="fas fa-play" />
            </div>
          )}
        </button>

        <div className="flex-fill" style={{ minWidth: 220 }}>
          <div className="fw-semibold text-truncate" style={{ lineHeight: 1.2 }}>
            {title}
          </div>

          <div className="text-dim small">
            {sets} Sets
            {item.rest_s != null ? ` • Rest ${item.rest_s}s` : ""}
            {item.reps ? ` • ${item.reps}` : ""}
          </div>

          {item.strength && (
            <div className="small mt-1" style={{ color: GREEN }}>
              Target {target.targetKg != null ? `${target.targetKg}kg` : "—"}{" "}
              {target.pctLabel ? `(${target.pctLabel})` : ""}
              {target.key ? (
                <span className="text-dim" style={{ marginLeft: 8 }}>
                  • 1RM key: {target.key}
                </span>
              ) : null}
            </div>
          )}

          <RestTimer seconds={item.rest_s ?? null} />
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-sm btn-outline-light"
            style={{ borderRadius: 12 }}
            onClick={() => setExtraSets((n) => n + 1)}
          >
            + Add Set
          </button>

          <button
            className="btn btn-sm"
            style={{
              borderRadius: 12,
              background: "transparent",
              border: `1px solid rgba(255,80,80,0.5)`,
              color: "rgba(255,80,80,0.95)",
              opacity: extraSets > 0 ? 1 : 0.5,
            }}
            onClick={() => setExtraSets((n) => Math.max(0, n - 1))}
            disabled={extraSets <= 0}
          >
            − Remove Set
          </button>

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
            aria-expanded={expanded}
            aria-controls={`single-sets-${item.exercise_id}`}
          >
            <i className={`fas fa-chevron-${expanded ? "up" : "down"}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div id={`single-sets-${item.exercise_id}`}>
          <SetGrid
            exerciseId={item.exercise_id}
            sets={sets}
            prevByKey={prevByKey}
            targetKg={target.targetKg}
            showUseTarget={Boolean(item.strength)}
            onUpdateSet={onUpdateSet}
            tickKeys={tickKeys}
            onToggleTick={onToggleTick}
          />
        </div>
      )}
    </div>
  );
}
