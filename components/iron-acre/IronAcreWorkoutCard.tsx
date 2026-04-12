import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const ACCENT_IRON = "#22c55e";

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
  hasRecurringToday: boolean;
  recurringWorkouts: SimpleWorkoutRef[];
  recurringDone: boolean;
};

type WeeklyOverviewResponse = {
  weekStartYMD: string;
  weekEndYMD: string;
  fridayYMD: string;
  days: DayOverview[];
};

function startOfAlignedWeekFromYMD(ymd: string): string {
  // ymd is YYYY-MM-DD local
  const d = new Date(`${ymd}T00:00:00`);
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s.toLocaleDateString("en-CA");
}

function flattenExercisesWithReps(w?: Workout | null) {
  if (!w) return [] as Array<{ name: string; reps?: string | null }>;
  const rounds: Round[] = [];
  if (w.warmup) rounds.push(w.warmup);
  if (w.main) rounds.push(w.main);
  if (w.finisher) rounds.push(w.finisher);

  const out: Array<{ name: string; reps?: string | null }> = [];

  for (const r of rounds) {
    for (const it of r.items || []) {
      if (it.type === "Single") {
        out.push({
          name: it.exercise_name || it.exercise_id,
          reps: it.reps ?? null,
        });
      } else {
        for (const s of it.items || []) {
          out.push({
            name: s.exercise_name || s.exercise_id,
            reps: s.reps ?? null,
          });
        }
      }
    }
  }
  return out;
}

function countExercises(w?: Workout | null) {
  return flattenExercisesWithReps(w).length;
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
}: {
  title: string;
  workout: Workout | null;
  workoutId: string;
  done: boolean;
  durationMinutes?: number | null;
  dateKey: string;
}) {
  const exCount = countExercises(workout);
  const setCount = estimateSets(workout);

  const flat = useMemo(() => flattenExercisesWithReps(workout), [workout]);
  const preview = useMemo(() => flat.slice(0, 3), [flat]);
  const desc = useMemo(() => {
    const a = (workout?.focus || "").trim();
    const b = (workout?.notes || "").trim();
    if (a) return a;
    if (b) return b;
    return "Strength session targeting key patterns with varied angles and equipment.";
  }, [workout?.focus, workout?.notes]);

  // Weekly list (expandable inside this tile)
  const [showWeek, setShowWeek] = useState(false);
  const weekStartKey = useMemo(() => startOfAlignedWeekFromYMD(dateKey), [dateKey]);

  const { data: weeklyOverview } = useSWR<WeeklyOverviewResponse>(
    showWeek ? `/api/weekly/overview?week=${encodeURIComponent(weekStartKey)}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const weekRows = useMemo(() => {
    const days = weeklyOverview?.days || [];
    // only recurring days with workouts
    const rows = days
      .filter((d) => (d.recurringWorkouts || []).length > 0)
      .map((d) => ({
        ymd: d.dateKey,
        day: dayLabelFromYMD(d.dateKey),
        workouts: d.recurringWorkouts,
        done: Boolean(d.recurringDone),
      }));

    // split into completed/upcoming (relative to today)
    const today = dateKey;
    const completed = rows.filter((r) => r.done);
    const upcoming = rows.filter((r) => !r.done && r.ymd >= today);

    return { completed, upcoming };
  }, [weeklyOverview, dateKey]);

  const startHref = workoutId ? `/gymworkout/${encodeURIComponent(workoutId)}?date=${encodeURIComponent(dateKey)}` : "#";

  return (
    <section
      className="futuristic-card p-3 mb-3"
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        background: "linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.12))",
        boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
      }}
    >
      {/* Section label row (matches reference style) */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="text-dim small" style={{ letterSpacing: 0.8 }}>
          <i className="fas fa-dumbbell" style={{ marginRight: 8, opacity: 0.9 }} />
          TODAY’S WORKOUT
        </div>

        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          style={{ borderRadius: 999, paddingLeft: 12, paddingRight: 12, opacity: 0.9 }}
          onClick={() => setShowWeek((v) => !v)}
          title="Show this week"
        >
          {showWeek ? "Hide week" : "This week"}
        </button>
      </div>

      {/* Workout title + description */}
      <div className="fw-bold" style={{ fontSize: "1.25rem", lineHeight: 1.1 }}>
        {workout?.workout_name || "Gym session"}
      </div>

      <div className="text-dim small mt-1" style={{ maxWidth: 520 }}>
        {desc}
      </div>

      {/* Stats row */}
      <div
        className="d-flex justify-content-between text-center mt-3"
        style={{
          gap: 10,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: "10px 12px",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ color: ACCENT_IRON, fontWeight: 900, fontSize: "1.1rem" }}>{exCount || "—"}</div>
          <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
            EXERCISES
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ color: ACCENT_IRON, fontWeight: 900, fontSize: "1.1rem" }}>{setCount || "—"}</div>
          <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
            SETS
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ color: ACCENT_IRON, fontWeight: 900, fontSize: "1.1rem" }}>{durationMinutes ?? "—"}</div>
          <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
            DURATION
          </div>
        </div>
      </div>

      {/* Exercise preview list */}
      {preview.length > 0 && (
        <div className="mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
          {preview.map((x, i) => (
            <div
              key={i}
              className="d-flex justify-content-between align-items-center"
              style={{ padding: "6px 0" }}
            >
              <div className="text-truncate" style={{ minWidth: 0 }}>
                <span className="text-dim" style={{ marginRight: 8 }}>
                  {i + 1}
                </span>
                <span style={{ fontWeight: 700 }}>{x.name}</span>
              </div>

              <div className="text-dim small" style={{ whiteSpace: "nowrap" }}>
                {x.reps ? x.reps : ""}
              </div>
            </div>
          ))}

          {exCount > preview.length && (
            <div className="mt-1">
              <Link
                href={workoutId ? `/gymworkout/${encodeURIComponent(workoutId)}?date=${encodeURIComponent(dateKey)}` : "#"}
                className="text-dim small"
                style={{ textDecoration: "none" }}
              >
                View all {exCount} exercises <i className="fas fa-chevron-right" style={{ marginLeft: 6 }} />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* START button */}
      <div className="mt-3">
        <Link
          href={startHref}
          className="btn w-100"
          style={{
            borderRadius: 14,
            background: `linear-gradient(90deg, ${ACCENT_IRON}, #2ee59d)`,
            color: "#0b0f14",
            fontWeight: 900,
            letterSpacing: 0.8,
            padding: "12px 14px",
            pointerEvents: workoutId ? "auto" : "none",
            opacity: workoutId ? 1 : 0.6,
          }}
        >
          START <i className="fas fa-play" style={{ marginLeft: 10 }} />
        </Link>

        {done && (
          <div className="text-dim small mt-2">
            <i className="fas fa-check" style={{ color: ACCENT_IRON, marginRight: 6 }} />
            Completed this week
          </div>
        )}
      </div>

      {/* Expandable week list inside the tile */}
      {showWeek && (
        <div className="mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
          <div className="fw-semibold mb-2">This week</div>

          {weekRows.upcoming.length > 0 && (
            <>
              <div className="text-dim small mb-1">Upcoming</div>
              {weekRows.upcoming.map((r) => (
                <div
                  key={`up-${r.ymd}`}
                  style={{
                    padding: "10px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    marginBottom: 8,
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-semibold">
                      {r.day} <span className="text-dim">({r.ymd})</span>
                    </div>
                    <span className="badge" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
                      Upcoming
                    </span>
                  </div>

                  <div className="text-dim small mt-1">
                    {(r.workouts || []).map((w, idx) => (
                      <span key={w.id}>
                        <Link
                          href={`/gymworkout/${encodeURIComponent(w.id)}?date=${encodeURIComponent(r.ymd)}`}
                          className="text-dim"
                          style={{ textDecoration: "none" }}
                        >
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
                    border: `1px solid ${ACCENT_IRON}33`,
                    background: "rgba(34,197,94,0.06)",
                    marginBottom: 8,
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-semibold">
                      {r.day} <span className="text-dim">({r.ymd})</span>
                    </div>
                    <span className="badge" style={{ background: `${ACCENT_IRON}22`, color: ACCENT_IRON, border: `1px solid ${ACCENT_IRON}55` }}>
                      Completed
                    </span>
                  </div>

                  <div className="text-dim small mt-1">
                    {(r.workouts || []).map((w, idx) => (
                      <span key={w.id}>
                        <Link
                          href={`/gymworkout/${encodeURIComponent(w.id)}?date=${encodeURIComponent(r.ymd)}`}
                          className="text-dim"
                          style={{ textDecoration: "none" }}
                        >
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

          {weekRows.upcoming.length === 0 && weekRows.completed.length === 0 && (
            <div className="text-dim small">No recurring workouts found for this week.</div>
          )}
        </div>
      )}
    </section>
  );
}
