// File: components/gym-create/QuickAddExerciseModal.tsx
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
      style={{ background: "rgba(0,0,0,0.62)", zIndex: 1050 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="position-absolute top-50 start-50 translate-middle" style={{ width: "92vw", maxWidth: 720 }}>
        <div className="ia-tile ia-tile-pad" onClick={(e) => e.stopPropagation()}>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="ia-tile-title">Quick add exercise</div>
            <button className="ia-btn ia-btn-outline" onClick={onClose} disabled={busy} style={{ borderRadius: 999 }}>
              ✕
            </button>
          </div>

          {error ? <div className="alert alert-danger py-2 mb-3">{error}</div> : null}

          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Exercise name</label>
              <input
                className="form-control"
                value={form.exercise_name}
                onChange={(e) => setForm((f) => ({ ...f, exercise_name: e.target.value }))}
                placeholder="e.g. Barbell Row"
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label">Type</label>
              <input
                className="form-control"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                placeholder="e.g. Pull"
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label">Equipment</label>
              <input
                className="form-control"
                value={form.equipment}
                onChange={(e) => setForm((f) => ({ ...f, equipment: e.target.value }))}
                placeholder="e.g. Barbell"
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
                placeholder="e.g. 6.0"
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
            <button className="ia-btn ia-btn-outline" onClick={onClose} disabled={busy}>
              Cancel
            </button>

            <button
              className="ia-btn ia-btn-primary"
              onClick={onSave}
              disabled={busy}
              style={{
                background: `linear-gradient(90deg, ${accent}, var(--ia-neon2))`,
              }}
            >
              {busy ? "Saving…" : "Save & select"}
            </button>
          </div>

          <div className="small text-dim mt-2">
            Need the full editor instead?{" "}
            <Link href="/admin/exercises/create" className="ia-link" style={{ display: "inline" }} </div>
        </div>
      </div>
    </div>
  );
}
