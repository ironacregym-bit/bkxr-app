
// components/workouts/ExerciseMedia.tsx
"use client";

/**
 * Shows a video if provided; otherwise a styled fallback card with title/subtitle.
 * Keep data-mapping (exerciseId -> videoURL) outside and pass videoUrl directly.
 */
export default function ExerciseMedia({
  title,
  subtitle,
  videoUrl,
  imageUrl,
  aspect = "16x9",
}: {
  title: string;
  subtitle?: string;
  videoUrl?: string;
  imageUrl?: string;
  aspect?: "16x9" | "1x1" | "4x3";
}) {
  const ratioClass =
    aspect === "1x1" ? "ratio-1x1" : aspect === "4x3" ? "ratio-4x3" : "ratio-16x9";

  return (
    <div className="futuristic-card p-2" style={{ overflow: "hidden" }}>
      <div className={`ratio ${ratioClass}`} style={{ borderRadius: 12, overflow: "hidden" }}>
        {videoUrl ? (
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
          // Image fallback
          <img
            src={imageUrl}
            alt={title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          // Text fallback
          <div
            className="d-flex align-items-center justify-content-center"
            style={{
              width: "100%",
              height: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px dashed rgba(255,255,255,0.2)",
            }}
          >
            <div className="text-center px-3">
              <div style={{ fontWeight: 800 }}>{title}</div>
              {subtitle ? <div className="text-dim" style={{ fontSize: 12 }}>{subtitle}</div> : null}
              {!subtitle && <div className="text-dim" style={{ fontSize: 12 }}>No media linked</div>}
            </div>
          </div>
        )}
      </div>

      {/* Caption */}
      <div className="mt-2">
        <div style={{ fontWeight: 700 }}>{title}</div>
        {subtitle ? <div className="text-dim" style={{ fontSize: 12 }}>{subtitle}</div> : null}
      </div>
    </div>
  );
}
