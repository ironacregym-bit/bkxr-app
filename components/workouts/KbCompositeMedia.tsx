
// components/workouts/KbCompositeMedia.tsx
"use client";

export type KbItem = {
  exercise_id?: string;
};

export default function KbCompositeMedia({
  items,
  gifByExerciseId,
  exerciseNameById,
  aspect = "16x9",
}: {
  items: KbItem[];
  gifByExerciseId?: Record<string, string | undefined>;
  exerciseNameById: Record<string, string>;
  aspect?: "16x9" | "4x3" | "1x1";
}) {
  const ratioClass =
    aspect === "1x1" ? "ratio-1x1" : aspect === "4x3" ? "ratio-4x3" : "ratio-16x9";
  const gifs = (items || [])
    .map((it) => {
      const id = it.exercise_id || "";
      const title = (id && (exerciseNameById[id] || id)) || "Exercise";
      const gif = id ? gifByExerciseId?.[id] : undefined;
      return { id, title, gif };
    })
    .filter((x) => x.id);

  return (
    <div className="futuristic-card p-2" style={{ overflow: "hidden" }}>
      <div className={`ratio ${ratioClass}`} style={{ borderRadius: 12, overflow: "hidden" }}>
        {gifs.length ? (
          <div
            className="d-grid"
            style={{
              gridTemplateColumns: gifs.length >= 3 ? "1fr 1fr 1fr" : gifs.length === 2 ? "1fr 1fr" : "1fr",
              gap: 2,
              width: "100%",
              height: "100%",
            }}
          >
            {gifs.map((g) =>
              g.gif ? (
                <img
                  key={g.id}
                  src={g.gif}
                  alt={g.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  key={g.id}
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px dashed rgba(255,255,255,0.2)",
                  }}
                >
                  <div className="text-center px-2">
                    <div style={{ fontWeight: 700 }}>{g.title}</div>
                    <div className="text-dim" style={{ fontSize: 12 }}>No GIF</div>
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="d-flex align-items-center justify-content-center text-dim">
            No media
          </div>
        )}
      </div>
    </div>
  );
}
