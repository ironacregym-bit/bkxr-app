// File: components/gym-create/ExerciseSelect.tsx
"use client";

import React, { useMemo, useState } from "react";

type ExerciseRow = { id: string; exercise_name: string; type?: string };

type Props = {
  exercises: ExerciseRow[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  onQuickAdd: () => void;
  enableSearch?: boolean;
};

export default function ExerciseSelect({
  exercises,
  value,
  onChange,
  label = "Exercise",
  onQuickAdd,
  enableSearch = true,
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!enableSearch) return exercises;
    const query = q.trim().toLowerCase();
    if (!query) return exercises;

    return exercises.filter((e) => {
      const name = String(e.exercise_name || "").toLowerCase();
      const type = String(e.type || "").toLowerCase();
      return name.includes(query) || type.includes(query);
    });
  }, [exercises, q, enableSearch]);

  return (
    <div className="d-flex align-items-end gap-2">
      <div className="flex-fill">
        <label className="form-label">{label}</label>

        {enableSearch ? (
          <input
            className="form-control mb-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search exercises…"
          />
        ) : null}

        <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{exercises.length ? "— Select —" : "No exercises loaded"}</option>
          {filtered.map((e) => (
            <option key={e.id} value={e.id}>
              {e.exercise_name} {e.type ? `• ${e.type}` : ""}
            </option>
          ))}
        </select>

        <div className="text-dim small mt-1">
          {exercises.length ? `${filtered.length}/${exercises.length} shown` : "If this stays empty, /api/exercises is returning a different shape."}
        </div>
      </div>

      <button
        type="button"
        className="ia-btn ia-btn-outline"
        onClick={onQuickAdd}
        title="Quick add exercise"
        style={{ whiteSpace: "nowrap" }}
      >
        ＋ Quick add
      </button>
    </div>
  );
}
