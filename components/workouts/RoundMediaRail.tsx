
// components/workouts/RoundMediaRail.tsx
"use client";

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
  onOpenMedia, // (exercise_id: string) => void
}: {
  items: Item[];
  exerciseNameById: Record<string, string>;
  onOpenMedia?: (exercise_id: string) => void;
}) {
  if (!items?.length) return null;

  return (
    <div className="futuristic-card p-2" style={{ overflow: "hidden" }}>
      <div
        className="d-flex flex-wrap"
        style={{ gap: 8 }}
      >
        {items.map((it, i) => {
          const id = it.exercise_id || "";
          const name = (id && (exerciseNameById[id] || id)) || `Item ${i + 1}`;
          const meta = [
            it.reps ? `${it.reps} reps` : "",
            typeof it.time_s === "number" ? `${it.time_s}s` : "",
          ].filter(Boolean).join("  ");

        return (
          <button
            key={`${id}-${i}`}
            className="btn btn-bxkr-outline btn-sm"
            style={{ borderRadius: 999, whiteSpace: "nowrap" }}
            onClick={() => id && onOpenMedia?.(id)}
            title={name}
          >
            {name}{meta ? ` — ${meta}` : ""}
          </button>
        );
        })}
      </div>
    </div>
  );
}
