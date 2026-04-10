import Link from "next/link";

const ACCENT_IRON = "#22c55e";

type WorkoutItem =
  | { type: "Single"; exercise_id: string; exercise_name?: string; sets?: number | null }
  | { type: "Superset"; items: { exercise_id: string; exercise_name?: string }[]; sets?: number | null };

type Round = { name: string; order: number; items: WorkoutItem[] };

type Workout = {
  workout_id: string;
  workout_name: string;
  warmup?: Round | null;
  main: Round;
  finisher?: Round | null;
};

function countExercises(w?: Workout | null) {
  if (!w) return 0;
  const rounds: Round[] = [];
  if (w.warmup) rounds.push(w.warmup);
  if (w.main) rounds.push(w.main);
  if (w.finisher) rounds.push(w.finisher);

  let n = 0;
  for (const r of rounds) {
    for (const it of r.items || []) {
      if (it.type === "Single") n += 1;
      else n += (it.items?.length || 0);
    }
  }
  return n;
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

function topExercises(w?: Workout | null, limit = 3) {
  if (!w) return [];
  const out: string[] = [];
  const rounds: Round[] = [];
  if (w.warmup) rounds.push(w.warmup);
  if (w.main) rounds.push(w.main);
  if (w.finisher) rounds.push(w.finisher);

  for (const r of rounds) {
    for (const it of r.items || []) {
      if (it.type === "Single") {
        out.push(it.exercise_name || it.exercise_id);
      } else {
        for (const s of it.items || []) out.push(s.exercise_name || s.exercise_id);
      }
      if (out.length >= limit) return out.slice(0, limit);
    }
  }
  return out.slice(0, limit);
}

export default function IronAcreWorkoutCard({
  title,
  workout,
  workoutId,
  done,
  durationMinutes,
}: {
  title: string;
  workout: Workout | null;
  workoutId: string;
  done: boolean;
  durationMinutes?: number | null;
}) {
  const exCount = countExercises(workout);
  const setCount = estimateSets(workout);
  const preview = topExercises(workout, 3);

  return (
    <section className="futuristic-card p-3 mb-3" style={{ border: `1px solid ${ACCENT_IRON}33` }}>
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div style={{ minWidth: 0 }}>
          <div className="text-dim small">{title}</div>
          <div className="fw-bold" style={{ fontSize: "1.15rem" }}>
            {workout?.workout_name || "Gym session"}
          </div>
          <div className="text-dim small mt-1">
            {exCount ? `${exCount} exercises` : "—"}
            {setCount ? ` • ${setCount} sets` : ""}
            {durationMinutes ? ` • ${durationMinutes} min` : ""}
            {done ? " • Completed" : ""}
          </div>
        </div>

        <Link
          href={workoutId ? `/gymworkout/${encodeURIComponent(workoutId)}` : "#"}
          className="btn btn-sm"
          style={{
            borderRadius: 14,
            background: ACCENT_IRON,
            color: "#0b0f14",
            fontWeight: 800,
            paddingLeft: 14,
            paddingRight: 14,
            pointerEvents: workoutId ? "auto" : "none",
            opacity: workoutId ? 1 : 0.6,
          }}
        >
          {done ? "View" : "Start"}
        </Link>
      </div>

      {preview.length > 0 && (
        <div className="mt-3 small" style={{ lineHeight: 1.6 }}>
          {preview.map((x, i) => (
            <div key={i}>
              <span className="text-dim me-2">{i + 1}</span>
              {x}
            </div>
          ))}
          {exCount > preview.length && (
            <div className="text-dim mt-1">View all {exCount} exercises</div>
          )}
        </div>
      )}
    </section>
  );
}
