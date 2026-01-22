
// components/workouts/ModalMedia.tsx
"use client";

export default function ModalMedia({
  open,
  onClose,
  title,
  gifUrl,
  videoUrl,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  gifUrl?: string;
  videoUrl?: string;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{ background: "rgba(0,0,0,0.7)", zIndex: 1050 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="futuristic-card p-2"
        style={{
          maxWidth: 560,
          margin: "8vh auto",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.18)",
        }}
      >
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="fw-semibold">{title}</div>
          <button className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }} onClick={onClose}>Close</button>
        </div>
        <div className="ratio ratio-16x9" style={{ borderRadius: 12, overflow: "hidden" }}>
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
          ) : (
            <div className="d-flex align-items-center justify-content-center" style={{ color: "#cfd7df" }}>
              No media available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
