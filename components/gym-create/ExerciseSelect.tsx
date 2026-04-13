"use client";

import React from "react";

type ExerciseRow = { id: string; exercise_name: string; type?: string };

export default function ExerciseSelect({
  exercises,
  value,
  onChange,
  label = "Exercise",
  onQuickAdd,
}: {
  exercises: ExerciseRow[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  onQuickAdd: () => void;
}) {
  return (
    <div className="d-flex align-items-end gap-2">
      <div className="flex-fill">
        <label className="form-label">{label}</label>
        <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Select —</option>
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.exercise_name} {e.type ? `• ${e.type}` : ""}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="btn btn-sm btn-outline-light"
        style={{ borderRadius: 24, whiteSpace: "nowrap" }}
        onClick={onQuickAdd}
        title="Quick add exercise"
      >
        ＋ Quick add
      </button>
    </div>
  );
}
