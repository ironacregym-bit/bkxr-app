// File: components/gym-create/SingleExerciseEditor.tsx
"use client";

import React from "react";
import StrengthPrescriptionEditor, { StrengthSpec } from "./StrengthPrescriptionEditor";
import ExerciseSelect from "./ExerciseSelect";
import type { ExerciseRow } from "./GymCreateWorkout.constants";

export type SingleItem = {
  uid: string;
  type: "Single";
  order: number;
  exercise_id: string;
  sets?: number;
  reps?: string;
  weight_kg?: number | null;
  rest_s?: number | null;
  notes?: string | null;
  strength?: StrengthSpec | null;
};

export default function SingleExerciseEditor({
  value,
  exercises,
  onChange,
  onDelete,
  onQuickAdd,
  basisOptions,
}: {
  value: SingleItem;
  exercises: ExerciseRow[];
  onChange: (patch: Partial<SingleItem>) => void;
  onDelete: () => void;
  onQuickAdd: () => void;
  /** Optional: tracked strength exercise names so the basis exercise uses a dropdown */
  basisOptions?: string[];
}) {
  return (
    <div
      className="p-3"
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div className="row g-2 align-items-end">
        <div className="col-12 col-md-5">
          <ExerciseSelect
            exercises={exercises}
            label="Exercise"
            value={value.exercise_id}
            onChange={(id) => onChange({ exercise_id: id })}
            onQuickAdd={onQuickAdd}
          />
        </div>

        <div className="col-6 col-md-2">
          <label className="form-label">Sets</label>
          <input
            className="form-control"
            type="number"
            min={1}
            value={value.sets ?? ""}
            onChange={(e) =>
              onChange({
                sets: e.target.value === "" ? undefined : Math.max(1, Number(e.target.value) || 1),
              })
            }
          />
        </div>

        <div className="col-6 col-md-3">
          <label className="form-label">Reps</label>
          <input
            className="form-control"
            placeholder="e.g. 5 or 5-3-1 or 4-4-4"
            value={value.reps ?? ""}
            onChange={(e) => onChange({ reps: e.target.value })}
          />
        </div>

        {!value.strength ? (
          <div className="col-8 col-md-2">
            <label className="form-label">Weight (kg)</label>
            <input
              className="form-control"
              type="number"
              min={0}
              value={value.weight_kg ?? ""}
              onChange={(e) => onChange({ weight_kg: e.target.value === "" ? null : Number(e.target.value) || null })}
            />
          </div>
        ) : (
          <div className="col-8 col-md-2">
            <div className="text-dim small" style={{ paddingBottom: 6 }}>
              Weight
            </div>
            <div className="text-dim small">%</div>
          </div>
        )}

        <div className="col-4 col-md-12 d-flex justify-content-end">
          <button type="button" className="ia-btn ia-btn-outline" onClick={onDelete} title="Remove exercise">
            ✕ Remove
          </button>
        </div>
      </div>

      <div className="mt-2">
        <StrengthPrescriptionEditor
          value={value.strength}
          basisOptions={basisOptions}
          onChange={(strength) =>
            onChange({
              strength,
              weight_kg: null, // enforce mutually exclusive state
            })
          }
        />
      </div>

      <div className="mt-2">
        <label className="form-label">Notes / instructions</label>
        <textarea
          className="form-control"
          rows={2}
          value={value.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder='e.g. "Cluster: 4-4-4 with 15s intra-set rest" or "Tempo: 3-1-1"'
        />
      </div>
    </div>
  );
}
