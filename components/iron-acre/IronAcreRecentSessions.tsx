import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";

type CompletionSet = {
  exercise_id: string;
  set: number;
  weight: number | null;
  reps: number | null;
};

type CompletionRow = {
  id: string;
  workout_id?: string | null;
  workout_name?: string | null;
  activity_type?: string | null;
  completed_date?: string | null; // ISO string
  duration_minutes?: number | null;
  calories_burned?: number | null;
  rpe?: number | null;
  sets?: CompletionSet[];
};

type CompletionsRes = {
  results?: CompletionRow[];
  nextCursor?: string | null;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function niceDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function pickTopSet(sets?: CompletionSet[] | null): CompletionSet | null {
  if (!Array.isArray(sets) || sets.length === 0) return null;
  return sets.find((s) => (s.weight ?? 0) > 0) || sets[0] || null;
}

export default function IronAcreRecentSessions() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data } = useSWR<CompletionsRes>(mounted ? "/api/completions?limit=50" : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const rows = useMemo(() => {
    const list = Array.isArray(data?.results) ? data!.results! : [];
    const strength = list.filter((c) => String(c.activity_type || "").toLowerCase().includes("strength"));
    return strength.slice(0, 5);
  }, [data]);

  return (
    <section className="futuristic-card ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="ia-tile-title">Recent sessions</div>
        <span className="ia-badge ia-badge-neon">Strength</span>
      </div>

      {rows.length === 0 ? (
        <div className="text-dim small">No strength sessions logged yet.</div>
      ) : (
        <div className="d-flex flex-column" style={{ gap: 10 }}>
          {rows.map((c) => {
            const title = c.workout_name || c.workout_id || "Gym session";
            const date = niceDate(c.completed_date);
            const dur = typeof c.duration_minutes === "number" ? `${c.duration_minutes} min` : null;
            const rpe = typeof c.rpe === "number" ? `RPE ${c.rpe}` : null;

            const topSet = pickTopSet(c.sets);
            const topLine = topSet ? `${topSet.exercise_id} • ${topSet.weight ?? "-"}kg x ${topSet.reps ?? "-"}` : null;

            const meta = [date, dur, rpe].filter(Boolean).join(" • ");

            return (
              <div
                key={c.id}
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  paddingTop: 10,
                }}
              >
                <div className="fw-semibold">{title}</div>
                {meta ? <div className="text-dim small">{meta}</div> : null}
                {topLine ? (
                  <div className="small mt-1">{topLine}</div>
                ) : (
                  <div className="text-dim small mt-1">No set details</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
