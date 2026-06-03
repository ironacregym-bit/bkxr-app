// components/program-create/ProgramReviewStep.tsx
"use client";

import React, { useMemo } from "react";
import type { ProgramScheduleItem } from "./ProgramScheduleStep";

type ProgramReviewProgram = {
  name: string;
  weeks: number;
};

type WeekOverrides = {
  [workout_id: string]: {
    weeks: {
      [week: number]: {
        percent_1rm?: number | null;
      };
    };
  };
};

function dayLabel(day: string | number | null | undefined) {
  if (day === null || day === undefined || day === "") return "—";

  const n = typeof day === "number" ? day : Number(day);

  switch (n) {
    case 1:
      return "Monday";
    case 2:
      return "Tuesday";
    case 3:
      return "Wednesday";
    case 4:
      return "Thursday";
    case 5:
      return "Friday";
    case 6:
      return "Saturday";
    case 0:
      return "Sunday";
    default:
      return String(day);
  }
}

export default function ProgramReviewStep({
  program,
  schedule,
  week_overrides,
  onBack,
  onCreate,
  creating,
}: {
  program: ProgramReviewProgram;
  schedule: ProgramScheduleItem[];
  week_overrides: WeekOverrides;
  onBack: () => void;
  onCreate: () => void;
  creating?: boolean;
}) {
  const sortedSchedule = useMemo(() => {
    return [...(Array.isArray(schedule) ? schedule : [])].sort((a, b) => {
      const dayA = Number(a?.day_of_week ?? 99);
      const dayB = Number(b?.day_of_week ?? 99);

      if (dayA !== dayB) return dayA - dayB;

      const orderA = Number(a?.order ?? 0);
      const orderB = Number(b?.order ?? 0);

      return orderA - orderB;
    });
  }, [schedule]);

  const overrideCount = useMemo(() => {
    return Object.keys(week_overrides || {}).length;
  }, [week_overrides]);

  return (
    <section className="futuristic-card p-3">
      <h6 className="mb-3">Review program</h6>

      <div
        className="p-3 mb-3"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
        }}
      >
        <div className="row g-2">
          <div className="col-12 col-md-8">
            <div className="small text-dim">Program name</div>
            <div className="fw-semibold">{program.name || "—"}</div>
          </div>

          <div className="col-12 col-md-4">
            <div className="small text-dim">Length</div>
            <div className="fw-semibold">{program.weeks} weeks</div>
          </div>
        </div>
      </div>

      <div
        className="p-3 mb-3"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
        }}
      >
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="fw-semibold">Scheduled workouts</div>
          <div className="small text-dim">{sortedSchedule.length} items</div>
        </div>

        {sortedSchedule.length === 0 ? (
          <div className="text-dim small">No workouts added to this program yet.</div>
        ) : (
          <div className="d-grid gap-2">
            {sortedSchedule.map((item, idx) => (
              <div
                key={`${item.workout_id}-${item.day_of_week}-${item.order}-${idx}`}
                className="p-2"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                }}
              >
                <div className="fw-semibold">{item.workout_name || item.workout_id || "Workout"}</div>
                <div className="small text-dim">
                  {dayLabel(item.day_of_week)} • Order {item.order ?? 0}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="p-3 mb-3"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
        }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="fw-semibold">Progression overrides</div>
          <div className="small text-dim">{overrideCount} workout override sets</div>
        </div>

        <div className="small text-dim mt-2">
          {overrideCount > 0
            ? "This program includes week-by-week % overrides for one or more workouts."
            : "No week progression overrides set."}
        </div>
      </div>

      <div className="d-flex justify-content-between mt-3">
        <button
          type="button"
          className="btn btn-outline-light"
          style={{ borderRadius: 24 }}
          onClick={onBack}
          disabled={creating}
        >
          ← Back
        </button>

        <button
          type="button"
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
