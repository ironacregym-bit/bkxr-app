"use client";

import React from "react";
import SingleExerciseEditor, { SingleItem } from "./SingleExerciseEditor";

export type GymRound = {
  name: string;
  order: number;
  items: SingleItem[];
};

function renumber(items: SingleItem[]): SingleItem[] {
  return items.map((it, i) => ({ ...it, order: i + 1 }));
}

export default function RoundEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: GymRound;
  onChange: (r: GymRound) => void;
}) {
  function addSingle() {
    const next: SingleItem = {
      uid: (globalThis.crypto as any)?.randomUUID?.() ?? `uid_${Math.random().toString(36).slice(2)}`,
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
    <section className="futuristic-card p-3 mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="m-0">{title}</h6>

        <button
          type="button"
          className="btn btn-sm"
          style={{ borderRadius: 24 }}
          onClick={addSingle}
        >
          + Single
        </button>
      </div>

      {(value.items || []).length === 0 ? (
        <div className="small text-dim">No exercises yet.</div>
      ) : (
        (value.items || []).map((it, idx) => (
          <SingleExerciseEditor
            key={it.uid}
            value={it}
            onChange={(patch) => updateItem(idx, patch)}
            onDelete={() => removeItem(idx)}
          />
        ))
      )}
    </section>
  );
}
