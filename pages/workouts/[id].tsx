
// pages/workouts/[id].tsx
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useMemo } from "react";
import BottomNav from "../../components/BottomNav";

const ACCENT = "#FF8A2A";
const fetcher = (u: string) => fetch(u).then((r) => {
  if (!r.ok) throw new Error(`Failed: ${r.status}`);
  return r.json();
});

/** Centralise the URL here so you can switch endpoints easily */
function buildUrl(id: string | string[] | undefined) {
  if (!id || Array.isArray(id)) return null;
  // Primary: RESTful /api/workouts/[id]
  return `/api/workouts/${encodeURIComponent(id)}`;
  // If your API is ?id= style, swap to:
  // return `/api/workouts/get?id=${encodeURIComponent(id)}`;
}

type SingleItem = {
  type: "Single";
  order: number;
  exercise_id: string;
  exercise_name?: string;
  sets?: number;
  reps?: string;
  weight_kg?: number | null;
  rest_s?: number | null;
  notes?: string | null;
};

type SupersetSubItem = {
  exercise_id: string;
  exercise_name?: string;
  reps?: string;
  weight_kg?: number | null;
};

type SupersetItem = {
  type: "Superset";
  order: number;
  name?: string | null;
  items: SupersetSubItem[];
  sets: number;
  rest_s?: number | null;
  notes?: string | null;
};

type GymRound = {
  name: string;
  order: number;
  items: Array<SingleItem | SupersetItem>;
};

type Workout = {
  workout_id: string;
  owner_email?: string;
  visibility: "global" | "private";
  workout_name: string;
  focus?: string;
  notes?: string;
  video_url?: string;
  warmup?: GymRound | null;
  main: GymRound;
  finisher?: GymRound | null;
  created_at?: string;
  updated_at?: string;
};

function RoundBlock({ round }: { round?: GymRound | null }) {
  if (!round || !round.items?.length) return null;

  const sorted = useMemo(
    () => [...round.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [round.items]
  );

  return (
    <section className="futuristic-card p-3 mb-3">
      <h5 className="mb-2">{round.name}</h5>
      {!sorted.length ? (
        <div className="text-dim small">No items.</div>
      ) : (
        sorted.map((it, idx) => (
          <div key={`${round.name}-${idx}`} className="mb-3">
            {it.type === "Single" ? (
              <SingleView item={it as SingleItem} />
            ) : (
              <SupersetView item={it as SupersetItem} />
            )}
          </div>
        ))
      )}
    </section>
  );
}

function SingleView({ item }: { item: SingleItem }) {
  return (
    <div className="p-2 rounded" style={{ background: "rgba(255,255,255,0.04)" }}>
      <div className="d-flex align-items-center justify-content-between">
        <div className="fw-semibold">
          {item.exercise_name || item.exercise_id || "Exercise"}
        </div>
        <span className="badge" style={{ background: ACCENT, color: "#0b0f14" }}>
          Single
        </span>
      </div>
      <div className="small text-dim mt-1">
        {item.sets ? `${item.sets} sets` : ""} {item.sets && item.reps ? "• " : ""}
        {item.reps ? `reps: ${item.reps}` : ""}
        {(item.weight_kg ?? null) !== null ? ` • ${item.weight_kg} kg` : ""}
        {(item.rest_s ?? null) !== null ? ` • rest ${item.rest_s}s` : ""}
      </div>
      {item.notes ? <div className="small mt-1">{item.notes}</div> : null}
    </div>
  );
}

function SupersetView({ item }: { item: SupersetItem }) {
  return (
    <div className="p-2 rounded" style={{ background: "rgba(255,255,255,0.04)" }}>
      <div className="d-flex align-items-center justify-content-between">
        <div className="fw-semibold">
          {item.name?.trim() || "Superset"}
        </div>
        <span className="badge border" style={{ borderColor: ACCENT, color: ACCENT }}>
          {item.sets ?? 3} sets
        </span>
      </div>

      <div className="mt-2">
        {(item.items || []).map((s, i) => (
          <div key={i} className="d-flex align-items-center gap-2 small py-1"
               style={{ borderBottom: "1px dashed rgba(255,255,255,0.1)" }}>
            <span className="text-dim">#{i + 1}</span>
            <span className="fw-semibold">{s.exercise_name || s.exercise_id || "Exercise"}</span>
            <span className="text-dim ms-auto">
              {s.reps ? `${s.reps}` : ""}
              {(s.weight_kg ?? null) !== null ? ` • ${s.weight_kg} kg` : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="small text-dim mt-1">
        {(item.rest_s ?? null) !== null ? `Rest between sets: ${item.rest_s}s` : ""}
        {item.notes ? ` • ${item.notes}` : ""}
      </div>
    </div>
  );
}

export default function WorkoutDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const url = buildUrl(id);

  const { data, error, isValidating } = useSWR<Workout>(url, fetcher, {
    revalidateOnFocus: false,
  });

  const loading = !error && (!data || isValidating);

  return (
    <>
      <Head>
        <title>{data?.workout_name ? `${data.workout_name} • Workout` : "Workout"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="mb-3">
          <Link href="/workouts" className="btn btn-outline-secondary">← Back</Link>
        </div>

        {loading && (
          <div className="text-center mt-5">
            <span className="inline-spinner mb-2" />
            <div className="small text-dim mt-2">Loading workout…</div>
          </div>
        )}

        {error && (
          <div className="alert alert-danger">
            Could not load this workout. {String(error?.message || "")}
          </div>
        )}

        {data && (
          <>
            {/* Header / Meta */}
            <section className="futuristic-card p-3 mb-3">
              <div className="d-flex align-items-center justify-content-between">
                <h2 className="m-0">{data.workout_name}</h2>
                <span className="badge" style={{ background: ACCENT, color: "#0b0f14" }}>
                  {data.visibility === "private" ? "Private" : "Global"}
                </span>
              </div>

              <div className="small text-dim mt-1">
                {data.focus ? <>Focus: <span className="text-light">{data.focus}</span></> : null}
                {data.focus && data.owner_email ? " • " : ""}
                {data.owner_email ? <>Owner: <span className="text-light">{data.owner_email}</span></> : null}
              </div>

              {data.notes ? <div className="mt-2">{data.notes}</div> : null}

              {data.video_url ? (
                <div className="mt-2">
                  <a className="btn btn-sm btn-bxkr-outline" href={data.video_url} target="_blank" rel="noreferrer"
                     style={{ borderRadius: 24 }}>
                    Watch Video
                  </a>
                </div>
              ) : null}
            </section>

            {/* Rounds */}
            {data.warmup ? <RoundBlock round={data.warmup} /> : null}
            <RoundBlock round={data.main} />
            {data.finisher ? <RoundBlock round={data.finisher} /> : null}

            {/* Actions */}
            <div className="d-flex gap-2">
              <button
                className="btn btn-bxkr"
                style={{ background: ACCENT, borderRadius: 24, color: "#0b0f14" }}
                onClick={() => navigator.clipboard.writeText(window.location.href)}
              >
                Copy Link
              </button>
              <Link className="btn btn-bxkr-outline" style={{ borderRadius: 24 }} href={`/admin/workouts/gym-create`}>
                Create Another
              </Link>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}
