import useSWR from "swr";
import { useEffect, useState } from "react";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type CompletionSet = { exercise_id: string; set: number; weight: number | null; reps: number | null };

type LastCompletion = {
  id: string;
  activity_type?: string | null;
  completed_date?: any;
  date_completed?: any;
  sets?: CompletionSet[];
  calories_burned?: number | null;
  duration_minutes?: number | null;
  rpe?: number | null;
};

export default function IronAcreRecentSessions() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data } = useSWR<{ ok: boolean; last: LastCompletion | null }>(
    mounted ? "/api/completions/last" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const last = data?.last || null;

  const topLines =
    Array.isArray(last?.sets) && last?.sets.length
      ? last!.sets.slice(0, 3).map((s) => `${s.exercise_id}: ${s.weight ?? "-"}kg x ${s.reps ?? "-"}`)
      : [];

  return (
    <section className="futuristic-card p-3 mb-3">
      <h6 className="m-0 mb-2">Recent sessions</h6>

      {!last ? (
        <div className="text-dim small">No gym sessions logged yet.</div>
      ) : (
        <>
          <div className="text-dim small mb-2">
            Last session {last.activity_type ? `(${last.activity_type})` : ""}{" "}
            {typeof last.rpe === "number" ? `• RPE ${last.rpe}` : ""}
            {typeof last.duration_minutes === "number" ? `• ${last.duration_minutes} min` : ""}
          </div>

          {topLines.length ? (
            <div className="small" style={{ lineHeight: 1.6 }}>
              {topLines.map((t, i) => (
                <div key={i}>{t}</div>
              ))}
            </div>
          ) : (
            <div className="text-dim small">No set details captured on the last session.</div>
          )}

          <div className="text-dim small mt-2">
            Next: once you send the completions list API, we’ll show the last 5 sessions here.
          </div>
        </>
      )}
    </section>
  );
}
