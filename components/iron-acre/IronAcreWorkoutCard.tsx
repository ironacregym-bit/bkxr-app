// components/iron-acre/IronAcreWorkoutCard.tsx
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

  // Build week rows, but remove duplicates of today's workout (same date) so it doesn't appear twice.
  const weekRows = useMemo(() => {
    const rows = (weekDays || [])
      .filter((d) => (d.recurringWorkouts || []).length > 0)
      .map((d) => {
        const dayWorkouts = (d.recurringWorkouts || []).filter((w) => {
          // If this is today's date and this workout is the one already shown above, hide it here.
          if (d.dateKey === dateKey && workoutId && w.id === workoutId) return false;
          return true;
        });

        return {
          ymd: d.dateKey,
          day: dayLabelFromYMD(d.dateKey),
          workouts: dayWorkouts,
          done: Boolean(d.recurringDone),
        };
      })
      // Drop any day row that became empty after filtering
      .filter((r) => (r.workouts || []).length > 0);

    return {
      completed: rows.filter((r) => r.done),
      pending: rows.filter((r) => !r.done),
      all: rows,
    };
  }, [weekDays, dateKey, workoutId]);

  const startHref = workoutId ? `/gymworkout/${encodeURIComponent(workoutId)}?date=${encodeURIComponent(dateKey)}` : "#";

  const cardBorder = done ? `1px solid ${IA.neon}` : `1px solid ${IA.borderSoft}`;
  const cardGlow = done
    ? `0 0 0 1px rgba(24,255,154,0.20) inset, 0 0 26px rgba(24,255,154,0.18)`
    : `0 0 0 1px rgba(24,255,154,0.07) inset, 0 18px 40px rgba(0,0,0,0.45)`;

  return (
    <section
      className="futuristic-card p-3 mb-3"
      style={neonCardStyle({
        border: cardBorder,
        boxShadow: cardGlow,
      })}
    >
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
          <div className="text-dim small mt-1">Check the “This week” section for upcoming sessions.</div>

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
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="fw-bold" style={{ fontSize: "1.25rem", lineHeight: 1.1 }}>
              {workout?.workout_name || "Gym session"}
            </div>

            {done ? (
              <span
                className="badge"
                style={{
                  background: `rgba(24,255,154,0.12)`,
                  color: IA.neon,
                  border: `1px solid ${IA.borderSoft}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
                title="Completed"
              >
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

                  <div className="mt-2 d-flex flex-column" style={{ gap: 8 }}>
                    {(r.workouts || []).map((w) => {
                      const href = `/gymworkout/${encodeURIComponent(w.id)}?date=${encodeURIComponent(r.ymd)}`;
                      return (
                        <Link
                          key={w.id}
                          href={href}
                          className="text-decoration-none"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            padding: "10px 10px",
                            borderRadius: 10,
                            border: `1px solid rgba(255,255,255,0.10)`,
                            background: "rgba(255,255,255,0.03)",
                            color: "#fff",
                          }}
                        >
                          <div className="text-truncate" style={{ minWidth: 0 }}>
                            <div className="fw-semibold text-truncate">{w.name || w.id}</div>
                            <div className="text-dim small">Open workout</div>
                          </div>
                          <i className="fas fa-chevron-right text-dim" />
                        </Link>
                      );
                    })}
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
                    border: `1px solid ${IA.neon}`,
                    background: "rgba(24,255,154,0.06)",
                    marginBottom: 8,
                    boxShadow: `0 0 0 1px rgba(24,255,154,0.16) inset, ${IA.glowSoft}`,
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-semibold">
                      {r.day} <span className="text-dim">({r.ymd})</span>
                    </div>

                    <span
                      className="badge"
                      style={{
                        background: `rgba(24,255,154,0.12)`,
                        color: IA.neon,
                        border: `1px solid ${IA.borderSoft}`,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <i className="fas fa-check" />
                      Completed
                    </span>
                  </div>

                  <div className="mt-2 d-flex flex-column" style={{ gap: 8 }}>
                    {(r.workouts || []).map((w) => {
                      const href = `/gymworkout/${encodeURIComponent(w.id)}?date=${encodeURIComponent(r.ymd)}`;
                      return (
                        <Link
                          key={w.id}
                          href={href}
                          className="text-decoration-none"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            padding: "10px 10px",
                            borderRadius: 10,
                            border: `1px solid rgba(24,255,154,0.35)`,
                            background: "rgba(24,255,154,0.05)",
                            color: "#fff",
                          }}
                        >
                          <div className="text-truncate" style={{ minWidth: 0 }}>
                            <div className="fw-semibold text-truncate">{w.name || w.id}</div>
                            <div className="text-dim small">View workout</div>
                          </div>
                          <i className="fas fa-chevron-right text-dim" />
                        </Link>
                      );
                    })}
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
