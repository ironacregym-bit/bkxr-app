import React, { useMemo, useState } from "react";
import type { CompletionSet, UISingleItem } from "./types";
import RestTimer from "./RestTimer";
import SetGrid from "./SetGrid";
import { computeTargetKg, GREEN } from "./utils";

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

  const target = useMemo(
    () => computeTargetKg({ strength: item.strength, trainingMaxes, defaultRounding }),
    [item.strength, trainingMaxes, defaultRounding]
  );

  const title = media?.exercise_name || item.exercise_name || item.exercise_id;

  const [note, setNote] = useState<string>("");

  const hasMedia = Boolean(media?.gif_url || media?.video_url);

  return (
    <div className="gx-ex">
      {/* ✅ Title row matches Superset title row pattern */}
      <div className="gx-ex-head">
        <div className="gx-ex-title text-truncate" title={title}>
          {title}
        </div>

        <span
          className={`gx-play-icon ${hasMedia ? "" : "is-disabled"}`}
          role="button"
          tabIndex={hasMedia ? 0 : -1}
          aria-label={hasMedia ? "Open exercise media" : "No media available"}
          title={hasMedia ? "Open media" : "No media"}
          onClick={() => {
            if (!hasMedia) return;
            onOpenMedia(item.exercise_id);
          }}
          onKeyDown={(e) => {
            if (!hasMedia) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenMedia(item.exercise_id);
            }
          }}
        >
          <i className="fa-solid fa-circle-play" />
        </span>
      </div>

      {/* ✅ Prev directly below title (same pattern you want) */}
      <div className="gx-ex-prev text-dim small">
        Prev: {prevByKey[`${item.exercise_id}|1`]?.weight ?? "-"}kg ×{" "}
        {prevByKey[`${item.exercise_id}|1`]?.reps ?? "-"}
      </div>

      {/* Sub/meta line (sets, reps, rest, target) */}
      <div className="gx-ex-sub">
        {sets} sets
        {item.reps ? ` • ${item.reps}` : ""}
        {item.rest_s != null ? ` • Rest ${item.rest_s}s` : ""}
        {item.strength ? (
          <span className="gx-ex-target" style={{ color: GREEN }}>
            • Target {target.targetKg != null ? `${target.targetKg}kg` : "—"}{" "}
            {target.pctLabel ? `(${target.pctLabel})` : ""}
          </span>
        ) : null}
      </div>

      {/* Notes */}
      <div className="gx-ex-notes">
        <input
          className="gx-notes-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add notes here..."
        />
      </div>

      {/* Rest timer */}
      <div className="gx-ex-rest">
        <RestTimer seconds={item.rest_s ?? null} />
      </div>

      {/* Sets */}
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

      {/* Bottom split actions */}
      <div className="gx-ex-actions">
        <button
          type="button"
          className="gx-act gx-act-add"
          onClick={() => setExtraSets((n) => n + 1)}
        >
          + Add Set
        </button>
        <button
          type="button"
          className="gx-act gx-act-remove"
          onClick={() => setExtraSets((n) => Math.max(0, n - 1))}
          disabled={extraSets <= 0}
        >
          − Remove Set
        </button>
      </div>
    </div>
  );
}
