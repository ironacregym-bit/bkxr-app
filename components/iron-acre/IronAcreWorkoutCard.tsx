import Link from "next/link";
import { useMemo, useState } from "react";
import { IA, neonCardStyle, neonButtonStyle, neonPrimaryStyle } from "./theme";

type WorkoutItem =
  | { type: "Single"; exercise_id: string; exercise_name?: string; sets?: number | null; reps?: string | null }
  | { type: "Superset"; items: { exercise_id: string; exercise_name?: string; reps?: string | null }[]; sets?: number | null };

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

function flattenExercisesWithReps(w?: Workout | null) {
  if (!w) return [] as Array<{ name: string; reps?: string | null }>;
  const rounds: Round[] = [];
  if (w.warmup) rounds.push(w.warmup);
  if (w.main) rounds.push(w.main);
  if (w.finisher) rounds.push(w.finisher);

  const out: Array<{ name: string; reps?: string | null }> = [];
  for (const r of rounds) {
    for (const it of r.items || []) {
      if (it.type === "Single") out.push({ name: it.exercise_name || it.exercise_id, reps: it.reps ?? null });
      else for (const s of it.items || []) out.push({ name: s.exercise_name || s.exercise_id, reps: s.reps ?? null });
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
}: {
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
}) {
  const flat = useMemo(() => flattenExercisesWithReps(workout), [workout]);
  const exCount = flat.length;
  const setCount = useMemo(() => estimateSets(workout), [workout]);
  const preview = useMemo(() => flat.slice(0, 3), [flat]);

  const [showWeek, setShowWeek] = useState(false);

  const weekRows = useMemo(() => {
    const rows = (weekDays || [])
      .filter((d) => (d.recurringWorkouts || []).length > 0)
      .map((d) => ({
        ymd: d.dateKey,
        day: dayLabelFromYMD(d.dateKey),
        workouts: d.recurringWorkouts,
        done: Boolean(d.recurringDone),
      }));

    return {
      completed: rows.filter((r) => r.done),
      pending: rows.filter((r) => !r.done), // includes past + future (missed shows here too)
      all: rows,
    };
  }, [weekDays]);

  const startHref = workoutId
    ? `/gymworkout/${encodeURIComponent(workoutId)}?date=${encodeURIComponent(dateKey)}`
    : "#";

  const weekProgress = useMemo(() => {
    const total = weekRows.all.length;
    const doneCount = weekRows.completed.length;
    return { total, doneCount };
  }, [weekRows]);

  return (
    <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="text-dim small" style={{ letterSpacing: 0.9, display: "flex", alignItems: "center", gap: 8 }}>
          <i className="fas fa-dumbbell" style={{ color: IA.neon, filter: `drop-shadow(0 0 8px ${IA.neon}66)` }} />
          TODAY’S WORKOUT
        </div>

        <button
          type="button"
          onClick={() => setShowWeek((v) => !v)}
          className="btn btn-sm"
          style={neonButtonStyle({
            paddingLeft: 12,
            paddingRight: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          })}
          title="Toggle this week"
        >
          <i className={`fas fa-chevron-${showWeek ? "up" : "down"}`} />
          This week
        </button>
      </div>

      {/* If no workout today, show a clean empty state */}
      {!hasWorkoutToday ? (
        <>
          <div className="fw-bold" style={{ fontSize: "1.25rem", lineHeight: 1.1 }}>
            No workout scheduled today
          </div>
          <div className="text-dim small mt-1">
            Check the “This week” section for upcoming sessions.
          </div>

          <div className="mt-3">
            <button
              type="button"
              className="btn btn-sm"
              style={neonButtonStyle({ borderRadius: 14, paddingLeft: 14, paddingRight: 14 })}
              onClick={() => setShowWeek(true)}
            >
              View this week <i className="fas fa-chevron-down" style={{ marginLeft: 8 }} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="fw-bold" style={{ fontSize: "1.25rem", lineHeight: 1.1 }}>
            {workout?.workout_name || "Gym session"}
          </div>

          <div className="text-dim small mt-1" style={{ maxWidth: 520 }}>
            {(workout?.focus || workout?.notes || "Strength session targeting key patterns with varied angles and equipment.").toString()}
          </div>

          <div
            className="d-flex justify-content-between text-center mt-3"
            style={{
              gap: 10,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${IA.borderSoft}`,
              borderRadius: 14,
              padding: "10px 12px",
              boxShadow: IA.glowSoft,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ color: IA.neon, fontWeight: 900, fontSize: "1.1rem", textShadow: `0 0 12px ${IA.neon}55` }}>
                {exCount || "—"}
              </div>
              <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
                EXERCISES
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ color: IA.neon2, fontWeight: 900, fontSize: "1.1rem", textShadow: `0 0 12px ${IA.neon2}55` }}>
                {setCount || "—"}
              </div>
              <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
                SETS
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ color: IA.neon, fontWeight: 900, fontSize: "1.1rem", textShadow: `0 0 12px ${IA.neon}55` }}>
                {durationMinutes ?? "—"} {durationMinutes != null ? "min" : ""}
              </div>
              <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
                DURATION
              </div>
            </div>
          </div>

          {preview.length > 0 && (
            <div className="mt-3" style={{ borderTop: `1px solid ${IA.borderSoft}`, paddingTop: 10 }}>
              {preview.map((x, i) => (
                <div key={i} className="d-flex justify-content-between align-items-center" style={{ padding: "6px 0" }}>
                  <div className="text-truncate" style={{ minWidth: 0 }}>
                    <span className="text-dim" style={{ marginRight: 8 }}>
                      {i + 1}
                    </span>
                    <span style={{ fontWeight: 750 }}>{x.name}</span>
                  </div>
                  <div className="text-dim small" style={{ whiteSpace: "nowrap" }}>
                    {x.reps ? x.reps : ""}
                  </div>
                </div>
              ))}

              {exCount > preview.length && (
                <div className="mt-1">
                  <Link href={`/gymworkout/${encodeURIComponent(workoutId)}?date=${encodeURIComponent(dateKey)}`} className="text-dim small" style={{ textDecoration: "none" }}>
                    View all {exCount} exercises <i className="fas fa-chevron-right" style={{ marginLeft: 6 }} />
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="mt-3">
            <Link
              href={startHref}
              className="btn btn-sm w-100"
              style={neonPrimaryStyle({
                padding: "12px 14px",
                pointerEvents: workoutId ? "auto" : "none",
                opacity: workoutId ? 1 : 0.6,
              })}
            >
              START <i className="fas fa-play" style={{ marginLeft: 10 }} />
            </Link>

            <div className="d-flex justify-content-between align-items-center mt-2">
              {done ? (
                <div className="text-dim small">
                  <i className="fas fa-check" style={{ color: IA.neon, marginRight: 6 }} />
                  Completed this week
                </div>
              ) : (
                <div className="text-dim small">Week {weekStartYMD} → {weekEndYMD}</div>
              )}

              <div className="text-dim small">
                {weekProgress.doneCount}/{weekProgress.total} done
                {weeklyTotals?.completedTasks != null && weeklyTotals?.totalTasks != null ? (
                  <span> • {weeklyTotals.completedTasks}/{weeklyTotals.totalTasks} tasks</span>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}

      {showWeek && (
        <div className="mt-3" style={{ borderTop: `1px solid ${IA.borderSoft}`, paddingTop: 12 }}>
          <div className="fw-semibold mb-2">This week</div>

          {weekRows.pending.length > 0 && (
            <>
              <div className="text-dim small mb-1">Pending</div>
              {weekRows.pending.map((r) => (
                <div
                  key={`pending-${r.ymd}`}
                  style={{
                    padding: "10px 10px",
                    borderRadius: 12,
                    border: `1px solid ${IA.borderSoft}`,
                    background: "rgba(0,0,0,0.20)",
                    marginBottom: 8,
                    boxShadow: IA.glowSoft,
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-semibold">
                      {r.day} <span className="text-dim">({r.ymd})</span>
                    </div>
                    <span className="badge" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
                      Pending
                    </span>
                  </div>

                  <div className="text-dim small mt-1">
                    {(r.workouts || []).map((w, idx) => (
                      <span key={w.id}>
                        <Link href={`/gymworkout/${encodeURIComponent(w.id)}?date=${encodeURIComponent(r.ymd)}`} className="text-dim" style={{ textDecoration: "none" }}>
                          {w.name || w.id}
                        </Link>
                        {idx < r.workouts.length - 1 ? " • " : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {weekRows.completed.length > 0 && (
            <>
              <div className="text-dim small mb-1" style={{ marginTop: 10 }}>
                Completed
              </div>
              {weekRows.completed.map((r) => (
                <div
                  key={`done-${r.ymd}`}
                  style={{
                    padding: "10px 10px",
                    borderRadius: 12,
                    border: `1px solid ${IA.border}`,
                    background: "rgba(24,255,154,0.06)",
                    marginBottom: 8,
                    boxShadow: IA.glowSoft,
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-semibold">
                      {r.day} <span className="text-dim">({r.ymd})</span>
                    </div>
                    <span className="badge" style={{ background: `rgba(24,255,154,0.12)`, color: IA.neon, border: `1px solid ${IA.borderSoft}` }}>
                      Completed
                    </span>
                  </div>

                  <div className="text-dim small mt-1">
                    {(r.workouts || []).map((w, idx) => (
                      <span key={w.id}>
                        <Link href={`/gymworkout/${encodeURIComponent(w.id)}?date=${encodeURIComponent(r.ymd)}`} className="text-dim" style={{ textDecoration: "none" }}>
                          {w.name || w.id}
                        </Link>
                        {idx < r.workouts.length - 1 ? " • " : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {weekRows.pending.length === 0 && weekRows.completed.length === 0 && (
            <div className="text-dim small">No recurring workouts found for this week.</div>
          )}
        </div>
      )}
    </section>
  );
}
