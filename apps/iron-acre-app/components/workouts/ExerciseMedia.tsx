
// components/workouts/ExerciseMedia.tsx
"use client";

/** GIF-first media card; falls back to video or a text stub */
export default function ExerciseMedia({
  title,
  subtitle,
  gifUrl,
  videoUrl,
  imageUrl,
  aspect = "16x9",
}: {
  title: string;
  subtitle?: string;
  gifUrl?: string;
  videoUrl?: string;
  imageUrl?: string;
  aspect?: "16x9" | "1x1" | "4x3";
}) {
  const ratioClass = aspect === "1x1" ? "ratio-1x1" : aspect === "4x3" ? "ratio-4x3" : "ratio-16x9";

  return (
    <div className="futuristic-card p-2" style={{ overflow: "hidden" }}>
      <div className={`ratio ${ratioClass}`} style={{ borderRadius: 12, overflow: "hidden" }}>
        {gifUrl ? (
          <img src={gifUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : videoUrl ? (
          videoUrl.includes("youtube") || videoUrl.includes("youtu.be") || videoUrl.includes("vimeo") ? (
            <iframe
              src={videoUrl}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video controls playsInline preload="metadata" src={videoUrl} style={{ width: "100%" }} />
          )
        ) : imageUrl ? (
          <img src={imageUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div
            className="d-flex align-items-center justify-content-center"
            style={{
              width: "100%", height: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px dashed rgba(255,255,255,0.2)",
            }}
          >
            <div className="text-center px-3">
              <div style={{ fontWeight: 800 }}>{title}</div>
              <div className="text-dim" style={{ fontSize: 12 }}>{subtitle || "No media linked"}</div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2">
        <div style={{ fontWeight: 700 }}>{title}</div>
        {subtitle ? <div className="text-dim" style={{ fontSize: 12 }}>{subtitle}</div> : null}
      </div>
    </div>
  );
}
