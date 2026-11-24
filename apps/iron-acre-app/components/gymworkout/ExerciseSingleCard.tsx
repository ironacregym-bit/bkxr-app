// File: components/gymworkout/ExerciseSingleCard.tsx

import React, { useMemo, useState } from "react";
import type { CompletionSet, UISingleItem } from "./types";
import RestTimer from "./RestTimer";
import SetGrid from "./SetGrid";
import { computeTargetKg, fixGifUrl, GREEN } from "./utils";

function parseRepsToNumber(reps?: string | null): number | null {
  if (!reps) return null;
  const m = String(reps).match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function normaliseBasisName(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalisePercent(v: number) {
  if (!Number.isFinite(v)) return null;
  const pct = v <= 1 ? v * 100 : v;
  const rounded = Math.round(pct * 1000) / 1000;
  return rounded;
}

function buildMovementKey(item: UISingleItem) {
  const strength = item.strength || null;
  const basisRaw = (strength?.basis_exercise || item.exercise_name || item.exercise_id || "").trim();
  const basis = normaliseBasisName(basisRaw);

  const pctRaw = strength?.percent_1rm;
  const pct = pctRaw != null ? normalisePercent(Number(pctRaw)) : null;

  if (pct == null) return basis;

  const mode = strength?.mode ? `|mode:${String(strength.mode)}` : "";
  return `${basis}|pct:${pct}${mode}`;
}

export default function ExerciseSingleCard({
  item,
  media,
  prevByKey,
  currentByKey,
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
  currentByKey: Record<string, { weight: number | null; reps: number | null }>;
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

  const movementKeyBase = useMemo(() => buildMovementKey(item), [item]);

  const hasPct = useMemo(() => {
    const v = item?.strength?.percent_1rm;
    if (v == null) return false;
    const n = Number(v);
    return Number.isFinite(n);
  }, [item?.strength?.percent_1rm]);

  const target = useMemo(() => {
    if (!item.strength || !hasPct) return { targetKg: null as number | null, pctLabel: "" as string | null, key: "" };
    return computeTargetKg({ strength: item.strength, trainingMaxes, defaultRounding });
  }, [item.strength, hasPct, trainingMaxes, defaultRounding]);

  const prefillReps = useMemo(() => parseRepsToNumber(item.reps ?? null), [item.reps]);

  const prefillWeight = useMemo(() => {
    if (!item.strength || !hasPct) return null;
    return target.targetKg != null ? target.targetKg : null;
  }, [item.strength, hasPct, target.targetKg]);

  const title = media?.exercise_name || item.exercise_name || item.exercise_id;
  const [note, setNote] = useState<string>("");

  const thumbUrl = media?.gif_url ? fixGifUrl(media.gif_url) : undefined;
  const hasMedia = Boolean(thumbUrl || media?.video_url);

  return (
    <div className="gx-ex">
      <div className="gx-ex-head">
        <div className="gx-ex-title">{title}</div>

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
            <img src={thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div className="d-flex align-items-center justify-content-center" style={{ width: "100%", height: "100%" }}>
              <i className="fas fa-play" />
            </div>
          )}
        </button>
      </div>

      <div className="gx-ex-sub">
        {sets} sets
        {item.reps ? ` • ${item.reps}` : ""}
        {item.rest_s != null ? ` • Rest ${item.rest_s}s` : ""}
        {item.strength && hasPct ? (
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
        currentByKey={currentByKey}
        targetKg={item.strength && hasPct ? target.targetKg : null}
        showUseTarget={Boolean(item.strength && hasPct)}
        prefillReps={prefillReps}
        prefillWeight={prefillWeight}
        movementKeyBase={movementKeyBase}
        onUpdateSet={onUpdateSet}
        tickKeys={tickKeys}
        onToggleTick={onToggleTick}
      />

      <div className="gx-ex-actions">
        <button type="button" className="gx-act gx-act-add" onClick={() => setExtraSets((n) => n + 1)}>
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
