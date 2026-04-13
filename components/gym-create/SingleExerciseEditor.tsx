"use client";

import StrengthPrescriptionEditor, {
  StrengthSpec,
} from "./StrengthPrescriptionEditor";

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
  onChange,
  onDelete,
}: {
  value: SingleItem;
  onChange: (patch: Partial<SingleItem>) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="mb-3 p-3"
      style={{
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 14,
      }}
    >
      <div className="row g-2 align-items-end">
        <div className="col-md-4">
          <label className="form-label">Exercise</label>
          <input
            className="form-control"
            placeholder="e.g. Barbell Deadlift"
            value={value.exercise_id}
            onChange={(e) => onChange({ exercise_id: e.target.value })}
          />
        </div>

        <div className="col-md-2">
          <label className="form-label">Sets</label>
          <input
            className="form-control"
            type="number"
            min={1}
            value={value.sets ?? ""}
            onChange={(e) =>
              onChange({
                sets: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          />
        </div>

        <div className="col-md-3">
          <label className="form-label">Reps</label>
          <input
            className="form-control"
            placeholder="e.g. 5 or 5-3-1"
            value={value.reps ?? ""}
            onChange={(e) => onChange({ reps: e.target.value })}
          />
        </div>

        {!value.strength && (
          <div className="col-md-2">
            <label className="form-label">Weight (kg)</label>
            <input
              className="form-control"
              type="number"
              min={0}
              value={value.weight_kg ?? ""}
              onChange={(e) =>
                onChange({
                  weight_kg:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
        )}

        <div className="col-md-1 d-flex">
          <button
            type="button"
            className="btn btn-outline-danger ms-auto"
            onClick={onDelete}
            title="Remove exercise"
          >
            ✕
          </button>
        </div>
      </div>

      <StrengthPrescriptionEditor
        value={value.strength}
        onChange={(strength) =>
          onChange({
            strength,
            weight_kg: null, // 🔒 enforce mutually exclusive state
          })
        }
      />
    </div>
  );
}
