"use client";

import React from "react";
import { ProgramScheduleItem } from "./ProgramScheduleStep";

type WeekOverrides = {
  [workout_id: string]: {
    weeks: {
      [week: number]: {
        percent_1rm?: number | null;
      };
    };
  };
};

export default function ProgramProgressionStep({
  weeks,
  schedule,
  value,
  onChange,
  onBack,
  onNext,
}: {
  weeks: number;
  schedule: ProgramScheduleItem[];
  value: WeekOverrides;
  onChange: (v: WeekOverrides) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const scheduled = schedule.filter((s) => s.workout_id);

  function setPercent(workoutId: string, week: number, percent: number | null) {
    const current = value[workoutId]?.weeks ?? {};
    onChange({
      ...value,
      [workoutId]: {
        weeks: {
          ...current,
          [week]: { percent_1rm: percent },
        },
      },
    });
  }

  function getPercent(workoutId: string, week: number): number | null {
    return value[workoutId]?.weeks?.[week]?.percent_1rm ?? null;
  }

  return (
    <section className="futuristic-card p-3">
      <h6 className="mb-2">Weekly % progression</h6>

      <p className="text-dim small mb-3">
        Override % of 1RM by week. Leave blank to use the workout’s base %.
      </p>

      {scheduled.length === 0 ? (
        <div className="text-dim small">No workouts scheduled.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table table-dark table-sm align-middle">
            <thead>
              <tr>
                <th style={{ minWidth: 160 }}>Workout</th>
                {Array.from({ length: weeks }).map((_, w) => (
                  <th key={w} className="text-center">
                    W{w + 1}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {scheduled.map((s) => (
                <tr key={s.workout_id!}>
                  <td>
                    <div className="fw-semibold">{s.workout_id}</div>
                    <div className="text-dim small">{s.day_of_week}</div>
                  </td>

                  {Array.from({ length: weeks }).map((_, w) => (
                    <td key={w} className="text-center">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1.5"
                        className="form-control form-control-sm text-center"
                        style={{ minWidth: 72 }}
                        placeholder="—"
                        value={getPercent(s.workout_id!, w) ?? ""}
                        onChange={(e) =>
                          setPercent(
                            s.workout_id!,
                            w,
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="d-flex justify-content-between mt-4">
        <button
          className="btn btn-outline-light"
          style={{ borderRadius: 24 }}
          onClick={onBack}
        >
          ← Back
        </button>

        <button
          className="btn btn-primary"
          style={{ borderRadius: 24 }}
          onClick={onNext}
        >
          Next: Review →
        </button>
      </div>
    </section>
  );
}
