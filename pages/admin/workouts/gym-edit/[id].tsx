// pages/admin/workouts/gym-edit/[id].tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import React, { useEffect, useMemo, useState } from "react";
import BottomNav from "../../../../components/BottomNav";

const ACCENT = "#FF8A2A";
const fetcher = (u: string) => fetch(u).then((r) => r.json());

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type DayName = typeof DAYS[number];

/* ---------- Helpers ---------- */
const mkUid = () => {
  try {
    // @ts-ignore
    return crypto?.randomUUID ? crypto.randomUUID() : `uid_${Math.random().toString(36).slice(2)}`;
  } catch {
    return `uid_${Math.random().toString(36).slice(2)}`;
  }
};
// Firestore TS/Date/number/string → "YYYY-MM-DD"
function toYMD(input: any): string {
  if (!input) return "";
  try {
    if (typeof input === "string") {
      const s = input.trim();
      if (/\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const d = new Date(s);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    if (typeof input === "object" && input && typeof input.seconds === "number") {
      const ms = input.seconds * 1000 + (input.nanoseconds ? input.nanoseconds / 1e6 : 0);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    if (input instanceof Date) return isNaN(input.getTime()) ? "" : input.toISOString().slice(0, 10);
    if (typeof input === "number") {
      const d = new Date(input);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    const s = String(input);
    if (/\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}
const safeLower = (v: any, fallback = ""): string =>
  typeof v === "string" ? v.toLowerCase() : (typeof fallback === "string" ? fallback.toLowerCase() : "");

/* ---------- Types (UI) ---------- */
type SingleItem = {
  uid: string;
  type: "Single";
  order: number;
  exercise_id: string;
  sets?: number;
  reps?: string;
  weight_kg?: number | null;
  rest_s?: number | null;
  notes?: string | null;
};
type SupersetSubItem = { uid: string; exercise_id: string; reps?: string; weight_kg?: number | null };
type SupersetItem = {
  uid: string;
  type: "Superset";
  order: number;
  name?: string | null;
  items: SupersetSubItem[];
  sets: number;
  rest_s?: number | null;
  notes?: string | null;
};
type GymRound = { name: string; order: number; items: Array<SingleItem | SupersetItem> };

/* ---------- Fetched types (soft) ---------- */
type AdminRoundFetch = { name: string; order: number; items?: any[] };
type AdminWorkoutFetch = {
  workout_id: string;
  workout_name: string;
  visibility: "global" | "private";
  owner_email?: string | null;
  focus?: string | null;
  notes?: string | null;
  video_url?: string | null;
  warmup?: AdminRoundFetch | null;
  main?: AdminRoundFetch | null;
  finisher?: AdminRoundFetch | null;
  recurring?: boolean;
  recurring_day?: DayName | string | null;
  recurring_start?: any;
  recurring_end?: any;
  assigned_to?: any;
};

export default function GymEditWorkoutPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const ownerEmail = (session?.user?.email || "").toLowerCase();
  const router = useRouter();
  const { id } = router.query;

  const isAllowed = !!session && (role === "admin" || role === "gym");

  const workoutKey = useMemo(
    () => (id ? `/api/workouts/admin/${encodeURIComponent(String(id))}` : null),
    [id]
  );
  const { data: workoutResp, isLoading, error } = useSWR<AdminWorkoutFetch>(workoutKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  // Meta
  const [meta, setMeta] = useState({
    workout_name: "",
    focus: "",
    notes: "",
    video_url: "",
    visibility: "global" as "global" | "private",
    recurring: false,
    recurring_day: "Monday" as DayName,
    recurring_start: "" as string,
    recurring_end: "" as string,
    assigned_to: ownerEmail || "",
  });

  // Rounds
  const [warmup, setWarmup] = useState<GymRound | null>(null);
  const [main, setMain] = useState<GymRound | null>(null);
  const [finisher, setFinisher] = useState<GymRound | null>(null);

  // Status
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /* ---------- Map fetched → UI ---------- */
  function renumber<T extends { order: number }>(items: T[]): T[] {
    return items.map((it, i) => ({ ...it, order: i + 1 }));
  }
  function newSupersetSub(): SupersetSubItem {
    return { uid: mkUid(), exercise_id: "", reps: "", weight_kg: null };
  }
  function toUIRound(r?: AdminRoundFetch | null, fallbackName = "Round", fallbackOrder = 1): GymRound | null {
    if (!r) return null;
    const uiItems: Array<SingleItem | SupersetItem> = (Array.isArray(r.items) ? r.items : []).map((it: any, idx) => {
      const order = Number.isFinite(it?.order) ? it.order : idx + 1;
      if (String(it?.type) === "Superset") {
        const subs: any[] = Array.isArray(it.items)
          ? it.items
          : Array.isArray(it.superset_items)
          ? it.superset_items
          : [];
        const mappedSubs: SupersetSubItem[] = (subs.length ? subs : [{}]).map((s: any) => ({
          uid: mkUid(),
          exercise_id: String(s?.exercise_id || ""),
          reps: typeof s?.reps === "string" ? s.reps : s?.reps != null ? String(s.reps) : "",
          weight_kg: typeof s?.weight_kg === "number" ? s.weight_kg : s?.weight_kg ?? null,
        }));
        return {
          uid: mkUid(),
          type: "Superset",
          order,
          name: (it?.name ?? "") || "",
          items: mappedSubs,
          sets: Number.isFinite(it?.sets) ? it.sets : 3,
          rest_s: it?.rest_s ?? null,
          notes: it?.notes ?? null,
        };
      }
      return {
        uid: mkUid(),
        type: "Single",
        order,
        exercise_id: String(it?.exercise_id || ""),
        sets: Number.isFinite(it?.sets) ? it.sets : undefined,
        reps: typeof it?.reps === "string" ? it.reps : it?.reps != null ? String(it.reps) : "",
        weight_kg: typeof it?.weight_kg === "number" ? it.weight_kg : it?.weight_kg ?? null,
        rest_s: it?.rest_s ?? null,
        notes: it?.notes ?? null,
      };
    });
    return { name: r.name || fallbackName, order: Number.isFinite(r.order) ? r.order : fallbackOrder, items: uiItems };
  }

  // Prefill once
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!isAllowed || !workoutResp || prefilled) return;

    const dayRaw = (workoutResp.recurring_day ?? "") as string;
    const day = (DAYS as readonly string[]).includes(dayRaw) ? (dayRaw as DayName) : ("Monday" as DayName);

    setMeta({
      workout_name: workoutResp.workout_name || "",
      focus: workoutResp.focus || "",
      notes: workoutResp.notes || "",
      video_url: workoutResp.video_url || "",
      visibility: workoutResp.visibility || "global",
      recurring: !!workoutResp.recurring,
      recurring_day: day,
      recurring_start: toYMD(workoutResp.recurring_start),
      recurring_end: toYMD(workoutResp.recurring_end),
      assigned_to: safeLower(workoutResp.assigned_to, ownerEmail),
    });

    setWarmup(toUIRound(workoutResp.warmup, "Warm Up", 1));
    setMain(toUIRound(workoutResp.main || { name: "Main Set", order: 2, items: [] }, "Main Set", 2));
    setFinisher(toUIRound(workoutResp.finisher, "Finisher", 3));

    setPrefilled(true);
  }, [isAllowed, workoutResp, prefilled, ownerEmail]);

  /* ---------- UI helpers ---------- */
  function addSingle(where: "warmup" | "main" | "finisher") {
    const newItem: SingleItem = { uid: mkUid(), type: "Single", order: 1, exercise_id: "", reps: "", sets: 3 };
    if (where === "warmup")
      setWarmup((prev) => (prev ? { ...prev, items: renumber([...prev.items, { ...newItem, order: prev.items.length + 1 }]) } : { name: "Warm Up", order: 1, items: [newItem] }));
    if (where === "main")
      setMain((prev) => (prev ? { ...prev, items: renumber([...prev.items, { ...newItem, order: prev.items.length + 1 }]) } : { name: "Main Set", order: 2, items: [newItem] }));
    if (where === "finisher")
      setFinisher((prev) => (prev ? { ...prev, items: renumber([...prev.items, { ...newItem, order: prev.items.length + 1 }]) } : { name: "Finisher", order: 3, items: [newItem] }));
  }
  function addSuperset(where: "warmup" | "main" | "finisher") {
    const ss: SupersetItem = { uid: mkUid(), type: "Superset", order: 1, name: "", items: [newSupersetSub(), newSupersetSub()], sets: 3, rest_s: null };
    if (where === "warmup")
      setWarmup((prev) => (prev ? { ...prev, items: renumber([...prev.items, { ...ss, order: prev.items.length + 1 }]) } : { name: "Warm Up", order: 1, items: [ss] }));
    if (where === "main")
      setMain((prev) => (prev ? { ...prev, items: renumber([...prev.items, { ...ss, order: prev.items.length + 1 }]) } : { name: "Main Set", order: 2, items: [ss] }));
    if (where === "finisher")
      setFinisher((prev) => (prev ? { ...prev, items: renumber([...prev.items, { ...ss, order: prev.items.length + 1 }]) } : { name: "Finisher", order: 3, items: [ss] }));
  }
  function updateSingle(where: "warmup" | "main" | "finisher", idx: number, patch: Partial<SingleItem>) {
    const up = (r: GymRound | null) => (r ? { ...r, items: r.items.map((it, i) => (i === idx ? { ...(it as SingleItem), ...patch } : it)) } : r);
    if (where === "warmup") setWarmup((prev) => up(prev));
    if (where === "main") setMain((prev) => up(prev));
    if (where === "finisher") setFinisher((prev) => up(prev));
  }
  function updateSuperset(where: "warmup" | "main" | "finisher", idx: number, patch: Partial<SupersetItem>) {
    const up = (r: GymRound | null) => (r ? { ...r, items: r.items.map((it, i) => (i === idx ? { ...(it as SupersetItem), ...patch } : it)) } : r);
    if (where === "warmup") setWarmup((prev) => up(prev));
    if (where === "main") setMain((prev) => up(prev));
    if (where === "finisher") setFinisher((prev) => up(prev));
  }
  function setSupersetSub(where: "warmup" | "main" | "finisher", idx: number, subIdx: number, patch: Partial<SupersetSubItem>) {
    const up = (r: GymRound | null) =>
      r
        ? {
            ...r,
            items: r.items.map((it, i) => {
              if (i !== idx) return it;
              const ss = it as SupersetItem;
              const arr = [...ss.items];
              arr[subIdx] = { ...arr[subIdx], ...patch };
              return { ...ss, items: arr };
            }),
          }
        : r;
    if (where === "warmup") setWarmup((prev) => up(prev));
    if (where === "main") setMain((prev) => up(prev));
    if (where === "finisher") setFinisher((prev) => up(prev));
  }
  function addSupersetSub(where: "warmup" | "main" | "finisher", idx: number) {
    const up = (r: GymRound | null) =>
      r
        ? {
            ...r,
            items: r.items.map((it, i) => {
              if (i !== idx) return it;
              const ss = it as SupersetItem;
              return { ...ss, items: [...ss.items, newSupersetSub()] };
            }),
          }
        : r;
    if (where === "warmup") setWarmup((prev) => up(prev));
    if (where === "main") setMain((prev) => up(prev));
    if (where === "finisher") setFinisher((prev) => up(prev));
  }
  function removeSupersetSub(where: "warmup" | "main" | "finisher", idx: number, subIdx: number) {
    const up = (r: GymRound | null) =>
      r
        ? {
            ...r,
            items: r.items.map((it, i) => {
              if (i !== idx) return it;
              const ss = it as SupersetItem;
              if (ss.items.length <= 1) return ss;
              const next = ss.items.filter((_, j) => j !== subIdx);
              return { ...ss, items: next };
            }),
          }
        : r;
    if (where === "warmup") setWarmup((prev) => up(prev));
    if (where === "main") setMain((prev) => up(prev));
    if (where === "finisher") setFinisher((prev) => up(prev));
  }
  function removeItem(where: "warmup" | "main" | "finisher", idx: number) {
    const drop = (r: GymRound | null) => {
      if (!r) return r;
      const next = r.items.filter((_, i) => i !== idx);
      if (next.length === 0 && r.name === "Finisher") return null;
      return { ...r, items: renumber(next) };
    };
    if (where === "warmup") setWarmup((prev) => drop(prev));
    if (where === "main") setMain((prev) => drop(prev));
    if (where === "finisher") setFinisher((prev) => drop(prev));
  }

  /* ---------- Save ---------- */
  function stripRound(r: GymRound | null): any | null {
    if (!r) return null;
    return {
      name: r.name,
      order: r.order,
      items: r.items.map((it) => {
        if (it.type === "Superset") {
          const ss = it as SupersetItem;
          return {
            type: "Superset",
            order: ss.order,
            name: ss.name || "",
            sets: Number.isFinite(ss.sets) ? ss.sets : 3,
            rest_s: ss.rest_s ?? null,
            notes: ss.notes ?? null,
            items: ss.items.map((s) => ({ exercise_id: s.exercise_id, reps: s.reps || "", weight_kg: s.weight_kg ?? null })),
          };
        }
        const si = it as SingleItem;
        return {
          type: "Single",
          order: si.order,
          exercise_id: si.exercise_id,
          sets: si.sets,
          reps: si.reps || "",
          weight_kg: si.weight_kg ?? null,
          rest_s: si.rest_s ?? null,
          notes: si.notes ?? null,
        };
      }),
    };
  }
  function toISODateOrNull(s: string): string | null {
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  }
  async function save() {
    if (!id) return;
    try {
      setSaving(true);
      setMsg("Saving…");

      if (meta.recurring) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(meta.assigned_to)) throw new Error("Assigned To must be a valid email.");
        if (!DAYS.includes(meta.recurring_day)) throw new Error("Choose a valid recurring day.");
        if (!meta.recurring_start || !meta.recurring_end) throw new Error("Provide both recurring start and end dates.");
        if (new Date(meta.recurring_start) > new Date(meta.recurring_end)) throw new Error("Start must be before end.");
      }

      const payload = {
        workout_id: String(id),
        workout_name: meta.workout_name.trim(),
        visibility: meta.visibility,
        owner_email: meta.visibility === "private" ? ownerEmail : undefined,
        focus: meta.focus.trim() || undefined,
        notes: meta.notes.trim() || undefined,
        video_url: meta.video_url.trim() || undefined,
        warmup: stripRound(warmup),
        main: stripRound(main),
        finisher: stripRound(finisher),
        recurring: !!meta.recurring,
        recurring_day: meta.recurring ? meta.recurring_day : null,
        recurring_start: meta.recurring ? toISODateOrNull(meta.recurring_start) : null,
        recurring_end: meta.recurring ? toISODateOrNull(meta.recurring_end) : null,
        assigned_to: meta.recurring ? meta.assigned_to.trim().toLowerCase() : null,
      };

      const res = await fetch("/api/workouts/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to update workout");
      setMsg("Saved ✅");
      setTimeout(() => router.push(`/admin/workouts/${encodeURIComponent(String(id))}`), 600);
    } catch (e: any) {
      setMsg(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head>
        <title>Edit Gym Workout • Admin</title>
      </Head>
      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="mb-3">
          <Link href="/admin" className="btn btn-outline-secondary">← Back to Admin</Link>
        </div>

        <h2 className="mb-2">{workoutResp?.workout_name || "Edit Gym Workout"}</h2>
        {error && <div className="alert alert-danger">Failed to load this workout.</div>}
        {isLoading && <div className="small text-dim">Loading workout…</div>}

        {/* Meta */}
        <section className="futuristic-card p-3 mb-3">
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Workout Name</label>
              <input className="form-control" value={meta.workout_name} onChange={(e) => setMeta({ ...meta, workout_name: e.target.value })} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Visibility</label>
              <select className="form-select" value={meta.visibility} onChange={(e) => setMeta({ ...meta, visibility: e.target.value as any })}>
                <option value="global">Global</option>
                <option value="private">Private</option>
              </select>
              {meta.visibility === "private" && <small className="text-muted">Owner: {ownerEmail || "—"}</small>}
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Focus</label>
              <input className="form-control" value={meta.focus} onChange={(e) => setMeta({ ...meta, focus: e.target.value })} placeholder="e.g., Upper Body" />
            </div>
            <div className="col-12">
              <label className="form-label">Notes</label>
              <textarea className="form-control" value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Video URL</label>
              <input className="form-control" value={meta.video_url} onChange={(e) => setMeta({ ...meta, video_url: e.target.value })} placeholder="https://…" />
            </div>
          </div>
        </section>

        {/* Assignment & Recurrence */}
        <section className="futuristic-card p-3 mb-3">
          <h6 className="m-0 mb-2">Assignment & Recurrence</h6>
          <div className="row g-2">
            <div className="col-12 col-md-4">
              <div className="form-check form-switch mt-1">
                <input className="form-check-input" type="checkbox" id="recurringSwitch" checked={meta.recurring} onChange={(e) => setMeta({ ...meta, recurring: e.target.checked })} />
                <label className="form-check-label" htmlFor="recurringSwitch">Recurring (weekly)</label>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">Assigned To (email)</label>
              <input className="form-control" type="email" value={meta.assigned_to} onChange={(e) => setMeta({ ...meta, assigned_to: e.target.value })} disabled={!meta.recurring} />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">Recurring Day</label>
              <select className="form-select" value={meta.recurring_day} onChange={(e) => setMeta({ ...meta, recurring_day: e.target.value as DayName })} disabled={!meta.recurring}>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Start Date</label>
              <input className="form-control" type="date" value={meta.recurring_start} onChange={(e) => setMeta({ ...meta, recurring_start: e.target.value })} disabled={!meta.recurring} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">End Date</label>
              <input className="form-control" type="date" value={meta.recurring_end} onChange={(e) => setMeta({ ...meta, recurring_end: e.target.value })} disabled={!meta.recurring} />
            </div>
          </div>
        </section>

        {/* Warm Up */}
        <RoundSection
          title="Warm Up"
          round={warmup}
          setRound={setWarmup}
          addSingle={() => addSingle("warmup")}
          addSuperset={() => addSuperset("warmup")}
          updateSingle={(i, p) => updateSingle("warmup", i, p)}
          updateSuperset={(i, p) => updateSuperset("warmup", i, p)}
          removeItem={(i) => removeItem("warmup", i)}
          setSupersetExercise={(i, si, idv) => setSupersetSub("warmup", i, si, { exercise_id: idv })}
          setSupersetReps={(i, si, v) => setSupersetSub("warmup", i, si, { reps: v })}
          setSupersetWeight={(i, si, v) => setSupersetSub("warmup", i, si, { weight_kg: v })}
          addExerciseToSuperset={(i) => addSupersetSub("warmup", i)}
          removeExerciseFromSuperset={(i, si) => removeSupersetSub("warmup", i, si)}
        />

        {/* Main Set */}
        <RoundSection
          title="Main Set"
          round={main}
          setRound={setMain}
          addSingle={() => addSingle("main")}
          addSuperset={() => addSuperset("main")}
          updateSingle={(i, p) => updateSingle("main", i, p)}
          updateSuperset={(i, p) => updateSuperset("main", i, p)}
          removeItem={(i) => removeItem("main", i)}
          setSupersetExercise={(i, si, idv) => setSupersetSub("main", i, si, { exercise_id: idv })}
          setSupersetReps={(i, si, v) => setSupersetSub("main", i, si, { reps: v })}
          setSupersetWeight={(i, si, v) => setSupersetSub("main", i, si, { weight_kg: v })}
          addExerciseToSuperset={(i) => addSupersetSub("main", i)}
          removeExerciseFromSuperset={(i, si) => removeSupersetSub("main", i, si)}
        />

        {/* Finisher */}
        <RoundSection
          title="Finisher"
          round={finisher}
          setRound={setFinisher}
          addSingle={() => addSingle("finisher")}
          addSuperset={() => addSuperset("finisher")}
          updateSingle={(i, p) => updateSingle("finisher", i, p)}
          updateSuperset={(i, p) => updateSuperset("finisher", i, p)}
          removeItem={(i) => removeItem("finisher", i)}
          setSupersetExercise={(i, si, idv) => setSupersetSub("finisher", i, si, { exercise_id: idv })}
          setSupersetReps={(i, si, v) => setSupersetSub("finisher", i, si, { reps: v })}
          setSupersetWeight={(i, si, v) => setSupersetSub("finisher", i, si, { weight_kg: v })}
          addExerciseToSuperset={(i) => addSupersetSub("finisher", i)}
          removeExerciseFromSuperset={(i, si) => removeSupersetSub("finisher", i, si)}
        />

        {/* Save */}
        {msg && <div className={`alert ${msg.startsWith("Saved") ? "alert-success" : msg.startsWith("Saving") ? "alert-info" : "alert-danger"}`}>{msg}</div>}
        <button className="btn btn-primary w-100 mt-2" onClick={save} disabled={saving} style={{ borderRadius: 24, background: ACCENT, border: "none" }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </main>

      <BottomNav />
    </>
  );
}

/* ---------- RoundSection ---------- */
function RoundSection(props: {
  title: string;
  round: GymRound | null;
  setRound: (r: GymRound | null) => void;
  addSingle: () => void;
  addSuperset: () => void;
  updateSingle: (idx: number, patch: Partial<SingleItem>) => void;
  updateSuperset: (idx: number, patch: Partial<SupersetItem>) => void;
  removeItem: (idx: number) => void;
  setSupersetExercise: (idx: number, subIdx: number, id: string) => void;
  setSupersetReps: (idx: number, subIdx: number, reps: string) => void;
  setSupersetWeight: (idx: number, subIdx: number, w: number | null) => void;
  addExerciseToSuperset: (idx: number) => void;
  removeExerciseFromSuperset: (idx: number, subIdx: number) => void;
}) {
  const { title, round, addSingle, addSuperset, updateSingle, updateSuperset, removeItem, setSupersetExercise, setSupersetReps, setSupersetWeight, addExerciseToSuperset, removeExerciseFromSuperset } = props;
  return (
    <section className="futuristic-card p-3 mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="m-0">{title}</h6>
        <div className="d-flex gap-2">
          <button className="btn btn-sm" style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }} onClick={addSingle}>+ Single</button>
          <button className="btn btn-sm btn-outline-light" style={{ borderRadius: 24 }} onClick={addSuperset}>+ Superset</button>
        </div>
      </div>

      {!round?.items?.length ? (
        <div className="small text-dim">No items yet.</div>
      ) : (
        round.items.map((it, idx) => (
          <div key={(it as any).uid || idx} className="row g-2 mb-2">
            {it.type === "Single" ? (
              <>
                <div className="col-12 col-md-4">
                  <label className="form-label">Exercise ID</label>
                  <input className="form-control" value={(it as SingleItem).exercise_id} onChange={(e) => updateSingle(idx, { exercise_id: e.target.value })} placeholder="e.g., Bench Press" />
                </div>
                <div className="col-4 col-md-2">
                  <label className="form-label">Sets</label>
                  <input className="form-control" type="number" min={1} value={(it as SingleItem).sets ?? ""} onChange={(e) => updateSingle(idx, { sets: Number(e.target.value) || undefined })} />
                </div>
                <div className="col-8 col-md-3">
                  <label className="form-label">Reps</label>
                  <input className="form-control" value={(it as SingleItem).reps ?? ""} onChange={(e) => updateSingle(idx, { reps: e.target.value })} />
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label">Weight (kg)</label>
                  <input className="form-control" type="number" min={0} value={(it as SingleItem).weight_kg ?? ""} onChange={(e) => updateSingle(idx, { weight_kg: Number(e.target.value) || null })} />
                </div>
                <div className="col-6 col-md-1">
                  <label className="form-label">Rest (s)</label>
                  <input className="form-control" type="number" min={0} value={(it as SingleItem).rest_s ?? ""} onChange={(e) => updateSingle(idx, { rest_s: Number(e.target.value) || null })} />
                </div>
                <div className="col-12 d-flex">
                  <button className="btn btn-outline-danger ms-auto" onClick={() => removeItem(idx)} style={{ borderRadius: 12 }}>
                    Delete item
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="col-12 col-md-4">
                  <label className="form-label">Superset name</label>
                  <input className="form-control" value={(it as SupersetItem).name ?? ""} onChange={(e) => updateSuperset(idx, { name: e.target.value })} />
                  <div className="row mt-2 g-2">
                    <div className="col-6">
                      <label className="form-label">Sets (rounds)</label>
                      <input className="form-control" type="number" min={1} value={Number.isFinite((it as SupersetItem).sets) ? (it as SupersetItem).sets : 3} onChange={(e) => updateSuperset(idx, { sets: Math.max(1, Number(e.target.value) || 3) })} />
                    </div>
                    <div className="col-6">
                      <label className="form-label">Rest (s)</label>
                      <input classNameSupersetItem).rest_s ?? ""} onChange={(e) => updateSuperset(idx, { rest_s: Number(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <button className="btn btn-outline-danger" onClick={() => removeItem(idx)} style={{ borderRadius: 12 }}>
                      Delete superset
                    </button>
                  </div>
                </div>

                <div className="col-12 col-md-8">
                  {(it as SupersetItem).items.map((s, sidx) => (
                    <div key={s.uid} className="row g-2 align-items-end mb-2">
                      <div className="col-12 col-md-5">
                        <label className="form-label">Exercise ID</label>
                        <input className="form-control" value={s.exercise_id} onChange={(e) => setSupersetExercise(idx, sidx, e.target.value)} placeholder="e.g., Row" />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Reps</label>
                        <input className="form-control" value={s.reps ?? ""} onChange={(e) => setSupersetReps(idx, sidx, e.target.value)} />
                      </div>
                      <div className="col-4 col-md-2">
                        <label className="form-label">Weight (kg)</label>
                        <input className="form-control" type="number" min={0} value={s.weight_kg ?? ""} onChange={(e) => setSupersetWeight(idx, sidx, Number(e.target.value) || null)} />
                      </div>
                      <div className="col-2 col-md-2 d-flex">
                        <button className="btn btn-outline-danger ms-auto" onClick={() => removeExerciseFromSuperset(idx, sidx)} title="Remove exercise">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-sm btn-outline-light mt-2" style={{ borderRadius: 24 }} onClick={() => addExerciseToSuperset(idx)}>
                    + Add Exercise to Superset
                  </button>
                </div>
              </>
            )}
          </div>
        ))
      )}
    </section>
  );
}
