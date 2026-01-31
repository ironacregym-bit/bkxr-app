import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
import BottomNav from "../../components/BottomNav";

const ACCENT = "#FF8A2A";
const fetcher = (u: string) =>
  fetch(u).then((r) => {
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
          <div
            key={i}
            className="d-flex align-items-center gap-2 small py-1"
            style={{ borderBottom: "1px dashed rgba(255,255,255,0.1)" }}
          >
            <span className="text-dim">#{i + 1}</span>
            <span className="fw-semibold">
              {s.exercise_name || s.exercise_id || "Exercise"}
            </span>
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

type LastCompletion = {
  workout_id?: string;
  calories_burned?: number;
  duration?: number; // minutes
  difficulty?: string;
  completed_date?: string | { seconds: number; nanoseconds: number };
  weight_completed_with?: string | number;
  notes?: string;
};

function toISODate(v: any): string | null {
  if (!v) return null;
  const d =
    typeof v?.toDate === "function"
      ? v.toDate()
      : v?.seconds
      ? new Date(v.seconds * 1000)
      : typeof v === "string"
      ? new Date(v)
      : null;
  return d && !isNaN(d.getTime()) ? d.toISOString() : null;
}

export default function WorkoutDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const url = buildUrl(id);
  const workoutId = typeof id === "string" ? id : null;

  const { data, error, isValidating } = useSWR<Workout>(url, fetcher, {
    revalidateOnFocus: false,
  });

  const lastKey =
    workoutId ? `/api/completions/last?workout_id=${encodeURIComponent(workoutId)}` : null;
  const { data: lastJson, error: lastErr } = useSWR<LastCompletion>(lastKey, (u) =>
    fetch(u).then((r) => (r.ok ? r.json() : null))
  );
  const last = lastJson || null;

  const loading = !error && (!data || isValidating);

  // ---- Complete modal
  const [showComplete, setShowComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [calories, setCalories] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [weightUsed, setWeightUsed] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const canSubmit =
    !!workoutId &&
    !saving &&
    // we at least require calories OR duration to avoid empty submissions
    (!!calories || !!duration || !!difficulty || !!notes || !!weightUsed);

  async function submitCompletion(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !workoutId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: any = {
        workout_id: workoutId,
      };
      if (calories) body.calories_burned = Number(calories);
      if (duration) body.duration = Number(duration); // minutes
      if (difficulty) body.difficulty = String(difficulty);
      if (weightUsed) body.weight_completed_with = isNaN(Number(weightUsed)) ? weightUsed : Number(weightUsed);
      if (notes) body.notes = String(notes);

      const res = await fetch("/api/completions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);

      setSaveMsg("Saved ✅");
      // Clear inputs but keep modal open so they can see the message
      setCalories("");
      setDuration("");
      setDifficulty("");
      setWeightUsed("");
      setNotes("");
    } catch (e: any) {
      setSaveMsg(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

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

              {/* Last completion chip */}
              {!lastErr && last ? (
                <div className="mt-2 small" style={{ opacity: 0.85 }}>
                  <span className="badge rounded-pill" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#cbd5e1" }}>
                    Last:{" "}
                    {typeof last.calories_burned === "number" ? `${Math.round(last.calories_burned)} kcal` : "—"}{" "}
                    · {typeof last.duration === "number" ? `${last.duration} min` : "—"}{" "}
                    · {toISODate(last.completed_date) ? new Date(toISODate(last.completed_date)!).toLocaleString() : ""}
                  </span>
                </div>
              ) : null}

              {data.notes ? <div className="mt-2">{data.notes}</div> : null}

              {data.video_url ? (
                <div className="mt-2">
                  <a
                    className="btn btn-sm btn-bxkr-outline"
                    href={data.video_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ borderRadius: 24 }}
                  >
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

              {/* New: Complete workout */}
              <button
                className="btn btn-bxkr"
                style={{
                  borderRadius: 24,
                  color: "#0b0f14",
                  background: `linear-gradient(90deg, ${ACCENT}, #ff7f32)`,
                }}
                onClick={() => setShowComplete(true)}
              >
                Complete workout
              </button>
            </div>
          </>
        )}
      </main>

      {/* Complete workout modal */}
      {showComplete && workoutId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed top-0 left-0 w-100 h-100"
          style={{
            zIndex: 1050,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
          onClick={() => !saving && setShowComplete(false)}
        >
          <div
            className="futuristic-card p-3"
            style={{ width: "100%", maxWidth: 720 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h5 className="mb-0">Complete workout</h5>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => !saving && setShowComplete(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="small text-dim">Log what you did. Calories burnt is the key field here.</div>

            <form onSubmit={submitCompletion} className="mt-3">
              <div className="row g-3">
                <div className="col-6 col-md-4">
                  <label className="form-label">Calories burnt (kcal)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    placeholder="e.g., 420"
                    inputMode="decimal"
                    min={0}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label">Duration (min)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g., 55"
                    inputMode="decimal"
                    min={0}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">Difficulty</label>
                  <select
                    className="form-select"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Weight used (optional)</label>
                  <input
                    className="form-control"
                    value={weightUsed}
                    onChange={(e) => setWeightUsed(e.target.value)}
                    placeholder="e.g., 24 kg kettlebell"
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything worth noting…"
                  />
                </div>
              </div>

              {saveMsg && (
                <div
                  className={`mt-3 alert ${saveMsg.includes("✅") ? "alert-success" : "alert-info"}`}
                >
                  {saveMsg}
                </div>
              )}

              <div className="d-flex gap-2 mt-3">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn"
                  style={{
                    borderRadius: 24,
                    color: "#0a0a0c",
                    background: canSubmit
                      ? `linear-gradient(90deg, ${ACCENT}, #ff7f32)`
                      : "linear-gradient(90deg, #777, #555)",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  {saving ? "Saving…" : "Save completion"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  style={{ borderRadius: 24 }}
                  onClick={() => !saving && setShowComplete(false)}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}
