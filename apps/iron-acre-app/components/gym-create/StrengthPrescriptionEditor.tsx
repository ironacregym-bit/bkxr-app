"use client";

import React, { useId } from "react";
import useSWR from "swr";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export type StrengthSpec = {
  basis_exercise?: string;
  percent_1rm?: number | null;
  percent_min?: number | null;
  percent_max?: number | null;
  rounding_kg?: number | null;
  mode?: "straight" | "top_set" | "backoff" | "emom" | "test" | null;
};

type StrengthExercisesResp = {
  ok?: boolean;
  exercises?: Array<{ id: string; exercise_name: string }>;
  names?: string[];
};

export default function StrengthPrescriptionEditor({
  value,
  onChange,
  // Optional: allow parent to pass basis options if it already has them
  basisOptions,
}: {
  value?: StrengthSpec | null;
  onChange: (v: StrengthSpec | null) => void;
  basisOptions?: string[];
}) {
  const switchId = useId();

  // Always call SWR (no conditional hooks); disable fetch by passing null key if parent supplies options
  const swrKey = basisOptions && basisOptions.length ? null : "/api/strength/exercises/list";
  const { data } = useSWR<StrengthExercisesResp>(swrKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const enabled = !!value;

  const options: string[] =
    (basisOptions && basisOptions.length ? basisOptions : undefined) ??
    (Array.isArray(data?.names) ? data!.names! : []) ??
    [];

  const hasOptions = options.length > 0;

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
          id={switchId}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? {
                    basis_exercise: "",
                    percent_1rm: null,
                    percent_min: null,
                    percent_max: null,
                    rounding_kg: 2.5,
                    mode: "straight",
                  }
                : null
            )
          }
        />
        <label className="form-check-label" htmlFor={switchId}>
          Use % of 1RM
        </label>
      </div>

      {!enabled ? null : (
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label">Basis exercise (1RM)</label>

            {hasOptions ? (
              <select
                className="form-select"
                value={value?.basis_exercise ?? ""}
                onChange={(e) => onChange({ ...value!, basis_exercise: e.target.value })}
              >
                <option value="">— Select —</option>
                {options.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="form-control"
                placeholder="e.g. Front Squat"
                value={value?.basis_exercise ?? ""}
                onChange={(e) => onChange({ ...value!, basis_exercise: e.target.value })}
              />
            )}

            <small className="text-dim">
              This is the lift whose 1RM/training max will drive the target kg.
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
                  percent_1rm: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <small className="text-dim">Example: 0.75 = 75%</small>
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
                  rounding_kg: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>

          <div className="col-12">
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-light"
                style={{ borderRadius: 24 }}
                onClick={() => onChange(null)}
              >
                Remove % prescription
              </button>

              <div className="text-dim small d-flex align-items-center">
                Tip: Use this for “Thruster @ 75% Front Squat” by setting basis to Front Squat.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
