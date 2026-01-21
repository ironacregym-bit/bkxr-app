
// components/workouts/RoundMediaRail.tsx
"use client";

import { useMemo, useState } from "react";
import ExerciseMedia from "./ExerciseMedia";

type Item = {
  id?: string;
  exercise_id?: string;
  reps?: string;
  time_s?: number;
  weight_kg?: number;
  tempo?: string;
  rest_s?: number;
};

export default function RoundMediaRail({
  items,
  exerciseNameById,
  videoByExerciseId,
  initialIndex = 0,
  title,
  subtitle,
  aspect = "16x9",
  onChange,
}: {
  items: Item[];
  exerciseNameById: Record<string, string>;
  videoByExerciseId?: Record<string, string | undefined>;
  initialIndex?: number;
  title?: string;
  subtitle?: string;
  aspect?: "16x9" | "4x3" | "1x1";
  onChange?: (index: number, item: Item) => void;
}) {
  const [active, setActive] = useState<number>(Math.min(initialIndex, Math.max(0, items.length - 1)));

  const activeItem = items[active];
  const activeTitle = useMemo(() => {
    if (!activeItem) return title || "Exercise";
    if (activeItem.exercise_id) {
      return exerciseNameById[activeItem.exercise_id] || activeItem.exercise_id;
    }
    return title || "Exercise";
  }, [activeItem, exerciseNameById, title]);

  const activeSubtitle = useMemo(() => {
    const it = activeItem;
    if (!it) return subtitle;
    const bits = [
      it.reps ? `${it.reps} reps` : "",
      typeof it.time_s === "number" ? `${it.time_s}s` : "",
      typeof it.weight_kg === "number" ? `${it.weight_kg}kg` : "",
      it.tempo || "",
      typeof it.rest_s === "number" ? `rest ${it.rest_s}s` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return bits || subtitle;
  }, [activeItem, subtitle]);

  const activeVideo = useMemo(() => {
    const id = activeItem?.exercise_id || "";
    return videoByExerciseId?.[id];
  }, [activeItem, videoByExerciseId]);

  return (
    <div className="futuristic-card p-2" style={{ overflow: "hidden" }}>
      {/* Big pane */}
      <ExerciseMedia
        title={activeTitle}
        subtitle={activeSubtitle}
        videoUrl={activeVideo}
        aspect={aspect}
      />

      {/* Rail */}
      {items.length > 1 && (
        <div className="mt-2" style={{ overflowX: "auto" }}>
          <div className="d-flex" style={{ gap: 8, minWidth: "100%" }}>
            {items.map((it, i) => {
              const name =
                (it.exercise_id && (exerciseNameById[it.exercise_id] || it.exercise_id)) ||
                it.exercise_id ||
                `Item ${i + 1}`;
              const vid = it.exercise_id ? videoByExerciseId?.[it.exercise_id] : undefined;

              const activeStyle: React.CSSProperties = active === i
                ? {
                    background: "linear-gradient(135deg,#FF8A2A,#ff7f32)",
                    boxShadow: "0 0 14px #FF8A2A66",
                    color: "#0b0b0b",
                    border: "none",
                  }
                : {};
              return (
                <button
                  key={`${it.exercise_id || "it"}-${i}`}
                  className="btn btn-bxkr-outline btn-sm"
                  style={{
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    ...activeStyle,
                  }}
                  onClick={() => {
                    setActive(i);
                    onChange?.(i, it);
                  }}
                  title={name}
                >
                  {vid ? "▶︎ " : ""}
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
