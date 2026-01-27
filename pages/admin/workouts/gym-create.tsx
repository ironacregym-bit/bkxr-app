
"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useMemo, useState } from "react";
import BottomNav from "../../../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"] as const;
type DayName = typeof DAYS[number];

type SingleItem = {
  type: "Single";
  order: number;
  exercise_id: string;
  sets?: number;
  reps?: string;
  weight_kg?: number | null;
  rest_s?: number | null;
  notes?: string | null;
};

type SupersetSubItem = {
  exercise_id: string;
  reps?: string;
  weight_kg?: number | null;
};

type SupersetItem = {
  type: "Superset";
  order: number;
  name?: string | null;
  /** Unlimited sub-exercises now */
  items: SupersetSubItem[];
  /** Superset-level sets to complete (required in UI; default 3) */
  sets: number;
  rest_s?: number | null;
  notes?: string | null;
};

type GymRound = {
  name: string;
  order: number;
  items: Array<SingleItem | SupersetItem>;
};

export default function GymCreateWorkoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const ownerEmail = (session?.user?.email || "").toLowerCase();
  const role = (session?.user as any)?.role || "user";

  const { data } = useSWR("/api/exercises?limit=1000", fetcher, { revalidateOnFocus: false });
  const exercises = Array.isArray(data?.exercises) ? data!.exercises : [];

  // Base form + assignment/recurrence
  const [meta, setMeta] = useState({
    workout_name: "",
    focus: "",
    notes: "",
    video_url: "",
    visibility: "global" as "global" | "private",

    // New assignment & recurrence fields
    recurring: false,
    recurring_day: "Monday" as DayName,
    recurring_start: "" as string, // YYYY-MM-DD
    recurring_end: "" as string,   // YYYY-MM-DD
    assigned_to: ownerEmail || "",
  });

  const [warmup, setWarmup] = useState<GymRound | null>({ name: "Warm Up", order: 1, items: [] });
  const [main, setMain] = useState<GymRound>({ name: "Main Set", order: 2, items: [] });
  const [finisher, setFinisher] = useState<GymRound | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (status === "loading") return <div className="container py-4">Checking access…</div>;
  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4">
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  /** ---------- Helpers for Single Items ---------- */
  function addSingle(round: "warmup" | "main" | "finisher") {
    const newItem: SingleItem = { type: "Single", order: 1, exercise_id: "", reps: "", sets: 3 };
    if (round === "warmup")
      setWarmup((prev) => (prev ? { ...prev, items: [...prev.items, { ...newItem, order: prev.items.length + 1 }] } : prev));
    if (round === "main")
      setMain((prev) => ({ ...prev, items: [...prev.items, { ...newItem, order: prev.items.length + 1 }] }));
    if (round === "finisher")
      setFinisher((prev) =>
        prev ? { ...prev, items: [...prev.items, { ...newItem, order: prev.items.length + 1 }] } : { name: "Finisher", order: 3, items: [newItem] }
      );
  }

  function updateSingle(round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SingleItem>) {
    const up = (r: GymRound | null) =>
      r ? { ...r, items: r.items.map((it, i) => (i === idx ? { ...(it as SingleItem), ...patch } : it)) } : r;
    if (round === "warmup") setWarmup((prev) => up(prev));
    if (round === "main") setMain((prev) => up(prev) as GymRound);
    if (round === "finisher") setFinisher((prev) => up(prev));
  }

  /** ---------- Helpers for Supersets (unlimited items + sets at superset level) ---------- */
  function addSuperset(round: "warmup" | "main" | "finisher") {
    const newItem: SupersetItem = {
      type: "Superset",
      order: 1,
      name: "",
      items: [{ exercise_id: "", reps: "" }, { exercise_id: "", reps: "" }],
      sets: 3,
      rest_s: null,
    };
    if (round === "warmup")
      setWarmup((prev) => (prev ? { ...prev, items: [...prev.items, { ...newItem, order: prev.items.length + 1 }] } : prev));
    if (round === "main")
      setMain((prev) => ({ ...prev, items: [...prev.items, { ...newItem, order: prev.items.length + 1 }] }));
    if (round === "finisher")
      setFinisher((prev) =>
        prev ? { ...prev, items: [...prev.items, { ...newItem, order: prev.items.length + 1 }] } : { name: "Finisher", order: 3, items: [newItem] }
      );
  }

  function updateSuperset(round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SupersetItem>) {
    const up = (r: GymRound | null) =>
      r ? { ...r, items: r.items.map((it, i) => (i === idx ? { ...(it as SupersetItem), ...patch } : it)) } : r;
    if (round === "warmup") setWarmup((prev) => up(prev));
    if (round === "main") setMain((prev) => up(prev) as GymRound);
    if (round === "finisher") setFinisher((prev) => up(prev));
  }

  function setSupersetExercise(round: "warmup" | "main" | "finisher", idx: number, subIdx: number, exercise_id: string) {
    const up = (r: GymRound | null) =>
      r
        ? {
            ...r,
            items: r.items.map((it, i) => {
              if (i !== idx) return it;
              const ss = it as SupersetItem;
              const newItems = [...ss.items];
              newItems[subIdx] = { ...newItems[subIdx], exercise_id };
              return { ...ss, items: newItems };
            }),
          }
        : r;
    if (round === "warmup") setWarmup((prev) => up(prev));
    if (round === "main") setMain((prev) => up(prev) as GymRound);
    if (round === "finisher") setFinisher((prev) => up(prev));
  }

  function setSupersetReps(round: "warmup" | "main" | "finisher", idx: number, subIdx: number, reps: string) {
    const up = (r: GymRound | null) =>
      r
        ? {
            ...r,
            items: r.items.map((it, i) => {
              if (i !== idx) return it;
              const ss = it as SupersetItem;
              const newItems = [...ss.items];
              newItems[subIdx] = { ...newItems[subIdx], reps };
              return { ...ss, items: newItems };
            }),
          }
        : r;
    if (round === "warmup") setWarmup((prev) => up(prev));
    if (round === "main") setMain((prev) => up(prev) as GymRound);
    if (round === "finisher") setFinisher((prev) => up(prev));
  }

  function setSupersetWeight(round: "warmup" | "main" | "finisher", idx: number, subIdx: number, weight_kg: number | null) {
    const up = (r: GymRound | null) =>
      r
        ? {
            ...r,
            items: r.items.map((it, i) => {
              if (i !== idx) return it;
              const ss = it as SupersetItem;
              const newItems = [...ss.items];
              newItems[subIdx] = { ...newItems[subIdx], weight_kg };
              return { ...ss, items: newItems };
            }),
          }
        : r;
    if (round === "warmup") setWarmup((prev) => up(prev));
    if (round === "main") setMain((prev) => up(prev) as GymRound);
    if (round === "finisher") setFinisher((prev) => up(prev));
  }

  function addExerciseToSuperset(round: "warmup" | "main" | "finisher", idx: number) {
    const up = (r: GymRound | null) =>
      r
        ? {
            ...r,
            items: r.items.map((it, i) => {
              if (i !== idx) return it;
              const ss = it as SupersetItem;
              const next = [...ss.items, { exercise_id: "", reps: "" } as SupersetSubItem];
              return { ...ss, items: next };
            }),
          }
        : r;
    if (round === "warmup") setWarmup((prev) => up(prev));
    if (round === "main") setMain((prev) => up(prev) as GymRound);
    if (round === "finisher") setFinisher((prev) => up(prev));
  }

  function removeExerciseFromSuperset(round: "warmup" | "main" | "finisher", idx: number, subIdx: number) {
    const up = (r: GymRound | null) =>
      r
        ? {
            ...r,
            items: r.items.map((it, i) => {
              if (i !== idx) return it;
              const ss = it as SupersetItem;
              if (!ss.items || ss.items.length <= 1) return ss; // keep at least 1
              const next = ss.items.filter((_, j) => j !== subIdx);
              return { ...ss, items: next };
            }),
          }
        : r;
    if (round === "warmup") setWarmup((prev) => up(prev));
    if (round === "main") setMain((prev) => up(prev) as GymRound);
    if (round === "finisher") setFinisher((prev) => up(prev));
  }

  /** ---------- Save ---------- */
  function toISODateOrNull(s: string): string | null {
    if (!s) return null;
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return null;
    // normalise to 12:00 to avoid TZ midnight drift when server reads it as local
    dt.setHours(12, 0, 0, 0);
    return dt.toISOString();
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      // Client-side validation for recurring fields
      if (meta.recurring) {
        if (!meta.assigned_to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(meta.assigned_to)) {
          throw new Error("Please enter a valid email for 'Assigned To'.");
        }
        if (!DAYS.includes(meta.recurring_day)) {
          throw new Error("Please choose a valid recurring day.");
        }
        if (!meta.recurring_start || !meta.recurring_end) {
          throw new Error("Please choose both a start and end date for recurrence.");
        }
        const start = new Date(meta.recurring_start);
        const end = new Date(meta.recurring_end);
        if (start > end) {
          throw new Error("Recurring start date must be before end date.");
        }
      }

      const body = {
        visibility: meta.visibility,
        owner_email: meta.visibility === "private" ? ownerEmail : undefined,
        workout_name: meta.workout_name.trim(),
        focus: meta.focus.trim() || undefined,
        notes: meta.notes.trim() || undefined,
        video_url: meta.video_url.trim() || undefined,
        warmup,
        main,
        finisher,

        // New fields (API will validate & coerce)
        recurring: !!meta.recurring,
        recurring_day: meta.recurring ? meta.recurring_day : null,
        recurring_start: meta.recurring ? toISODateOrNull(meta.recurring_start) : null,
        recurring_end: meta.recurring ? toISODateOrNull(meta.recurring_end) : null,
        assigned_to: meta.recurring ? meta.assigned_to.trim().toLowerCase() : null,
      };

      const res = await fetch("/api/workouts/gym-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create gym workout");
      setMsg("Created ✅");
      setTimeout(() => router.push(`/admin/workouts/${json.workout_id}`), 700);
    } catch (e: any) {
      setMsg(e?.message || "Failed to create workout");
    } finally {
      setSaving(false);
    }
  }

  /** ---------- UI ---------- */

  function SupersetBlock({
    round,
    it,
    idx,
  }: {
    round: "warmup" | "main" | "finisher";
    it: SupersetItem;
    idx: number;
  }) {
    return (
      <>
        <div className="col-12 col-md-4">
          <label className="form-label">Superset name</label>
          <input
            className="form-control"
            value={it.name ?? ""}
            onChange={(e) => updateSuperset(round, idx, { name: e.target.value })}
          />
          <div className="row mt-2 g-2">
            <div className="col-6">
              <label className="form-label">Sets (rounds)</label>
              <input
                className="form-control"
                type="number"
                min={1}
                value={Number.isFinite(it.sets) ? it.sets : 3}
                onChange={(e) => updateSuperset(round, idx, { sets: Math.max(1, Number(e.target.value) || 3) })}
              />
            </div>
            <div className="col-6">
              <label className="form-label">Rest between sets (s)</label>
              <input
                className="form-control"
                type="number"
                min={0}
                value={it.rest_s ?? ""}
                onChange={(e) => updateSuperset(round, idx, { rest_s: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>

        {/* Dynamic list of sub-exercises */}
        <div className="col-12 col-md-8">
          {Array.isArray(it.items) && it.items.length > 0 ? (
            it.items.map((s, sidx) => (
              <div key={`${idx}-${sidx}`} className="row g-2 align-items-end mb-2">
                <div className="col-12 col-md-5">
                  <label className="form-label">Exercise</label>
                  <select
                    className="form-select"
                    value={s.exercise_id}
                    onChange={(e) => setSupersetExercise(round, idx, sidx, e.target.value)}
                  >
                    <option value="">— Select —</option>
                    {exercises.map((e: any) => (
                      <option key={e.id} value={e.id}>
                        {e.exercise_name} {e.type ? `• ${e.type}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Reps</label>
                  <input
                    className="form-control"
                    value={s.reps ?? ""}
                    onChange={(e) => setSupersetReps(round, idx, sidx, e.target.value)}
                  />
                </div>
                <div className="col-4 col-md-2">
                  <label className="form-label">Weight (kg)</label>
                  <input
                    className="form-control"
                    type="number"
                    min={0}
                    value={s.weight_kg ?? ""}
                    onChange={(e) => setSupersetWeight(round, idx, sidx, Number(e.target.value) || null)}
                  />
                </div>
                <div className="col-2 col-md-2 d-flex">
                  <button
                    type="button"
                    className="btn btn-outline-danger ms-auto"
                    onClick={() => removeExerciseFromSuperset(round, idx, sidx)}
                    title="Remove exercise from superset"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-dim small">No exercises yet.</div>
          )}

          <button
            type="button"
            className="btn btn-sm btn-outline-light mt-2"
            style={{ borderRadius: 24 }}
            onClick={() => addExerciseToSuperset(round, idx)}
          >
            + Add Exercise to Superset
          </button>
        </div>
      </>
    );
  }

  const AssignmentSection = useMemo(() => {
    return (
      <section className="futuristic-card p-3 mb-3">
        <h6 className="m-0 mb-2">Assignment & Recurrence</h6>
        <div className="row g-2">
          <div className="col-12 col-md-4">
            <div className="form-check form-switch mt-1">
              <input
                className="form-check-input"
                type="checkbox"
                id="recurringSwitch"
                checked={meta.recurring}
                onChange={(e) => setMeta({ ...meta, recurring: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="recurringSwitch">
                Recurring (weekly)
              </label>
            </div>
            <small className="text-dim d-block mt-1">When on: this session repeats weekly and becomes the user’s mandatory workout for that weekday.</small>
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label">Assigned To (email)</label>
            <input
              className="form-control"
              type="email"
              value={meta.assigned_to}
              onChange={(e) => setMeta({ ...meta, assigned_to: e.target.value })}
              placeholder="athlete@example.com"
              disabled={!meta.recurring}
            />
            <small className="text-dim">Defaults to your email</small>
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label">Recurring Day</label>
            <select
              className="form-select"
              value={meta.recurring_day}
              onChange={(e) => setMeta({ ...meta, recurring_day: e.target.value as DayName })}
              disabled={!meta.recurring}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label">Start Date</label>
            <input
              className="form-control"
              type="date"
              value={meta.recurring_start}
              onChange={(e) => setMeta({ ...meta, recurring_start: e.target.value })}
              disabled={!meta.recurring}
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">End Date</label>
            <input
              className="form-control"
              type="date"
              value={meta.recurring_end}
              onChange={(e) => setMeta({ ...meta, recurring_end: e.target.value })}
              disabled={!meta.recurring}
            />
          </div>
        </div>
      </section>
    );
  }, [meta]);

  return (
    <>
      <Head><title>Create Gym Workout • Admin</title></Head>
      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="mb-3">
          <Link href="/admin" className="btn btn-outline-secondary">← Back to Admin</Link>
        </div>

        <h2 className="mb-3">Create Gym Workout</h2>
        {msg && <div className={`alert ${msg.includes("Failed") ? "alert-danger" : "alert-info"}`}>{msg}</div>}

        {/* Meta */}
        <section className="futuristic-card p-3 mb-3">
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Workout Name</label>
              <input
                className="form-control"
                value={meta.workout_name}
                onChange={(e) => setMeta({ ...meta, workout_name: e.target.value })}
              />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Visibility</label>
              <select
                className="form-select"
                value={meta.visibility}
                onChange={(e) => setMeta({ ...meta, visibility: e.target.value as any })}
              >
                <option value="global">Global</option>
                <option value="private">Private</option>
              </select>
              {meta.visibility === "private" && <small className="text-muted">Owner: {ownerEmail || "—"}</small>}
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Focus</label>
              <input
                className="form-control"
                value={meta.focus}
                onChange={(e) => setMeta({ ...meta, focus: e.target.value })}
                placeholder="e.g., Upper Body"
              />
            </div>
            <div className="col-12">
              <label className="form-label">Notes</label>
              <textarea
                className="form-control"
                value={meta.notes}
                onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Video URL</label>
              <input
                className="form-control"
                value={meta.video_url}
                onChange={(e) => setMeta({ ...meta, video_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>
        </section>

        {/* Assignment & Recurrence */}
        {AssignmentSection}

        {/* Warm Up */}
        <section className="futuristic-card p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="m-0">Warm Up</h6>
            <div className="d-flex gap-2">
              <button
                className="btn btn-sm"
                style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }}
                onClick={() => addSingle("warmup")}
              >
                + Single
              </button>
              <button
                className="btn btn-sm btn-outline-light"
                style={{ borderRadius: 24 }}
                onClick={() => addSuperset("warmup")}
              >
                + Superset
              </button>
            </div>
          </div>
          {warmup?.items.length ? (
            warmup.items.map((it, idx) => (
              <div key={`wu-${idx}`} className="row g-2 mb-2">
                {it.type === "Single" ? (
                  <>
                    <div className="col-12 col-md-4">
                      <label className="form-label">Exercise</label>
                      <select
                        className="form-select"
                        value={(it as SingleItem).exercise_id}
                        onChange={(e) => updateSingle("warmup", idx, { exercise_id: e.target.value })}
                      >
                        <option value="">— Select —</option>
                        {exercises.map((e: any) => (
                          <option key={e.id} value={e.id}>
                            {e.exercise_name} {e.type ? `• ${e.type}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-4 col-md-2">
                      <label className="form-label">Sets</label>
                      <input
                        className="form-control"
                        type="number"
                        min={1}
                        value={(it as SingleItem).sets ?? ""}
                        onChange={(e) => updateSingle("warmup", idx, { sets: Number(e.target.value) || undefined })}
                      />
                    </div>
                    <div className="col-8 col-md-3">
                      <label className="form-label">Reps</label>
                      <input
                        className="form-control"
                        value={(it as SingleItem).reps ?? ""}
                        onChange={(e) => updateSingle("warmup", idx, { reps: e.target.value })}
                        placeholder="e.g., 10 or 10-8-6"
                      />
                    </div>
                    <div className="col-6 col-md-2">
                      <label className="form-label">Weight (kg)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={(it as SingleItem).weight_kg ?? ""}
                        onChange={(e) => updateSingle("warmup", idx, { weight_kg: Number(e.target.value) || null })}
                      />
                    </div>
                    <div className="col-6 col-md-1">
                      <label className="form-label">Rest (s)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={(it as SingleItem).rest_s ?? ""}
                        onChange={(e) => updateSingle("warmup", idx, { rest_s: Number(e.target.value) || null })}
                      />
                    </div>
                  </>
                ) : (
                  <SupersetBlock round="warmup" it={it as SupersetItem} idx={idx} />
                )}
              </div>
            ))
          ) : (
            <div className="small text-dim">Add warm-up items.</div>
          )}
        </section>

        {/* Main */}
        <section className="futuristic-card p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="m-0">Main Set</h6>
            <div className="d-flex gap-2">
              <button
                className="btn btn-sm"
                style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }}
                onClick={() => addSingle("main")}
              >
                + Single
              </button>
              <button
                className="btn btn-sm btn-outline-light"
                style={{ borderRadius: 24 }}
                onClick={() => addSuperset("main")}
              >
                + Superset
              </button>
            </div>
          </div>
          {main.items.length ? (
            main.items.map((it, idx) => (
              <div key={`main-${idx}`} className="row g-2 mb-2">
                {it.type === "Single" ? (
                  <>
                    <div className="col-12 col-md-4">
                      <label className="form-label">Exercise</label>
                      <select
                        className="form-select"
                        value={(it as SingleItem).exercise_id}
                        onChange={(e) => updateSingle("main", idx, { exercise_id: e.target.value })}
                      >
                        <option value="">— Select —</option>
                        {exercises.map((e: any) => (
                          <option key={e.id} value={e.id}>
                            {e.exercise_name} {e.type ? `• ${e.type}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-4 col-md-2">
                      <label className="form-label">Sets</label>
                      <input
                        className="form-control"
                        type="number"
                        min={1}
                        value={(it as SingleItem).sets ?? ""}
                        onChange={(e) => updateSingle("main", idx, { sets: Number(e.target.value) || undefined })}
                      />
                    </div>
                    <div className="col-8 col-md-3">
                      <label className="form-label">Reps</label>
                      <input
                        className="form-control"
                        value={(it as SingleItem).reps ?? ""}
                        onChange={(e) => updateSingle("main", idx, { reps: e.target.value })}
                      />
                    </div>
                    <div className="col-6 col-md-2">
                      <label className="form-label">Weight (kg)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={(it as SingleItem).weight_kg ?? ""}
                        onChange={(e) => updateSingle("main", idx, { weight_kg: Number(e.target.value) || null })}
                      />
                    </div>
                    <div className="col-6 col-md-1">
                      <label className="form-label">Rest (s)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={(it as SingleItem).rest_s ?? ""}
                        onChange={(e) => updateSingle("main", idx, { rest_s: Number(e.target.value) || null })}
                      />
                    </div>
                  </>
                ) : (
                  <SupersetBlock round="main" it={it as SupersetItem} idx={idx} />
                )}
              </div>
            ))
          ) : (
            <div className="small text-dim">Add main set items.</div>
          )}
        </section>

        {/* Finisher */}
        <section className="futuristic-card p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="m-0">Finisher</h6>
            <div className="d-flex gap-2">
              <button
                className="btn btn-sm"
                style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }}
                onClick={() => addSingle("finisher")}
              >
                + Single
              </button>
              <button
                className="btn btn-sm btn-outline-light"
                style={{ borderRadius: 24 }}
                onClick={() => addSuperset("finisher")}
              >
                + Superset
              </button>
            </div>
          </div>
          {!finisher?.items?.length ? (
            <div className="small text-dim">Optional finisher.</div>
          ) : (
            finisher.items.map((it, idx) => (
              <div key={`fin-${idx}`} className="row g-2 mb-2">
                {it.type === "Single" ? (
                  <>
                    <div className="col-12 col-md-4">
                      <label className="form-label">Exercise</label>
                      <select
                        className="form-select"
                        value={(it as SingleItem).exercise_id}
                        onChange={(e) => updateSingle("finisher", idx, { exercise_id: e.target.value })}
                      >
                        <option value="">— Select —</option>
                        {exercises.map((e: any) => (
                          <option key={e.id} value={e.id}>
                            {e.exercise_name} {e.type ? `• ${e.type}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-4 col-md-2">
                      <label className="form-label">Sets</label>
                      <input
                        className="form-control"
                        type="number"
                        min={1}
                        value={(it as SingleItem).sets ?? ""}
                        onChange={(e) => updateSingle("finisher", idx, { sets: Number(e.target.value) || undefined })}
                      />
                    </div>
                    <div className="col-8 col-md-3">
                      <label className="form-label">Reps</label>
                      <input
                        className="form-control"
                        value={(it as SingleItem).reps ?? ""}
                        onChange={(e) => updateSingle("finisher", idx, { reps: e.target.value })}
                      />
                    </div>
                    <div className="col-6 col-md-2">
                      <label className="form-label">Weight (kg)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={(it as SingleItem).weight_kg ?? ""}
                        onChange={(e) => updateSingle("finisher", idx, { weight_kg: Number(e.target.value) || null })}
                      />
                    </div>
                    <div className="col-6 col-md-1">
                      <label className="form-label">Rest (s)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={(it as SingleItem).rest_s ?? ""}
                        onChange={(e) => updateSingle("finisher", idx, { rest_s: Number(e.target.value) || null })}
                      />
                    </div>
                  </>
                ) : (
                  <SupersetBlock round="finisher" it={it as SupersetItem} idx={idx} />
                )}
              </div>
            ))
          )}
        </section>

        <button
          className="btn btn-primary w-100 mt-2"
          onClick={save}
          disabled={saving}
          style={{ borderRadius: 24, background: ACCENT, border: "none" }}
        >
          {saving ? "Saving…" : "Create Gym Workout"}
        </button>
      </main>
      <BottomNav />
    </>
  );
}
