import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { IA, neonCardStyle } from "./theme";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type CompletionSet = { exercise_id: string; set: number; weight: number | null; reps: number | null };

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

function niceDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
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
    const strength = list.filter((c) => (c.activity_type || "").toLowerCase().includes("strength"));
    return strength.slice(0, 5);
  }, [data]);

  return (
    <section className="futuristic-card p-3 mb-3" style={neonCardStyle({ border: `1px solid ${IA.borderSoft}` })}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="m-0">Recent sessions</h6>
        <span
          className="badge"
          style={{
            background: `rgba(24,255,154,0.12)`,
            color: IA.neon,
            border: `1px solid ${IA.borderSoft}`,
          }}
        >
          Strength
        </span>
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

            const topSet =
              Array.isArray(c.sets) && c.sets.length
                ? c.sets.find((s) => (s.weight ?? 0) > 0) || c.sets[0]
                : null;

            const topLine = topSet
              ? `${topSet.exercise_id} • ${topSet.weight ?? "-"}kg x ${topSet.reps ?? "-"}`
              : null;

            const meta = [date, dur, rpe].filter(Boolean).join(" • ");

            return (
              <div key={c.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
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
