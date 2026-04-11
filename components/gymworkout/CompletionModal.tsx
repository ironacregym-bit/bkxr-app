import React from "react";
import { ACCENT } from "./utils";

type CompletionModalProps = {
  open: boolean;
  submitting: boolean;

  difficulty: string;
  setDifficulty: (v: string) => void;

  calories: string;
  setCalories: (v: string) => void;

  duration: string;
  setDuration: (v: string) => void;

  notes: string;
  setNotes: (v: string) => void;

  onClose: () => void;
  onSave: () => void;
};

export default function CompletionModal({
  open,
  submitting,
  difficulty,
  setDifficulty,
  calories,
  setCalories,
  duration,
  setDuration,
  notes,
  setNotes,
  onClose,
  onSave,
}: CompletionModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{ background: "rgba(0,0,0,0.65)", zIndex: 1050 }}
      onClick={(e) => {
        if ((e.target as HTMLElement).dataset?.scrim === "1") onClose();
      }}
      data-scrim="1"
    >
      <div
        className="position-absolute top-50 start-50 translate-middle"
        style={{ width: "92vw", maxWidth: 720 }}
      >
        <div className="futuristic-card p-3" onClick={(e) => e.stopPropagation()}>
          <div className="d-flex align-items-center justify-content-between">
            <h5 className="m-0">Complete workout</h5>
            <button
              className="btn btn-sm btn-outline-light"
              style={{ borderRadius: 999 }}
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          <div className="small text-dim mt-1">
            We’ll save your logged sets. Add{" "}
            <strong>Difficulty</strong> and{" "}
            <strong>Calories burnt</strong> for better tracking.
          </div>

          <div className="row g-2 mt-3">
            <div className="col-12 col-md-4">
              <label className="form-label">Difficulty</label>
              <select
                className="form-select"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="">—</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div className="col-6 col-md-4">
              <label className="form-label">Calories burnt (kcal)</label>
              <input
                className="form-control"
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="e.g. 420"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </div>

            <div className="col-6 col-md-4">
              <label className="form-label">Duration (min)</label>
              <input
                className="form-control"
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="e.g. 55"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>

            <div className="col-12">
              <label className="form-label">Notes (optional)</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Anything to note…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-3">
            <button
              className="btn btn-outline-light"
              style={{ borderRadius: 24 }}
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              className="btn btn-primary"
              style={{
                borderRadius: 24,
                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                border: "none",
                fontWeight: 700,
              }}
              onClick={onSave}
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Save completion"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
