"use client";

import Link from "next/link";
import React from "react";

type QuickForm = {
  exercise_name: string;
  type: string;
  equipment: string;
  video_url: string;
  met_value: string | number;
  description: string;
};

export default function QuickAddExerciseModal({
  open,
  accent,
  busy,
  error,
  form,
  setForm,
  onClose,
  onSave,
}: {
  open: boolean;
  accent: string;
  busy: boolean;
  error: string | null;
  form: QuickForm;
  setForm: (updater: (prev: QuickForm) => QuickForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{ background: "rgba(0,0,0,0.6)", zIndex: 1050 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="position-absolute top-50 start-50 translate-middle" style={{ width: "92vw", maxWidth: 680 }}>
        <div className="futuristic-card p-3" onClick={(e) => e.stopPropagation()}>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="m-0">Quick add exercise</h5>
            <button className="btn btn-sm btn-outline-light" style={{ borderRadius: 999 }} onClick={onClose}>
              ✕
            </button>
          </div>

          {error ? <div className="alert alert-danger py-2">{error}</div> : null}

          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Exercise name</label>
              <input
                className="form-control"
                value={form.exercise_name}
                onChange={(e) => setForm((f) => ({ ...f, exercise_name: e.target.value }))}
                placeholder="e.g., Barbell Row"
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label">Type</label>
              <input
                className="form-control"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                placeholder="e.g., Pull"
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label">Equipment</label>
              <input
                className="form-control"
                value={form.equipment}
                onChange={(e) => setForm((f) => ({ ...f, equipment: e.target.value }))}
                placeholder="e.g., Barbell"
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Video URL</label>
              <input
                className="form-control"
                value={form.video_url}
                onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                placeholder="https://…"
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label">MET value (optional)</label>
              <input
                className="form-control"
                type="number"
                step="0.1"
                value={form.met_value}
                onChange={(e) => setForm((f) => ({ ...f, met_value: e.target.value }))}
                placeholder="e.g., 6.0"
              />
            </div>

            <div className="col-12">
              <label className="form-label">Description (optional)</label>
              <textarea
                className="form-control"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Coaching cues, setup, safety…"
              />
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-3">
            <button className="btn btn-outline-light" style={{ borderRadius: 24 }} onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{
                borderRadius: 24,
                background: `linear-gradient(135deg, ${accent}, #ff7f32)`,
                border: "none",
              }}
              onClick={onSave}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save & select"}
            </button>
          </div>

          <div className="small text-dim mt-2">
            Need the full editor instead?{" "}
            <Link href="/admin/exercises/create">
              Open Create Exercise
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
