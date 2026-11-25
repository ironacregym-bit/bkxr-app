"use client";

import useSWR from "swr";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type DayName = typeof DAYS[number];

type WorkoutRow = {
  workout_id: string;
  workout_name: string;
};

export type ProgramScheduleItem = {
  day_of_week: DayName;
  workout_id: string | null;
  order: number;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function ProgramScheduleStep({
  value,
  onChange,
  onBack,
  onNext,
}: {
  value: ProgramScheduleItem[];
  onChange: (v: ProgramScheduleItem[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { data } = useSWR("/api/workouts/admin/list", fetcher, {
    revalidateOnFocus: false,
  });

  const workouts: WorkoutRow[] = Array.isArray(data?.workouts) ? data.workouts : [];

  function setWorkout(day: DayName, workout_id: string | null) {
    const next = [...value];
    const idx = next.findIndex((d) => d.day_of_week === day);
    if (idx >= 0) {
      next[idx] = { ...next[idx], workout_id };
    } else {
      next.push({
        day_of_week: day,
        workout_id,
        order: next.length + 1,
      });
    }
    onChange(next);
  }

  function getWorkoutForDay(day: DayName) {
    return value.find((v) => v.day_of_week === day)?.workout_id ?? null;
  }

  return (
    <section className="futuristic-card p-3">
      <h6 className="mb-3">Weekly schedule</h6>

      <p className="text-dim small mb-3">
        Assign workouts to days of the week. Leave a day empty for rest.
      </p>

      <div className="row g-2">
        {DAYS.map((day) => (
          <div key={day} className="col-12 col-md-6">
            <label className="form-label">{day}</label>
            <select
              className="form-select"
              value={getWorkoutForDay(day) ?? ""}
              onChange={(e) => setWorkout(day, e.target.value || null)}
            >
              <option value="">— Rest / No workout —</option>
              {workouts.map((w) => (
                <option key={w.workout_id} value={w.workout_id}>
                  {w.workout_name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

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
          Next: Weekly progression →
        </button>
      </div>
    </section>
  );
}
``
