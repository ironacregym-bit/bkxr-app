"use client";

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

export default function ProgramReviewStep({
  program,
  schedule,
  week_overrides,
  onBack,
  onCreate,
  creating,
}: {
  program: {
    name: string;
    start_date: string;
    weeks: number;
    assigned_to: string[];
  };
  schedule: ProgramScheduleItem[];
  week_overrides: WeekOverrides;
  onBack: () => void;
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <section className="futuristic-card p-3">
      <h6 className="mb-3">Review program</h6>

      <div className="mb-3">
        <div className="fw-semibold">{program.name}</div>
        <div className="text-dim small">
          Starts {program.start_date} • {program.weeks} weeks
        </div>

        <div className="text-dim small mt-1">
          Assigned to: {program.assigned_to.join(", ")}
        </div>
      </div>

      <hr />

      <div className="mb-3">
        <div className="fw-semibold mb-2">Weekly schedule</div>

        {schedule.length === 0 ? (
          <div className="text-dim small">No workouts assigned.</div>
        ) : (
          <ul className="list-unstyled small">
            {schedule
              .filter((s) => s.workout_id)
              .map((s) => (
                <li key={s.day_of_week}>
                  {s.day_of_week}:{" "}
                  <span className="text-dim">{s.workout_id}</span>
                </li>
              ))}
          </ul>
        )}
      </div>

      <hr />

      <div className="mb-3">
        <div className="fw-semibold mb-2">% overrides (summary)</div>

        {Object.keys(week_overrides).length === 0 ? (
          <div className="text-dim small">No overrides set.</div>
        ) : (
          <div className="small">
            {Object.entries(week_overrides).map(([workoutId, data]) => (
              <div key={workoutId} className="mb-2">
                <div className="fw-semibold">{workoutId}</div>
                <div className="text-dim">
                  Weeks overridden:{" "}
                  {Object.keys(data.weeks)
                    .map((w) => Number(w) + 1)
                    .join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="d-flex justify-content-between mt-4">
        <button
          className="btn btn-outline-light"
          style={{ borderRadius: 24 }}
          onClick={onBack}
          disabled={creating}
        >
          ← Back
        </button>

        <button
          className="btn btn-primary"
          style={{ borderRadius: 24 }}
          onClick={onCreate}
          disabled={creating}
        >
          {creating ? "Creating…" : "Create program"}
        </button>
      </div>
    </section>
  );
}
