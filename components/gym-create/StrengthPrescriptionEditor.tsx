"use client";

export type StrengthSpec = {
  basis_exercise?: string;
  percent_1rm?: number | null;
  percent_min?: number | null;
  percent_max?: number | null;
  rounding_kg?: number | null;
  mode?: "straight" | "top_set" | "backoff" | "emom" | "test" | null;
};

export default function StrengthPrescriptionEditor({
  value,
  onChange,
}: {
  value?: StrengthSpec | null;
  onChange: (v: StrengthSpec | null) => void;
}) {
  const enabled = !!value;

  return (
    <div
      className="mt-2 p-2"
      style={{
        border: "1px dashed rgba(255,255,255,0.25)",
        borderRadius: 12,
      }}
    >
      <div className="form-check form-switch mb-2">
        <input
          className="form-check-input"
          type="checkbox"
          checked={enabled}
          id="strengthSwitch"
          onChange={(e) =>
            onChange(
              e.target.checked
                ? {
                    basis_exercise: "",
                    percent_1rm: null,
                    rounding_kg: 2.5,
                  }
                : null
            )
          }
        />
        <label className="form-check-label" htmlFor="strengthSwitch">
          Use % of 1RM
        </label>
      </div>

      {!enabled ? null : (
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label">Basis exercise (1RM)</label>
            <input
              className="form-control"
              placeholder="e.g. Barbell Deadlift"
              value={value?.basis_exercise ?? ""}
              onChange={(e) =>
                onChange({ ...value!, basis_exercise: e.target.value })
              }
            />
            <small className="text-dim">
              Must match tracked strength exercise name
            </small>
          </div>

          <div className="col-md-3">
            <label className="form-label">% of 1RM</label>
            <input
              className="form-control"
              type="number"
              step="0.01"
              placeholder="0.80"
              value={value?.percent_1rm ?? ""}
              onChange={(e) =>
                onChange({
                  ...value!,
                  percent_1rm:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Rounding (kg)</label>
            <input
              className="form-control"
              type="number"
              step="0.5"
              placeholder="2.5"
              value={value?.rounding_kg ?? ""}
              onChange={(e) =>
                onChange({
                  ...value!,
                  rounding_kg:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
