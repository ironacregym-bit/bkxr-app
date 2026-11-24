// File: components/gymworkout/CompletionModal.tsx

import React from "react";
import { GREEN } from "./utils";

type CompletionModalProps = {
  open: boolean;
  submitting: boolean;

  // ✅ New
  isEditing?: boolean;

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
  isEditing = false,

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
        style={{ width: "92vw", maxWidth: 520 }}
      >
        <div className="futuristic-card p-3" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="d-flex align-items-center justify-content-between">
            <h5 className="m-0">
              {isEditing ? "Edit workout" : "Complete workout"}
            </h5>

            <button
              className="btn btn-sm btn-outline-light"
              style={{ borderRadius: 999 }}
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          {/* Subtext */}
          <div className="small text-dim mt-1">
            {isEditing
              ? "Update your stats if anything needs correcting."
              : "Add a few details to finish your session."}
          </div>

          {/* Inputs */}
          <div className="d-flex flex-column gap-2 mt-3">
            {/* Difficulty */}
            <div>
              <label className="form-label small text-dim mb-1">Difficulty</label>
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

            {/* Calories + Duration row */}
            <div className="d-flex gap-2">
              <div style={{ flex: 1 }}>
                <label className="form-label small text-dim mb-1">
                  Calories
                </label>
                <input
                  className="form-control"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder="420"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label className="form-label small text-dim mb-1">
                  Duration
                </label>
                <input
                  className="form-control"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder="55"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="form-label small text-dim mb-1">Notes</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Anything to note…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
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
              className="btn"
              style={{
                borderRadius: 24,
                background: GREEN,
                color: "#0b0f14",
                fontWeight: 700,
                paddingLeft: 16,
                paddingRight: 16,
              }}
              onClick={onSave}
              disabled={submitting}
            >
              {submitting
                ? "Saving…"
                : isEditing
                ? "Save changes"
                : "Save completion"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
