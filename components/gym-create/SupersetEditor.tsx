"use client";

import React from "react";
import ExerciseSelect from "./ExerciseSelect";
import StrengthPrescriptionEditor, { StrengthSpec } from "./StrengthPrescriptionEditor";
import type { ExerciseRow, SupersetItem, SupersetSubItem } from "./GymCreateWorkout.constants";
import { neonButtonStyle } from "../iron-acre/theme";

export default function SupersetEditor({
  exercises,
  basisOptions,
  value,
  onChange,
  onDelete,
  onQuickAddSub,
}: {
  exercises: ExerciseRow[];
  basisOptions: string[];
  value: SupersetItem;
  onChange: (patch: Partial<SupersetItem>) => void;
  onDelete: () => void;
  onQuickAddSub: (subIdx: number) => void;
}) {
  function updateSub(subIdx: number, patch: Partial<SupersetSubItem>) {
    const items = [...(value.items || [])];
    items[subIdx] = { ...items[subIdx], ...patch };
    onChange({ items });
  }

  function addSub() {
    const items = [...(value.items || [])];
    items.push({
      uid: (globalThis.crypto as any)?.randomUUID?.() ?? `uid_${Math.random().toString(36).slice(2)}`,
      exercise_id: "",
      reps: "",
      weight_kg: null,
      strength: null,
    });
    onChange({ items });
  }

  function removeSub(subIdx: number) {
    const items = [...(value.items || [])];
    if (items.length <= 1) return;
    items.splice(subIdx, 1);
    onChange({ items });
  }

  return (
    <div className="row g-2 mb-2">
      <div className="col-12 col-md-4">
        <label className="form-label">Superset name</label>
        <input
          className="form-control"
          value={value.name ?? ""}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <div className="row mt-2 g-2">
          <div className="col-6">
            <label className="form-label">Sets (rounds)</label>
            <input
              className="form-control"
              type="number"
              min={1}
              value={Number.isFinite(value.sets) ? value.sets : 3}
              onChange={(e) => onChange({ sets: Math.max(1, Number(e.target.value) || 3) })}
            />
          </div>
          <div className="col-6">
            <label className="form-label">Rest between sets (s)</label>
            <input
              className="form-control"
              type="number"
              min={0}
              value={value.rest_s ?? ""}
              onChange={(e) => onChange({ rest_s: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="form-label">Instructions / notes</label>
          <textarea
            className="form-control"
            rows={3}
            value={value.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder='e.g. "Cluster: 4-4-4 with 15s intra-rest" or "Contrast: 80% then 60%"'
          />
        </div>
        <div className="mt-3">
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={onDelete}
            style={{ borderRadius: 12 }}
          >
            Delete superset
          </button>
        </div>
      </div>

      <div className="col-12 col-md-8">
        {(value.items || []).length ? (
          (value.items || []).map((s, sidx) => (
            <div key={s.uid} className="row g-2 align-items-end mb-2">
              <div className="col-12 col-md-5">
                <ExerciseSelect
                  exercises={exercises}
                  label="Exercise"
                  value={s.exercise_id}
                  onChange={(id) => updateSub(sidx, { exercise_id: id })}
                  onQuickAdd={() => onQuickAddSub(sidx)}
                />
              </div>

              <div className="col-6 col-md-3">
                <label className="form-label">Reps</label>
                <input
                  className="form-control"
                  value={s.reps ?? ""}
                  onChange={(e) => updateSub(sidx, { reps: e.target.value })}
                />
              </div>

              {!s.strength ? (
                <div className="col-4 col-md-2">
                  <label className="form-label">Weight (kg)</label>
                  <input
                    className="form-control"
                    type="number"
                    min={0}
                    value={s.weight_kg ?? ""}
                    onChange={(e) =>
                      updateSub(sidx, { weight_kg: Number(e.target.value) || null })
                    }
                  />
                </div>
              ) : (
                <div className="col-4 col-md-2">
                  <div className="text-dim small" style={{ paddingBottom: 6 }}>
                    Weight
                  </div>
                  <div className="text-dim small">%</div>
                </div>
              )}

              <div className="col-2 col-md-2 d-flex">
                <button
                  type="button"
                  className="btn btn-outline-danger ms-auto"
                  onClick={() => removeSub(sidx)}
                  title="Remove exercise"
                >
                  ✕
                </button>
              </div>

              <div className="col-12">
                <StrengthPrescriptionEditor
                  value={s.strength ?? null}
                  basisOptions={basisOptions}
                  onChange={(strength: StrengthSpec | null) =>
                    updateSub(sidx, { strength, weight_kg: null })
                  }
                />
              </div>
            </div>
          ))
        ) : (
          <div className="text-dim small">No exercises yet.</div>
        )}

        <button
          type="button"
          className="btn btn-sm"
          style={neonButtonStyle({ borderRadius: 24 })}
          onClick={addSub}
        >
          + Add Exercise to Superset
        </button>
      </div>
    </div>
  );
}
