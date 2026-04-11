import React, { useMemo, useState } from "react";
import type { CompletionSet, UISingleItem } from "./types";
import RestTimer from "./RestTimer";
import SetGrid from "./SetGrid";
import { computeTargetKg, fixGifUrl, GREEN } from "./utils";

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

  const thumbUrl = media?.gif_url ? fixGifUrl(media.gif_url) : undefined;
  const hasMedia = Boolean(thumbUrl || media?.video_url);

  return (
    <div className="gx-ex">
      <div className="gx-ex-head">
        <div className="gx-ex-title">{title}</div>

        {/* ✅ Replace ... with media thumb */}
        <button
          type="button"
          className="gx-more"
          onClick={() => onOpenMedia(item.exercise_id)}
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

      <div className="gx-ex-notes">
        <input
          className="gx-notes-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add notes here..."
        />
      </div>

      <div className="gx-ex-rest">
        <RestTimer seconds={item.rest_s ?? null} />
      </div>

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
