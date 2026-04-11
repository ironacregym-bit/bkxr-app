import React, { useMemo } from "react";
import type { CompletionSet, UIRound, UISingleItem, UISupersetItem } from "./types";
import ExerciseSingleCard from "./ExerciseSingleCard";
import ExerciseSupersetCard from "./ExerciseSupersetCard";

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
  const sorted = useMemo(() => [...(round.items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [round.items]);

  return (
    <section className="futuristic-card p-3 mb-3">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h4 className="m-0">{title}</h4>
      </div>

      {sorted.length === 0 ? (
        <div className="text-dim small mt-2">No items.</div>
      ) : (
        sorted.map((it, idx) => (
          <div
            key={`${title}-${idx}`}
            className="p-2 mb-3"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
            }}
          >
            {it.type === "Single" ? (
              <ExerciseSingleCard
                item={it as UISingleItem}
                media={media[(it as UISingleItem).exercise_id]}
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
                item={it as UISupersetItem}
                media={media}
                prevByKey={prevByKey}
                onUpdateSet={onUpdateSet}
                onToggleTick={onToggleTick}
                tickKeys={tickKeys}
                onOpenMedia={onOpenMedia}
              />
            )}
          </div>
        ))
      )}
    </section>
  );
}
