import React, { useState } from "react";

const ACCENT = "#FF8A2A";

export type CheckinCardProps = {
  week?: string;
  updated?: string;
  weight?: number;
  stress?: string;
  goalsAchieved?: string;
  notes?: string;
  nextGoals?: string;
  photos: {
    front?: string;
    side?: string;
    back?: string;
  };
};

export default function CheckinCard({
  week,
  updated,
  weight,
  stress,
  goalsAchieved,
  notes,
  nextGoals,
  photos,
}: CheckinCardProps) {
  const [showPhotos, setShowPhotos] = useState(false);
  const hasPhotos = Object.values(photos).some(Boolean);

  return (
    <div
      className="p-3"
      style={{
        background: "rgba(255,255,255,0.06)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="fw-semibold mb-1" style={{ color: "#fff" }}>
        Week ending <span style={{ color: ACCENT }}>{week || "—"}</span>
      </div>
      <div className="small text-muted mb-2">
        Updated {updated ? new Date(updated).toLocaleString() : "—"}
      </div>

      <div className="row g-2 mb-2">
        <div className="col-6 col-md-3">
          <div className="small text-muted">Weight</div>
          <div className="fw-semibold">{weight ?? "—"}</div>
        </div>
        <div className="col-6 col-md-3">
          <div className="small text-muted">Stress</div>
          <div className="fw-semibold">{stress ?? "—"}</div>
        </div>
        <div className="col-6 col-md-3">
          <div className="small text-muted">Goals Achieved</div>
          <div className="fw-semibold">{goalsAchieved ?? "—"}</div>
        </div>
      </div>

      {notes && (
        <div className="mb-2">
          <div className="small text-muted">Notes</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{notes}</div>
        </div>
      )}
      {nextGoals && (
        <div className="mb-2">
          <div className="small text-muted">Next week goals</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{nextGoals}</div>
        </div>
      )}

      {hasPhotos && (
        <>
          <button
            className="btn btn-sm btn-outline-secondary mt-2"
            onClick={() => setShowPhotos((v) => !v)}
          >
            {showPhotos ? "Hide photos" : "Show progress photos"}
          </button>

          {showPhotos && (
            <div className="row g-2 mt-2">
              {photos.front && <PhotoThumb label="Front" src={photos.front} />}
              {photos.side && <PhotoThumb label="Side" src={photos.side} />}
              {photos.back && <PhotoThumb label="Back" src={photos.back} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PhotoThumb({ label, src }: { label: string; src: string }) {
  return (
    <div className="col-12 col-md-4">
      <div className="small text-muted mb-1">{label}</div>
      <img
        src={src}
        alt={`${label} progress`}
        loading="lazy"
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      />
    </div>
  );
}
