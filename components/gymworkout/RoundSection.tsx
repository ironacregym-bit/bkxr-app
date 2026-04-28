// components/gymworkout/RoundSection.tsx
import React, { useMemo } from "react";
import type { CompletionSet, UIRound, UISingleItem, UISupersetItem } from "./types";
import ExerciseSingleCard from "./ExerciseSingleCard";
import ExerciseSupersetCard from "./ExerciseSupersetCard";

type RoundItem = UISingleItem | UISupersetItem;

function normalizeItem(it: any): RoundItem {
  if (it?.type !== "Superset") return it;

  // ✅ Support both new + legacy superset shapes
  const items =
    Array.isArray(it.items)
      ? it.items
      : Array.isArray(it.superset_items)
      ? it.superset_items
      : [];

  return { ...it, items };
}

export default function RoundSection({
  title,
  round,
  media,
  prevByKey,
  trainingMaxes,
  defaultRounding,
  onUpdateSet,
  onToggleTick,
  tickKeys,
  onOpenMedia,
}: {
  title: string;
  round: UIRound;
  media: Record<string, { gif_url?: string; video_url?: string; exercise_name?: string }>;
  prevByKey: Record<string, { weight: number | null; reps: number | null }>;
  trainingMaxes: Record<string, number>;
  defaultRounding: number;
  onUpdateSet: (exercise_id: string, set: number, patch: Partial<CompletionSet>) => void;
  onToggleTick: (exercise_id: string, set: number) => void;
  tickKeys: Record<string, boolean>;
  onOpenMedia: (exercise_id: string) => void;
}) {
  const sorted = useMemo<RoundItem[]>(() => {
    const safeItems = Array.isArray(round?.items) ? round.items : [];
    return safeItems
      .map(normalizeItem)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [round]);

  return (
    <section className="gx-round">
      <div className="gx-round-head">
        <div className="gx-round-title">{title}</div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-dim small mt-2">No items.</div>
      ) : (
        <div className="gx-round-body">
          {sorted.map((it, idx) =>
            it.type === "Single" ? (
              <ExerciseSingleCard
                key={`${title}-single-${idx}`}
                item={it}
                media={media[it.exercise_id]}
                prevByKey={prevByKey}
                trainingMaxes={trainingMaxes}
                defaultRounding={defaultRounding}
                onUpdateSet={onUpdateSet}
                onToggleTick={onToggleTick}
                tickKeys={tickKeys}
                onOpenMedia={onOpenMedia}
              />
            ) : (
              <ExerciseSupersetCard
                key={`${title}-ss-${idx}`}
                item={it}
                media={media}
                prevByKey={prevByKey}
                onUpdateSet={onUpdateSet}
                onToggleTick={onToggleTick}
                tickKeys={tickKeys}
                onOpenMedia={onOpenMedia}
              />
            )
          )}
        </div>
      )}
    </section>
  );
}
