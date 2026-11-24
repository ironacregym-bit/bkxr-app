// File: components/gym-create/RoundEditor.tsx
"use client";

import React from "react";
import SingleExerciseEditor, { SingleItem } from "./SingleExerciseEditor";
import type { ExerciseRow } from "./GymCreateWorkout.constants";

export type GymRound = {
  name: string;
  order: number;
  items: SingleItem[];
};

function renumber(items: SingleItem[]): SingleItem[] {
  return items.map((it, i) => ({ ...it, order: i + 1 }));
}

function newUid() {
  return (globalThis.crypto as any)?.randomUUID?.() ?? `uid_${Math.random().toString(36).slice(2)}`;
}

export default function RoundEditor({
  title,
  value,
  exercises,
  basisOptions,
  onChange,
  onQuickAddSingle,
}: {
  title: string;
  value: GymRound;
  exercises: ExerciseRow[];
  basisOptions?: string[];
  onChange: (r: GymRound) => void;
  onQuickAddSingle: (idx: number) => void;
}) {
  function addSingle() {
    const next: SingleItem = {
      uid: newUid(),
      type: "Single",
      order: (value.items?.length || 0) + 1,
      exercise_id: "",
      sets: 3,
      reps: "",
      weight_kg: null,
      rest_s: null,
      notes: null,
      strength: null,
    };

    onChange({
      ...value,
      name: value.name || title,
      items: renumber([...(value.items || []), next]),
    });
  }

  function updateItem(idx: number, patch: Partial<SingleItem>) {
    const items = (value.items || []).map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange({ ...value, items });
  }

  function removeItem(idx: number) {
    const items = renumber((value.items || []).filter((_, i) => i !== idx));
    onChange({ ...value, items });
  }

  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="ia-tile-title">{title}</div>

        <button type="button" className="ia-btn ia-btn-primary" onClick={addSingle}>
          + Single
        </button>
      </div>

      {(value.items || []).length === 0 ? (
        <div className="small text-dim">No exercises yet.</div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {(value.items || []).map((it, idx) => (
            <SingleExerciseEditor
              key={it.uid}
              value={it}
              exercises={exercises}
              basisOptions={basisOptions}
              onChange={(patch) => updateItem(idx, patch)}
              onDelete={() => removeItem(idx)}
              onQuickAdd={() => onQuickAddSingle(idx)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
