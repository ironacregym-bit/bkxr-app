// components/iron-acre/IronAcreWorkoutCard.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type WorkoutItem =
  | {
      type: "Single";
      exercise_id: string;
      exercise_name?: string;
      sets?: number | null;
      reps?: string | null;
    }
  | {
      type: "Superset";
      items: {
        exercise_id: string;
        exercise_name?: string;
        reps?: string | null;
      }[];
      sets?: number | null;
    };

type Round = {
  name: string;
  order: number;
  items: WorkoutItem[];
};

type Workout = {
  workout_id: string;
  workout_name: string;
  focus?: string | null;
  notes?: string | null;
  warmup?: Round | null;
  main: Round;
  finisher?: Round | null;
};

type SimpleWorkoutRef = {
  id: string;
  name?: string;
  order?: number;
  programId?: string;
};

type DayOverview = {
  dateKey: string;
  hasWorkout?: boolean;
  workoutDone?: boolean;
  workoutIds?: string[];
  programmedWorkouts?: SimpleWorkoutRef[];
  hasRecurringToday?: boolean;
  recurringWorkouts: SimpleWorkoutRef[];
  recurringDone: boolean;
  optionalWorkouts?: SimpleWorkoutRef[];
};

type WeeklyTotals = {
  totalTasks: number;
  completedTasks: number;
  totalWorkoutsCompleted: number;
  totalWorkoutTime: number;
  totalCaloriesBurned: number;
};

type WeekRow = {
  ymd: string;
  day: string;
  workouts: SimpleWorkoutRef[];
  done: boolean;
};

type WeekRows = {
  pending: WeekRow[];
  completed: WeekRow[];
};

type IronAcreWorkoutCardProps = {
  title: string;
  workout: Workout | null;
  workoutId: string;
  done: boolean;
  durationMinutes?: number | null;
  dateKey: string;
  weekDays: DayOverview[];
  weekStartYMD: string;
  weekEndYMD: string;
  weeklyTotals?: WeeklyTotals;
  hasWorkoutToday: boolean;
};

function flattenExercisesWithReps(workout?: Workout | null): Array<{ name: string; reps?: string | null }> {
  if (!workout) return [];

  const rounds: Round[] = [];
  if (workout.warmup) rounds.push(workout.warmup);
  if (workout.main) rounds.push(workout.main);
  if (workout.finisher) rounds.push(workout.finisher);

  const out: Array<{ name: string; reps?: string | null }> = [];

  for (const round of rounds) {
    for (const item of round.items || []) {
      if (item.type === "Single") {
        out.push({
          name: item.exercise_name || item.exercise_id,
          reps: item.reps ?? null,
        });
      } else {
        for (const supersetItem of item.items || []) {
          out.push({
            name: supersetItem.exercise_name || supersetItem.exercise_id,
            reps: supersetItem.reps ?? null,
          });
        }
      }
    }
  }

  return out;
}

function estimateSets(workout?: Workout | null): number {
  if (!workout) return 0;

  const rounds: Round[] = [];
  if (workout.warmup) rounds.push(workout.warmup);
  if (workout.main) rounds.push(workout.main);
  if (workout.finisher) rounds.push(workout.finisher);

  let total = 0;

  for (const round of rounds) {
    for (const item of round.items || []) {
      if (item.type === "Single") {
        total += Number(item.sets ?? 3);
      } else {
        total += Number(item.sets ?? 3) * (item.items?.length || 1);
      }
    }
  }

  return total;
}

function dayLabelFromYMD(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function refsFromIds(ids: string[]): SimpleWorkoutRef[] {
  return (ids || []).map((id) => ({ id: String(id) }));
}

function workoutsForWeekDay(day: DayOverview): SimpleWorkoutRef[] {
  const recurring = day.recurringWorkouts || [];
  if (recurring.length) return recurring;

  const programmed = day.programmedWorkouts || [];
  if (programmed.length) return programmed;

  const optional = day.optionalWorkouts || [];
  if (optional.length) return optional;

  const ids = day.workoutIds || [];
  if (ids.length) return refsFromIds(ids);

  return [];
}

function doneForWeekDay(day: DayOverview): boolean {
  const recurring = day.recurringWorkouts || [];
  if (recurring.length) return Boolean(day.recurringDone);

  const programmed = day.programmedWorkouts || [];
  if (programmed.length) return Boolean(day.workoutDone);

  const ids = day.workoutIds || [];
  if (ids.length) return Boolean(day.workoutDone);

  const optional = day.optionalWorkouts || [];
  if (optional.length) return Boolean(day.workoutDone);

  return false;
}

function buildWeekRows(
  weekDays: DayOverview[],
  dateKey: string,
  activeWorkoutId: string,
  done: boolean
): WeekRows {
  const rows: WeekRow[] = (weekDays || [])
    .map((day) => {
      const workouts = workoutsForWeekDay(day);
      const rowDone = day.dateKey === dateKey ? Boolean(done) : doneForWeekDay(day);

      const filtered = workouts.filter((workoutRef) => {
        const isToday = day.dateKey === dateKey;
        const isSameWorkout = Boolean(activeWorkoutId) && workoutRef.id === activeWorkoutId;

        if (isToday && isSameWorkout && !rowDone) return false;
        return true;
      });

      return {
        ymd: day.dateKey,
        day: dayLabelFromYMD(day.dateKey),
        workouts: filtered,
        done: rowDone,
      };
    })
    .filter((row) => row.workouts.length > 0);

  return {
    pending: rows.filter((row) => !row.done),
    completed: rows.filter((row) => row.done),
  };
}

export default function IronAcreWorkoutCard({
  title,
  workout,
  workoutId,
  done,
  durationMinutes,
  dateKey,
  weekDays,
  weekStartYMD,
  weekEndYMD,
  weeklyTotals,
  hasWorkoutToday,
}: IronAcreWorkoutCardProps) {
  const todaysDay = useMemo(() => {
    return (weekDays || []).find((day) => day.dateKey === dateKey);
  }, [weekDays, dateKey]);

  const todaysRefs = useMemo(() => {
    return todaysDay ? workoutsForWeekDay(todaysDay) : [];
  }, [todaysDay]);

  const resolvedWorkoutId = useMemo(() => {
    if (todaysRefs.length > 0) {
      return String(todaysRefs[0]?.id || "");
    }
    return workoutId;
  }, [todaysRefs, workoutId]);

  const resolvedHasWorkoutToday = useMemo(() => {
    if (todaysRefs.length > 0) return true;
    return hasWorkoutToday;
  }, [todaysRefs, hasWorkoutToday]);

  const flat = useMemo(() => flattenExercisesWithReps(workout), [workout]);
  const exCount = flat.length;
  const setCount = useMemo(() => estimateSets(workout), [workout]);

  const [showWeek, setShowWeek] = useState(false);
  const [showExercises, setShowExercises] = useState(false);

  const weekRows = useMemo(() => {
    return buildWeekRows(weekDays, dateKey, resolvedWorkoutId, done);
  }, [weekDays, dateKey, resolvedWorkoutId, done]);

  const startHref = resolvedWorkoutId
    ? `/gymworkout/${encodeURIComponent(resolvedWorkoutId)}?date=${encodeURIComponent(dateKey)}`
    : "#";

  const titleText = workout?.workout_name || todaysRefs?.[0]?.name || title || "Gym session";

  const subtitleText = (
    workout?.focus ||
    workout?.notes ||
    "Get today’s session done and keep the week moving."
  ).toString();

  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="ia-kicker">
          <i className="fas fa-dumbbell" />
          TODAY’S WORKOUT
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
          {flat.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowExercises((v) => !v)}
              className="ia-btn ia-btn-outline"
              title="Toggle workout exercises"
            >
              <i className={`fas fa-chevron-${showExercises ? "up" : "down"}`} />
              Exercises
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setShowWeek((v) => !v)}
            className="ia-btn ia-btn-outline"
            title="Toggle this week"
          >
            <i className={`fas fa-chevron-${showWeek ? "up" : "down"}`} />
            This week
          </button>
        </div>
      </div>

      {!resolvedHasWorkoutToday ? (
        <>
          <div className="ia-page-title">No workout scheduled today</div>
          <div className="text-dim small mt-1">
            Check the “This week” section for upcoming sessions.
          </div>
        </>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="ia-page-title">{titleText}</div>

            {done ? (
              <span className="ia-badge ia-badge-neon d-inline-flex align-items-center gap-1">
                <i className="fas fa-check" />
                Completed
              </span>
            ) : null}
          </div>

          <div className="text-dim small mt-1">{subtitleText}</div>

          <div
            className="d-flex justify-content-between text-center mt-3"
            style={{
              gap: 10,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 14,
              padding: "10px 12px",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--ia-neon)", fontWeight: 700, fontSize: "1.05rem" }}>
                {exCount || "—"}
              </div>
              <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
                EXERCISES
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--ia-neon2)", fontWeight: 700, fontSize: "1.05rem" }}>
                {setCount || "—"}
              </div>
              <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
                SETS
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--ia-neon)", fontWeight: 700, fontSize: "1.05rem" }}>
                {durationMinutes ?? "—"} {durationMinutes != null ? "min" : ""}
              </div>
              <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
                DURATION
              </div>
            </div>
          </div>

          {showExercises && flat.length > 0 ? (
            <div className="mt-3">
              <div className="text-dim small mb-2">Today’s exercise list</div>

              <div className="d-flex flex-column" style={{ gap: 8 }}>
                {flat.map((exercise, i) => (
                  <div
                    key={`${exercise.name}-${i}`}
                    className="d-flex justify-content-between align-items-center gap-2"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.05)",
                      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
                    }}
                  >
                    <div className="text-truncate" style={{ minWidth: 0 }}>
                      <span className="text-dim" style={{ marginRight: 8 }}>
                        {i + 1}
                      </span>
                      <span className="fw-semibold">{exercise.name}</span>
                    </div>

                    <div className="text-dim small" style={{ whiteSpace: "nowrap" }}>
                      {exercise.reps ? exercise.reps : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3">
            <Link
              href={startHref}
              className="ia-btn ia-btn-primary w-100"
              style={{
                pointerEvents: resolvedWorkoutId ? "auto" : "none",
                opacity: resolvedWorkoutId ? 1 : 0.6,
              }}
            >
              Start <i className="fas fa-play" />
            </Link>

            <div className="text-dim small mt-2">
              Week {weekStartYMD} → {weekEndYMD}
              {weeklyTotals?.completedTasks != null && weeklyTotals?.totalTasks != null ? (
                <span> • {weeklyTotals.completedTasks}/{weeklyTotals.totalTasks} tasks</span>
              ) : null}
            </div>
          </div>
        </>
      )}

      {showWeek ? (
        <div
          className="mt-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}
        >
          {weekRows.pending.length > 0 ? (
            <>
              <div className="text-dim small mb-2">Pending</div>

              {weekRows.pending.map((row) => (
                <div key={`pending-${row.ymd}`} style={{ marginBottom: 10 }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="fw-semibold">
                      {row.day} <span className="text-dim">({row.ymd})</span>
                    </div>
                    <span className="ia-badge">{row.workouts.length} to do</span>
                  </div>

                  <div className="d-flex flex-column" style={{ gap: 8 }}>
                    {row.workouts.map((workoutRef) => {
                      const href = `/gymworkout/${encodeURIComponent(workoutRef.id)}?date=${encodeURIComponent(row.ymd)}`;

                      return (
                        <Link key={`${row.ymd}-${workoutRef.id}`} href={href} className="ia-link">
                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: 14,
                              background: "rgba(255,255,255,0.05)",
                              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <div className="text-truncate" style={{ minWidth: 0 }}>
                              <div className="fw-semibold text-truncate">
                                {workoutRef.name || "Gym session"}
                              </div>
                              {!workoutRef.name ? (
                                <div className="text-dim small text-truncate">{workoutRef.id}</div>
                              ) : null}
                            </div>
                            <i className="fas fa-chevron-right text-dim" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          ) : null}

          {weekRows.completed.length > 0 ? (
            <>
              <div
                className="text-dim small mb-2"
                style={{ marginTop: weekRows.pending.length ? 6 : 0 }}
              >
                Completed
              </div>

              {weekRows.completed.map((row) => (
                <div key={`done-${row.ymd}`} style={{ marginBottom: 10 }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="fw-semibold">
                      {row.day} <span className="text-dim">({row.ymd})</span>
                    </div>
                    <span className="ia-badge ia-badge-neon d-inline-flex align-items-center gap-1">
                      <i className="fas fa-check" />
                      Completed
                    </span>
                  </div>

                  <div className="d-flex flex-column" style={{ gap: 8 }}>
                    {row.workouts.map((workoutRef) => {
                      const href = `/gymworkout/${encodeURIComponent(workoutRef.id)}?date=${encodeURIComponent(row.ymd)}`;

                      return (
                        <Link key={`${row.ymd}-${workoutRef.id}`} href={href} className="ia-link">
                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: 14,
                              background: "rgba(255,255,255,0.05)",
                              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <div className="text-truncate" style={{ minWidth: 0 }}>
                              <div className="fw-semibold text-truncate">
                                {workoutRef.name || "Gym session"}
                              </div>
                              {!workoutRef.name ? (
                                <div className="text-dim small text-truncate">{workoutRef.id}</div>
                              ) : null}
                            </div>
                            <i className="fas fa-chevron-right text-dim" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          ) : null}

          {weekRows.pending.length === 0 && weekRows.completed.length === 0 ? (
            <div className="text-dim small">No workouts found for this week.</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
