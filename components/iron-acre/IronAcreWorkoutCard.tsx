import { useMemo, useState } from "react";

type WorkoutItem =
  | { type: "Single"; exercise_id: string; exercise_name?: string; sets?: number | null; reps?: string | null }
  | {
      type: "Superset";
      items: { exercise_id: string; exercise_name?: string; reps?: string | null }[];
      sets?: number | null;
    };

type Round = { name: string; order: number; items: WorkoutItem[] };

type Workout = {
  workout_id: string;
  workout_name: string;
  focus?: string | null;
  notes?: string | null;
  warmup?: Round | null;
  main: Round;
  finisher?: Round | null;
};

type SimpleWorkoutRef = { id: string; name?: string };

type DayOverview = {
  dateKey: string;
  recurringWorkouts: SimpleWorkoutRef[];
  recurringDone: boolean;
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
  title: string; // kept for compatibility (not rendered)
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


function flattenExercisesWithReps(w?: Workout | null) {
  const workout = w ?? null;
  if (!workout) return [] as Array<{ name: string; reps?: string | null }>;

  const rounds: Round[] = [];
  if (workout.warmup) rounds.push(workout.warmup);
  if (workout.main) rounds.push(workout.main);
  if (workout.finisher) rounds.push(workout.finisher);

  const out: Array<{ name: string; reps?: string | null }> = [];
  for (const r of rounds) {
    for (const it of r.items || []) {
      if (it.type === "Single") {
        out.push({ name: it.exercise_name || it.exercise_id, reps: it.reps ?? null });
      } else {
        for (const s of it.items || []) {
          out.push({ name: s.exercise_name || s.exercise_id, reps: s.reps ?? null });
        }
      }
    }
  }
  return out;
}



function estimateSets(w?: Workout | null) {
  if (!w) return 0;

  const rounds: Round[] = [];
  if (w.warmup) rounds.push(w.warmup);
  if (w.main) rounds.push(w.main);
  if (w.finisher) rounds.push(w.finisher);

  let total = 0;
  for (const r of rounds) {
    for (const it of r.items || []) {
      if (it.type === "Single") {
        total += Number(it.sets ?? 3);
      } else {
        total += Number(it.sets ?? 3) * (it.items?.length || 1);
      }
    }
  }
  return total;
}


unction dayLabelFromYMD(ymd: string) {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function buildWeekRows(weekDays: DayOverview[], dateKey: string, workoutId: string): WeekRows {
  const rows: WeekRow[] = (weekDays || [])
    .filter((d) => (d.recurringWorkouts || []).length > 0)
    .map((d) => {
      const isCompletedDay = Boolean(d.recurringDone);

      const workouts = (d.recurringWorkouts || []).filter((w) => {
        const isToday = d.dateKey === dateKey;
        const isSameWorkout = Boolean(workoutId) && w.id === workoutId;

        // Only hide TODAY'S workout when it is still pending
        if (isToday && isSameWorkout && !isCompletedDay) return false;

        // If completed, always keep it visible under Completed
        return true;
      });

      return {
        ymd: d.dateKey,
        day: dayLabelFromYMD(d.dateKey),
        workouts,
        done: isCompletedDay,
      };
    })
    .filter((r) => r.workouts.length > 0);

  return {
    pending: rows.filter((r) => !r.done),
    completed: rows.filter((r) => r.done),
  };
}
export default function IronAcreWorkoutCard({
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
}: Props) {
  const flat = useMemo(() => flattenExercisesWithReps(workout), [workout]);
  const exCount = flat.length;
  const setCount = useMemo(() => estimateSets(workout), [workout]);
  const preview = useMemo(() => flat.slice(0, 3), [flat]);

  const [showWeek, setShowWeek] = useState(false);

  const weekRows = useMemo(() => buildWeekRows(weekDays, dateKey, workoutId), [weekDays, dateKey, workoutId]);

  const startHref = workoutId ? `/gymworkout/${encodeURIComponent(workoutId)}?date=${encodeURIComponent(dateKey)}` : "#";

  return (
    <section className="futuristic-card ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="ia-kicker">
          <i className="fas fa-dumbbell" style={{ color: "var(--ia-neon)" }} />
          TODAY’S WORKOUT
        </div>

        <button
          type="button"
          onClick={() => setShowWeek((v) => !v)}
          className="btn btn-sm ia-btn-outline"
          title="Toggle this week"
        >
          <i className={`fas fa-chevron-${showWeek ? "up" : "down"}`} style={{ marginRight: 8 }} />
          This week
        </button>
      </div>

      {!hasWorkoutToday ? (
        <>
          <div className="ia-page-title" style={{ fontSize: "1.25rem" }}>
            No workout scheduled today
          </div>
          <div className="text-dim small mt-1">Check the “This week” section for upcoming sessions.</div>

          <div className="mt-3">
            <button type="button" className="btn btn-sm ia-btn" onClick={() => setShowWeek(true)}>
              View this week <i className="fas fa-chevron-down" style={{ marginLeft: 8 }} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="ia-page-title" style={{ fontSize: "1.25rem" }}>
              {workout?.workout_name || "Gym session"}
            </div>

            {done ? (
              <span className="ia-badge ia-badge-neon" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <i className="fas fa-check" />
                Completed
              </span>
            ) : null}
          </div>

          <div className="text-dim small mt-1" style={{ maxWidth: 520 }}>
            {(workout?.focus || workout?.notes || "Strength session targeting key patterns with varied angles and equipment.").toString()}
          </div>

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
              <div style={{ color: "var(--ia-neon)", fontWeight: 650, fontSize: "1.05rem" }}>{exCount || "—"}</div>
              <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
                EXERCISES
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--ia-neon2)", fontWeight: 650, fontSize: "1.05rem" }}>{setCount || "—"}</div>
              <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
                SETS
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--ia-neon)", fontWeight: 650, fontSize: "1.05rem" }}>
                {durationMinutes ?? "—"} {durationMinutes != null ? "min" : ""}
              </div>
              <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
                DURATION
              </div>
            </div>
          </div>

          {preview.length > 0 ? (
            <div className="mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
              {preview.map((x, i) => (
                <div key={i} className="d-flex justify-content-between align-items-center" style={{ padding: "6px 0" }}>
                  <div className="text-truncate" style={{ minWidth: 0 }}>
                    <span className="text-dim" style={{ marginRight: 8 }}>
                      {i + 1}
                    </span>
                    <span style={{ fontWeight: 600 }}>{x.name}</span>
                  </div>
                  <div className="text-dim small" style={{ whiteSpace: "nowrap" }}>
                    {x.reps ? x.reps : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3">
            <Link
              href={startHref}
              className="btn btn-sm w-100 ia-btn-primary"
              style={{
                pointerEvents: workoutId ? "auto" : "none",
                opacity: workoutId ? 1 : 0.6,
              }}
            >
              START <i className="fas fa-play" style={{ marginLeft: 10 }} />
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
        <div className="mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
          {weekRows.pending.length > 0 ? (
            <>
              <div className="text-dim small mb-2">Pending</div>

              {weekRows.pending.map((r) => (
                <div key={`pending-${r.ymd}`} style={{ marginBottom: 12 }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="fw-semibold">
                      {r.day} <span className="text-dim">({r.ymd})</span>
                    </div>
                    <span className="ia-badge">Pending</span>
                  </div>

                  <div className="d-flex flex-column" style={{ gap: 8 }}>
                    {r.workouts.map((w) => {
                      const href = `/gymworkout/${encodeURIComponent(w.id)}?date=${encodeURIComponent(r.ymd)}`;
                      return (
                        <Link key={w.id} href={href} className="ia-link">
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
                              <div className="fw-semibold text-truncate">{w.name || w.id}</div>
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
              <div className="text-dim small mb-2" style={{ marginTop: weekRows.pending.length ? 6 : 0 }}>
                Completed
              </div>

              {weekRows.completed.map((r) => (
                <div key={`done-${r.ymd}`} style={{ marginBottom: 12 }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="fw-semibold">
                      {r.day} <span className="text-dim">({r.ymd})</span>
                    </div>
                    <span className="ia-badge ia-badge-neon" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <i className="fas fa-check" />
                      Completed
                    </span>
                  </div>

                  <div className="d-flex flex-column" style={{ gap: 8 }}>
                    {r.workouts.map((w) => {
                      const href = `/gymworkout/${encodeURIComponent(w.id)}?date=${encodeURIComponent(r.ymd)}`;
                      return (
                        <Link key={w.id} href={href} className="ia-link">
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
                              <div className="fw-semibold text-truncate">{w.name || w.id}</div>
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
            <div className="text-dim small">No recurring workouts found for this week.</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
``
import Link from "next/link";);
  if (w.main) rounds.push(w.main);
  if (w.finisher) rounds.push(w.finisher);

  let total = 0;
  for (const r of rounds) {
    for (const it of r.items || []) {
      if (it.type === "Single") total += Number(it.sets ?? 3);
      else total += Number(it.sets ?? 3) * (it.items?.length || 1);
    }
  }
  return total;
}

function dayLabelFromYMD(ymd: string) {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function buildWeekRows(weekDays: DayOverview[], dateKey: string, workoutId: string): WeekRows {
  const rows: WeekRow[] = (weekDays || [])
    .filter((d) => (d.recurringWorkouts || []).length > 0)
    .map((d) => {
      const isCompletedDay = Boolean(d.recurringDone);

      const workouts = (d.recurringWorkouts || []).filter((w) => {
        const isToday = d.dateKey === dateKey;
        const isSameWorkout = workoutId && w.id === workoutId;

        // Only hide today's workout when it is still pending (avoid duplicates)
        if (isToday && isSameWorkout && !isCompletedDay) return false;

        // If completed, always keep it visible under Completed
        return true;
      });

      return {
        ymd: d.dateKey,
        day: dayLabelFromYMD(d.dateKey),
        workouts,
        done: isCompletedDay,
      };
    })
    .filter((r) => r.workouts.length > 0);

  return {
    pending: rows.filter((r) => !r.done),
    completed: rows.filter((r) => r.done),
  };
}

export default function IronAcreWorkoutCard({
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
  const flat = useMemo(() => flattenExercisesWithReps(workout), [workout]);
  const exCount = flat.length;
  const setCount = useMemo(() => estimateSets(workout), [workout]);
  const preview = useMemo(() => flat.slice(0, 3), [flat]);

  const [showWeek, setShowWeek] = useState(false);

  const weekRows = useMemo(() => buildWeekRows(weekDays, dateKey, workoutId), [weekDays, dateKey, workoutId]);

  const startHref = workoutId ? `/gymworkout/${encodeURIComponent(workoutId)}?date=${encodeURIComponent(dateKey)}` : "#";

  return (
    <section className="futuristic-card ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="ia-kicker">
          <i className="fas fa-dumbbell" style={{ color: "var(--ia-neon)" }} />
          TODAY’S WORKOUT
        </div>

        <button type="button" onClick={() => setShowWeek((v) => !v)} className="btn btn-sm ia-btn-outline" title="Toggle this week">
          <i className={`fas fa-chevron-${showWeek ? "up" : "down"}`} style={{ marginRight: 8 }} />
          This week
        </button>
      </div>

      {!hasWorkoutToday ? (
        <>
          <div className="ia-page-title" style={{ fontSize: "1.25rem" }}>
            No workout scheduled today
          </div>
          <div className="text-dim small mt-1">Check the “This week” section for upcoming sessions.</div>

          <div className="mt-3">
            <button type="button" className="btn btn-sm ia-btn" onClick={() => setShowWeek(true)}>
              View this week <i className="fas fa-chevron-down" style={{ marginLeft: 8 }} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="ia-page-title" style={{ fontSize: "1.25rem" }}>
              {workout?.workout_name || "Gym session"}
            </div>

            {done ? (
              <span className="ia-badge ia-badge-neon" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <i className="fas fa-check" />
                Completed
              </span>
            ) : null}
          </div>

          <div className="text-dim small mt-1" style={{ maxWidth: 520 }}>
            {(workout?.focus || workout?.notes || "Strength session targeting key patterns with varied angles and equipment.").toString()}
          </div>

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
              <div style={{ color: "var(--ia-neon)", fontWeight: 650, fontSize: "1.05rem" }}>{exCount || "—"}</div>
              <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
                EXERCISES
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--ia-neon2)", fontWeight: 650, fontSize: "1.05rem" }}>{setCount || "—"}</div>
              <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
                SETS
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--ia-neon)", fontWeight: 650, fontSize: "1.05rem" }}>
                {durationMinutes ?? "—"} {durationMinutes != null ? "min" : ""}
              </div>
              <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
                DURATION
              </div>
            </div>
          </div>

          {preview.length > 0 ? (
            <div className="mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
              {preview.map((x, i) => (
                <div key={i} className="d-flex justify-content-between align-items-center" style={{ padding: "6px 0" }}>
                  <div className="text-truncate" style={{ minWidth: 0 }}>
                    <span className="text-dim" style={{ marginRight: 8 }}>
                      {i + 1}
                    </span>
                    <span style={{ fontWeight: 600 }}>{x.name}</span>
                  </div>
                  <div className="text-dim small" style={{ whiteSpace: "nowrap" }}>
                    {x.reps ? x.reps : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3">
            <Link
              href={startHref}
              className="btn btn-sm w-100 ia-btn-primary"
              style={{
                pointerEvents: workoutId ? "auto" : "none",
                opacity: workoutId ? 1 : 0.6,
              }}
            >
              START <i className="fas fa-play" style={{ marginLeft: 10 }} />
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
        <div className="mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
          {weekRows.pending.length > 0 ? (
            <>
              <div className="text-dim small mb-2">Pending</div>

              {weekRows.pending.map((r) => (
                <div key={`pending-${r.ymd}`} style={{ marginBottom: 12 }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="fw-semibold">
                      {r.day} <span className="text-dim">({r.ymd})</span>
                    </div>
                    <span className="ia-badge">Pending</span>
                  </div>

                  <div className="d-flex flex-column" style={{ gap: 8 }}>
                    {r.workouts.map((w) => {
                      const href = `/gymworkout/${encodeURIComponent(w.id)}?date=${encodeURIComponent(r.ymd)}`;
                      return (
                        <Link key={w.id} href={href} className="ia-link">
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
                              <div className="fw-semibold text-truncate">{w.name || w.id}</div>
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
              <div className="text-dim small mb-2" style={{ marginTop: weekRows.pending.length ? 6 : 0 }}>
                Completed
              </div>

              {weekRows.completed.map((r) => (
                <div key={`done-${r.ymd}`} style={{ marginBottom: 12 }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="fw-semibold">
                      {r.day} <span className="text-dim">({r.ymd})</span>
                    </div>
                    <span className="ia-badge ia-badge-neon" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <i className="fas fa-check" />
                      Completed
                    </span>
                  </div>

                  <div className="d-flex flex-column" style={{ gap: 8 }}>
                    {r.workouts.map((w) => {
                      const href = `/gymworkout/${encodeURIComponent(w.id)}?date=${encodeURIComponent(r.ymd)}`;
                      return (
                        <Link key={w.id} href={href} className="ia-link">
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
                              <div className="fw-semibold text-truncate">{w.name || w.id}</div>
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
            <div className="text-dim small">No recurring workouts found for this week.</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
