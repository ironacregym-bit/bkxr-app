
// pages/admin/workouts/[id].tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import BottomNav from "../../../components/BottomNav";

const ACCENT = "#FF8A2A";
const fetcher = (u: string) => fetch(u).then((r) => {
  if (!r.ok) throw new Error(`Failed: ${r.status}`);
  return r.json();
});

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
  item_id?: string;
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
  sets?: number;            // admin may see legacy without sets
  rest_s?: number | null;
  notes?: string | null;
  item_id?: string;
};

type AdminRound = {
  round_id: string;
  name: string;
  order: number;
  items: Array<SingleItem | SupersetItem>;
};

type AdminWorkout = {
  workout_id: string;
  workout_name: string;
  visibility: "global" | "private";
  owner_email?: string;
  focus?: string;
  notes?: string;
  video_url?: string;
  warmup?: AdminRound | null;
  main: AdminRound | null;
  finisher?: AdminRound | null;
  _rounds?: AdminRound[];
};

function RoundSection({ title, round }: { title: string; round?: AdminRound | null }) {
  if (!round || !round.items?.length) return null;
  const items = useMemo(
    () => [...round.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [round.items]
  );

  return (
    <section className="bxkr-card p-3 mb-3">
      <div className="d-flex align-items-center justify-content-between">
        <h5 className="m-0">{title}</h5>
        <span className="text-dim small">Round order: {round.order}</span>
      </div>
      <div className="mt-2">
        {items.map((it, idx) => (
          <div key={`${title}-${idx}`} className="p-2 rounded mb-2" style={{ background: "rgba(255,255,255,0.04)" }}>
            {it.type === "Single" ? <SingleRow item={it as SingleItem} /> : <SupersetRow item={it as SupersetItem} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function SingleRow({ item }: { item: SingleItem }) {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center">
        <div className="fw-semibold">{item.exercise_name || item.exercise_id || "Exercise"}</div>
        <span className="badge" style={{ background: ACCENT, color: "#0b0f14" }}>Single</span>
      </div>
      <div className="small text-dim mt-1">
        {item.sets ? `${item.sets} sets` : ""}{item.sets && item.reps ? " • " : ""}
        {item.reps ? `reps ${item.reps}` : ""}
        {(item.weight_kg ?? null) !== null ? ` • ${item.weight_kg} kg` : ""}
        {(item.rest_s ?? null) !== null ? ` • rest ${item.rest_s}s` : ""}
      </div>
      {item.notes ? <div className="small mt-1">{item.notes}</div> : null}
    </>
  );
}

function SupersetRow({ item }: { item: SupersetItem }) {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center">
        <div className="fw-semibold">{item.name?.trim() || "Superset"}</div>
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
              {s.reps ?? ""}{(s.weight_kg ?? null) !== null ? ` • ${s.weight_kg} kg` : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="small text-dim mt-1">
        {(item.rest_s ?? null) !== null ? `Rest between sets: ${item.rest_s}s` : ""}
        {item.notes ? ` • ${item.notes}` : ""}
      </div>
    </>
  );
}

export default function AdminWorkoutViewPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const url = id ? `/api/workouts/admin/${encodeURIComponent(String(id))}` : null;

  const { data, error, isLoading } = useSWR<AdminWorkout>(url, fetcher, { revalidateOnFocus: false });

  if (status === "loading") return <div className="container py-4">Checking access…</div>;
  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4">
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <>
      <Head><title>{data?.workout_name ? `${data.workout_name} • Admin Workout` : "Admin Workout"}</title></Head>
      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="mb-3">
          <Link href="/admin" className="btn btn-outline-secondary">← Back to Admin</Link>
        </div>

        {isLoading && <div className="small text-dim">Loading workout…</div>}
        {error && <div className="alert alert-danger">Failed to load: {String(error.message || error)}</div>}

        {data && (
          <>
            <section className="bxkr-card p-3 mb-3">
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
                  <a className="btn btn-sm btn-outline-light" href={data.video_url} target="_blank" rel="noreferrer" style={{ borderRadius: 24 }}>
                    Watch Video
                  </a>
                </div>
              ) : null}

              <div className="d-flex gap-2 mt-3">
                {/* If you have an edit page that can prefill by ID, link it here. */}
                <Link
                  href={`/admin/workouts/gym-create?edit=${encodeURIComponent(data.workout_id)}`}
                  className="btn"
                  style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }}
                >
                  Edit This Workout
                </Link>
                <Link href={`/workouts/${encodeURIComponent(data.workout_id)}`} className="btn btn-outline-light" style={{ borderRadius: 24 }}>
                  Public View
                </Link>
              </div>
            </section>

            <RoundSection title={data.warmup?.name || "Warm Up"} round={data.warmup} />
            <RoundSection title={data.main?.name || "Main Set"} round={data.main || undefined} />
            <RoundSection title={data.finisher?.name || "Finisher"} round={data.finisher} />
          </>
        )}
      </main>
      <BottomNav />
    </>
  );
}
