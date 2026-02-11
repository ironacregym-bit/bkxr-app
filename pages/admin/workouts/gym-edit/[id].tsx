// pages/admin/workouts/gym-edit/[id].tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "../../../../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type DayName = typeof DAYS[number];

/** ---------- Utilities ---------- */
const mkUid = () => {
  // Prefer crypto if available; fallback to Math.random
  try {
    // @ts-ignore
    return crypto?.randomUUID ? crypto.randomUUID() : `uid_${Math.random().toString(36).slice(2)}`;
  } catch {
    return `uid_${Math.random().toString(36).slice(2)}`;
  }
};

// Accepts Firestore Timestamp, Date, number(ms), or string → returns "YYYY-MM-DD" or ""
function toYMD(input: any): string {
  if (!input) return "";
  try {
    // String
    if (typeof input === "string") {
      const s = input.trim();
      if (s.length >= 10 && /\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const d = new Date(s);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    // Firestore Timestamp-like
    if (typeof input === "object" && input !== null && typeof (input as any).seconds === "number") {
      const ts = input as { seconds: number; nanoseconds?: number };
      const ms = ts.seconds * 1000 + (ts.nanoseconds ? ts.nanoseconds / 1e6 : 0);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    // Date
    if (input instanceof Date) {
      return isNaN(input.getTime()) ? "" : input.toISOString().slice(0, 10);
    }
    // Number (assume ms)
    if (typeof input === "number") {
      const d = new Date(input);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    // Fallback: stringify
    const s = String(input);
    if (/\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function safeLower(v: any, fallback: string): string {
  return typeof v === "string" ? v.toLowerCase() : (fallback || "").toLowerCase();
}

/** ---------- Types (add uid for stable keys) ---------- */
type SingleItem = {
  uid: string; // stable key
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
  uid: string; // stable key
  exercise_id: string;
  reps?: string;
  weight_kg?: number | null;
};

type SupersetItem = {
  uid: string; // stable key
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

type ExerciseRow = { id: string; exercise_name: string; type?: string };

type QuickTarget =
  | { kind: "single"; round: "warmup" | "main" | "finisher"; idx: number }
  | { kind: "superset"; round: "warmup" | "main" | "finisher"; idx: number; subIdx: number };

/** ---------- Admin workout (fetch shape) ---------- */
type AdminRoundFetch = {
  name: string;
  order: number;
  items?: any[]; // normalised items
};

type AdminWorkoutFetch = {
  workout_id: string;
  workout_name: string;
  visibility: "global" | "private";
  owner_email?: string | null;
  focus?: string | null;
  notes?: string | null;
  video_url?: string | null;
  // rounds (normalised)
  warmup?: AdminRoundFetch | null;
  main?: AdminRoundFetch | null;
  finisher?: AdminRoundFetch | null;
  // Assignment/recurrence (types softened to accept Timestamp/Date/number/string)
  recurring?: boolean;
  recurring_day?: DayName | string | null;
  recurring_start?: any;
  recurring_end?: any;
  assigned_to?: any; // can be non-string; guard it
};

export default function GymEditWorkoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const ownerEmail = (session?.user?.email || "").toLowerCase();
  const role = (session?.user as any)?.role || "user";

  const { id: routeId } = router.query;
  const editId = typeof routeId === "string" ? routeId : "";
  const isEdit = Boolean(editId);

  // --- Load exercises for dropdown ---
  const { data: exData, mutate: mutateExercises } = useSWR("/api/exercises?limit=1000", fetcher, {
    revalidateOnFocus: false,
  });
  const exercises: ExerciseRow[] = Array.isArray(exData?.exercises) ? exData!.exercises : [];

  // --- Template metadata (prefilled from workout) ---
  const [meta, setMeta] = useState({
    workout_name: "",
    focus: "",
    notes: "",
    video_url: "",
    visibility: "global" as "global" | "private",

    // Assignment & recurrence
    recurring: false,
    recurring_day: "Monday" as DayName,
    recurring_start: "" as string, // YYYY-MM-DD
    recurring_end: "" as string, // YYYY-MM-DD
    assigned_to: ownerEmail || "",
  });

  // Rounds
  const [warmup, setWarmup] = useState<GymRound | null>(null);
  const [main, setMain] = useState<GymRound>({ name: "Main Set", order: 2, items: [] });
  const [finisher, setFinisher] = useState<GymRound | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Quick Add Exercise modal
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickErr, setQuickErr] = useState<string | null>(null);
  const [quickForm, setQuickForm] = useState({
    exercise_name: "",
    type: "",
    equipment: "",
    video_url: "",
    met_value: "" as string | number,
    description: "",
  });
  const [quickTarget, setQuickTarget] = useState<QuickTarget | null>(null);

  const openQuickFor = (target: QuickTarget) => {
    setQuickTarget(target);
    setQuickForm({
      exercise_name: "",
      type: "",
      equipment: "",
      video_url: "",
      met_value: "",
      description: "",
    });
    setQuickErr(null);
    setQuickOpen(true);
  };

  const applyQuickToSelection = (newId: string) => {
    if (!quickTarget) return;
    if (quickTarget.kind === "single") {
      updateSingle(quickTarget.round, quickTarget.idx, { exercise_id: newId });
    } else {
      setSupersetExercise(quickTarget.round, quickTarget.idx, quickTarget.subIdx, newId);
    }
  };

  async function createQuickExercise() {
    try {
      setQuickBusy(true);
      setQuickErr(null);
      const body = {
        exercise_name: quickForm.exercise_name.trim(),
        type: quickForm.type.trim(),
        equipment: quickForm.equipment.trim(),
        video_url: quickForm.video_url.trim(),
        met_value:
          quickForm.met_value === "" ? null : Number.isFinite(Number(quickForm.met_value)) ? Number(quickForm.met_value) : null,
        description: quickForm.description.trim(),
      };
      if (!body.exercise_name) {
        setQuickErr("Exercise name is required");
        return;
      }
      const res = await fetch("/api/exercises/create?upsert=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to create exercise");

      await mutateExercises();
      const newId: string = json?.exercise_id || body.exercise_name;
      applyQuickToSelection(newId);
      setQuickOpen(false);
    } catch (e: any) {
      setQuickErr(e?.message || "Failed to create exercise");
    } finally {
      setQuickBusy(false);
    }
  }

  if (status === "loading") return <div className="container py-4">Checking access…</div>;
  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4">
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  /* ---------- Utilities to keep item orders clean ---------- */
  function renumber(items: Array<SingleItem | SupersetItem>): Array<SingleItem | SupersetItem> {
    return items.map((it, i) => ({ ...it, order: i + 1 }));
  }

  /* ---------- Helpers for Single Items ---------- */
  function addSingle(round: "warmup" | "main" | "finisher") {
    const newItem: SingleItem = { uid: mkUid(), type: "Single", order: 1, exercise_id: "", reps: "", sets: 3 };
    if (round === "warmup")
      setWarmup((prev) => (prev ? { ...prev, items: renumber([...prev.items, { ...newItem, order: prev.items.length + 1 }]) } : { name: "Warm Up", order: 1, items: [newItem] }));
    if (round === "main") setMain((prev) => ({ ...prev, items: renumber([...prev.items, { ...newItem, order: prev.items.length + 1 }]) }));
    if (round === "finisher")
      setFinisher((prev) =>
        prev
          ? { ...prev, items: renumber([...prev.items, { ...newItem, order: prev.items.length + 1 }]) }
          : { name: "Finisher", order: 3, items: [newItem] }
      );
  }

  function updateSingle(round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SingleItem>) {
    const up = (r: GymRound | null) => (r ? { ...r, items: r.items.map((it, i) => (i === idx ? { ...(it as SingleItem), ...patch } : it)) } : r);
    if (round === "warmup") setWarmup((prev) => up(prev));
    if (round === "main") setMain((prev) => up(prev) as GymRound);
    if (round === "finisher") setFinisher((prev) => up(prev));
  }

  function removeItem(round: "warmup" | "main" | "finisher", idx: number) {
    const dropFrom = (r: GymRound | null): GymRound | null => {
      if (!r) return r;
      const next = r.items.filter((_, i) => i !== idx);
      if (next.length === 0 && r.name === "Finisher") {
        // If finisher becomes empty, hide the whole section
        return null;
      }
      return { ...r, items: renumber(next) };
    };
    if (round === "warmup") setWarmup((prev) => dropFrom(prev));
    if (round === "main") setMain((prev) => dropFrom(prev) as GymRound);
    if (round === "finisher") setFinisher((prev) => dropFrom(prev));
  }

  /* ---------- Helpers for Supersets (unlimited items + sets at superset level) ---------- */
  function newSupersetSub(): SupersetSubItem {
    return { uid: mkUid(), exercise_id: "", reps: "" };
  }

  function addSuperset(round: "warmup" | "main" | "finisher") {
    const newItem: SupersetItem = {
      uid: mkUid(),
      type: "Superset",
      order: 1,
      name: "",
      items: [newSupersetSub(), newSupersetSub()],
      sets: 3,
      rest_s: null,
    };
    if (round === "warmup")
      setWarmup((prev) => (prev ? { ...prev, items: renumber([...prev.items, { ...newItem, order: prev.items.length + 1 }]) } : { name: "Warm Up", order: 1, items: [newItem] }));
    if (round === "main") setMain((prev) => ({ ...prev, items: renumber([...prev.items, { ...newItem, order: prev.items.length + 1 }]) }));
    if (round === "finisher")
      setFinisher((prev) =>
        prev
          ? { ...prev, items: renumber([...prev.items, { ...newItem, order: prev.items.length + 1 }]) }
          : { name: "Finisher", order: 3, items: [newItem] }
      );
  }

  function updateSuperset(round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SupersetItem>) {
    const up = (r: GymRound | null) => (r ? { ...r, items: r.items.map((it, i) => (i === idx ? { ...(it as SupersetItem), ...patch } : it)) } : r);
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
              const next = [...ss.items, newSupersetSub()];
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

  /* ---------- Edit: fetch + normalise into UI ---------- */
  const workoutKey = useMemo(() => (isEdit ? `/api/workouts/admin/${encodeURIComponent(editId)}` : null), [isEdit, editId]);
  const { data: workoutResp } = useSWR<AdminWorkoutFetch>(workoutKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  // Map AdminRoundFetch -> GymRound with fresh uids
  function toUIRound(r?: AdminRoundFetch | null, fallbackName = "Round", fallbackOrder = 1): GymRound | null {
    if (!r) return null;
    const rawItems: any[] = Array.isArray(r.items) ? r.items : [];
    const uiItems: Array<SingleItem | SupersetItem> = rawItems.map((it: any, idx: number) => {
      const order = Number.isFinite(it?.order) ? it.order : idx + 1;
      if (String(it?.type) === "Superset") {
        // tolerate both .items and legacy .superset_items (if your data contains it on fetch side)
        const subs: any[] = Array.isArray(it.items)
          ? it.items
          : Array.isArray(it.superset_items)
          ? it.superset_items
          : [];
        const mappedSubs: SupersetSubItem[] = subs.map((s: any) => ({
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
          items: mappedSubs.length ? mappedSubs : [newSupersetSub()],
          sets: Number.isFinite(it?.sets) ? it.sets : 3,
          rest_s: it?.rest_s ?? null,
          notes: it?.notes ?? null,
        };
      }
      // Single
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

    return {
      name: (r?.name || fallbackName) as string,
      order: Number.isFinite(r?.order) ? (r!.order as number) : fallbackOrder,
      items: uiItems,
    };
  }

  // Prefill once when workoutResp arrives
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!isEdit || !workoutResp || prefilled) return;

    // Guard recurring_day
    const dayRaw = (workoutResp.recurring_day ?? "") as string;
    const day = (DAYS as readonly string[]).includes(dayRaw) ? (dayRaw as DayName) : (meta.recurring_day as DayName);

    setMeta((m) => ({
      ...m,
      workout_name: workoutResp.workout_name || "",
      focus: workoutResp.focus || "",
      notes: workoutResp.notes || "",
      video_url: workoutResp.video_url || "",
      visibility: workoutResp.visibility || "global",
      recurring: !!workoutResp.recurring,
      recurring_day: day,
      // Safe normalisation to YYYY-MM-DD for <input type="date">
      recurring_start: toYMD(workoutResp.recurring_start),
      recurring_end: toYMD(workoutResp.recurring_end),
      assigned_to: safeLower(workoutResp.assigned_to, ownerEmail),
    }));

    // Rounds
    const w = workoutResp;
    const uiWarm = toUIRound(w.warmup, "Warm Up", 1);
    const uiMain = toUIRound(w.main || { name: "Main Set", order: 2, items: [] }, "Main Set", 2);
    const uiFin = toUIRound(w.finisher, "Finisher", 3);

    setWarmup(uiWarm);
    setMain(uiMain || { name: "Main Set", order: 2, items: [] });
    setFinisher(uiFin);

    setPrefilled(true);
  }, [isEdit, workoutResp, prefilled, ownerEmail, meta.recurring_day]);

  /* ---------- Save ---------- */
  function toISODateOrNull(s: string): string | null {
    if (!s) return null;
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return null;
    // normalise to 12:00 to avoid TZ midnight drift when server reads it as local
    dt.setHours(12, 0, 0, 0);
    return dt.toISOString();
  }

  // Strip uids for save; keep schema identical to create payload
  function stripRound(r: GymRound | null): any | null {
    if (!r) return null;
    return {
      name: r.name,
      order: r.order,
      items: (r.items || []).map((it) => {
        if (it.type === "Superset") {
          const ss = it as SupersetItem;
          return {
            type: "Superset",
            order: ss.order,
            name: ss.name || "",
            sets: Number.isFinite(ss.sets) ? ss.sets : 3,
            rest_s: ss.rest_s ?? null,
            notes: ss.notes ?? null,
            // store normalised 'items'
            items: (ss.items || []).map((s) => ({
              exercise_id: s.exercise_id,
              reps: s.reps || "",
              weight_kg: s.weight_kg ?? null,
            })),
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

  async function save() {
    if (!isEdit) return; // edit-only page
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

      const body: any = {
        workout_id: editId,
        visibility: meta.visibility,
        owner_email: meta.visibility === "private" ? ownerEmail : undefined,
        workout_name: meta.workout_name.trim(),
        focus: meta.focus.trim() || undefined,
        notes: meta.notes.trim() || undefined,
        video_url: meta.video_url.trim() || undefined,
        warmup: stripRound(warmup),
        main: stripRound(main),
        finisher: stripRound(finisher),

        // New fields (API will validate & coerce)
        recurring: !!meta.recurring,
        recurring_day: meta.recurring ? meta.recurring_day : null,
        recurring_start: meta.recurring ? toISODateOrNull(meta.recurring_start) : null,
        recurring_end: meta.recurring ? toISODateOrNull(meta.recurring_end) : null,
        assigned_to: meta.recurring ? meta.assigned_to.trim().toLowerCase() : null,
      };

      const res = await fetch("/api/workouts/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to update workout");
      setMsg("Saved changes ✅");

      setTimeout(() => router.push(`/admin/workouts/${editId}`), 700);
    } catch (e: any) {
      setMsg(e?.message || "Failed to save workout");
    } finally {
      setSaving(false);
    }
  }

  /** ---------- UI ---------- */

  function ExerciseSelect({
    value,
    onChange,
    label = "Exercise",
    quickTarget,
  }: {
    value: string;
    onChange: (id: string) => void;
    label?: string;
    quickTarget: QuickTarget;
  }) {
    return (
      <div className="d-flex align-items-end gap-2">
        <div className="flex-fill">
          <label className="form-label">{label}</label>
          <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">— Select —</option>
            {exercises.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.exercise_name} {e.type ? `• ${e.type}` : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          style={{ borderRadius: 24, whiteSpace: "nowrap" }}
          onClick={() => openQuickFor(quickTarget)}
          title="Quick add exercise"
        >
          ＋ Quick add
        </button>
      </div>
    );
  }

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
          <input className="form-control" value={it.name ?? ""} onChange={(e) => updateSuperset(round, idx, { name: e.target.value })} />
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

          {/* Delete superset */}
          <div className="mt-3">
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => removeItem(round, idx)}
              title="Remove this superset"
              style={{ borderRadius: 12 }}
            >
              Delete superset
            </button>
          </div>
        </div>

        {/* Dynamic list of sub-exercises */}
        <div className="col-12 col-md-8">
          {Array.isArray(it.items) && it.items.length > 0 ? (
            it.items.map((s, sidx) => (
              <div key={s.uid} className="row g-2 align-items-end mb-2">
                <div className="col-12 col-md-5">
                  <ExerciseSelect
                    label="Exercise"
                    value={s.exercise_id}
                    onChange={(id) => setSupersetExercise(round, idx, sidx, id)}
                    quickTarget={{ kind: "superset", round, idx, subIdx: sidx }}
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Reps</label>
                  <input className="form-control" value={s.reps ?? ""} onChange={(e) => setSupersetReps(round, idx, sidx, e.target.value)} />
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
            <small className="text-dim d-block mt-1">
              When on: this session repeats weekly and becomes the user’s mandatory workout for that weekday.
            </small>
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
                <option key={d} value={d}>
                  {d}
                </option>
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
      <Head>
        <title>Edit Gym Workout • Admin</title>
      </Head>
      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="mb-3">
          <Link href="/admin" className="btn btn-outline-secondary">
            ← Back to Admin
          </Link>
        </div>

        <h2 className="mb-3">Edit Gym Workout</h2>
        {msg && <div className={`alert ${msg.toLowerCase().includes("failed") ? "alert-danger" : "alert-info"}`}>{msg}</div>}

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
        {AssignmentSection}

        {/* Warm Up */}
        <section className="futuristic-card p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="m-0">Warm Up</h6>
            <div className="d-flex gap-2">
              <button className="btn btn-sm" style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }} onClick={() => addSingle("warmup")}>
                + Single
              </button>
              <button className="btn btn-sm btn-outline-light" style={{ borderRadius: 24 }} onClick={() => addSuperset("warmup")}>
                + Superset
              </button>
            </div>
          </div>
          {warmup?.items?.length ? (
            warmup.items.map((it, idx) => (
              <div key={it.uid} className="row g-2 mb-2">
                {it.type === "Single" ? (
                  <>
                    <div className="col-12 col-md-4">
                      <ExerciseSelect
                        value={(it as SingleItem).exercise_id}
                        onChange={(id) => updateSingle("warmup", idx, { exercise_id: id })}
                        quickTarget={{ kind: "single", round: "warmup", idx }}
                      />
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
                    <div className="col-12 d-flex">
                      <button
                        type="button"
                        className="btn btn-outline-danger ms-auto"
                        onClick={() => removeItem("warmup", idx)}
                        title="Remove exercise"
                        style={{ borderRadius: 12 }}
                      >
                        Delete item
                      </button>
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
              <button className="btn btn-sm" style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }} onClick={() => addSingle("main")}>
                + Single
              </button>
              <button className="btn btn-sm btn-outline-light" style={{ borderRadius: 24 }} onClick={() => addSuperset("main")}>
                + Superset
              </button>
            </div>
          </div>
          {main.items.length ? (
            main.items.map((it, idx) => (
              <div key={it.uid} className="row g-2 mb-2">
                {it.type === "Single" ? (
                  <>
                    <div className="col-12 col-md-4">
                      <ExerciseSelect
                        value={(it as SingleItem).exercise_id}
                        onChange={(id) => updateSingle("main", idx, { exercise_id: id })}
                        quickTarget={{ kind: "single", round: "main", idx }}
                      />
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
                      <input className="form-control" value={(it as SingleItem).reps ?? ""} onChange={(e) => updateSingle("main", idx, { reps: e.target.value })} />
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
                    <div className="col-12 d-flex">
                      <button
                        type="button"
                        className="btn btn-outline-danger ms-auto"
                        onClick={() => removeItem("main", idx)}
                        title="Remove exercise"
                        style={{ borderRadius: 12 }}
                      >
                        Delete item
                      </button>
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
              <button className="btn btn-sm" style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }} onClick={() => addSingle("finisher")}>
                + Single
              </button>
              <button className="btn btn-sm btn-outline-light" style={{ borderRadius: 24 }} onClick={() => addSuperset("finisher")}>
                + Superset
              </button>
            </div>
          </div>
          {!finisher?.items?.length ? (
            <div className="small text-dim">Optional finisher.</div>
          ) : (
            finisher.items.map((it, idx) => (
              <div key={it.uid} className="row g-2 mb-2">
                {it.type === "Single" ? (
                  <>
                    <div className="col-12 col-md-4">
                      <ExerciseSelect
                        value={(it as SingleItem).exercise_id}
                        onChange={(id) => updateSingle("finisher", idx, { exercise_id: id })}
                        quickTarget={{ kind: "single", round: "finisher", idx }}
                      />
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
                      <input className="form-control" value={(it as SingleItem).reps ?? ""} onChange={(e) => updateSingle("finisher", idx, { reps: e.target.value })} />
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
                    <div className="col-12 d-flex">
                      <button
                        type="button"
                        className="btn btn-outline-danger ms-auto"
                        onClick={() => removeItem("finisher", idx)}
                        title="Remove exercise"
                        style={{ borderRadius: 12 }}
                      >
                        Delete item
                      </button>
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
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </main>

      {/* Quick Add Exercise Modal */}
      {quickOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="position-fixed top-0 start-0 w-100 h-100"
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 1050 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setQuickOpen(false);
          }}
        >
          <div className="position-absolute top-50 start-50 translate-middle" style={{ width: "92vw", maxWidth: 680 }}>
            <div className="futuristic-card p-3" onClick={(e) => e.stopPropagation()}>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h5 className="m-0">Quick add exercise</h5>
                <button className="btn btn-sm btn-outline-light" style={{ borderRadius: 999 }} onClick={() => setQuickOpen(false)}>
                  ✕
                </button>
              </div>

              {quickErr && <div className="alert alert-danger py-2">{quickErr}</div>}

              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <label className="form-label">Exercise name</label>
                  <input
                    className="form-control"
                    value={quickForm.exercise_name}
                    onChange={(e) => setQuickForm((f) => ({ ...f, exercise_name: e.target.value }))}
                    placeholder="e.g., Barbell Row"
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Type</label>
                  <input className="form-control" value={quickForm.type} onChange={(e) => setQuickForm((f) => ({ ...f, type: e.target.value }))} placeholder="e.g., Pull" />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Equipment</label>
                  <input
                    className="form-control"
                    value={quickForm.equipment}
                    onChange={(e) => setQuickForm((f) => ({ ...f, equipment: e.target.value }))}
                    placeholder="e.g., Barbell"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Video URL</label>
                  <input
                    className="form-control"
                    value={quickForm.video_url}
                    onChange={(e) => setQuickForm((f) => ({ ...f, video_url: e.target.value }))}
                    placeholder="https://…"
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">MET value (optional)</label>
                  <input
                    className="form-control"
                    type="number"
                    step="0.1"
                    value={quickForm.met_value}
                    onChange={(e) => setQuickForm((f) => ({ ...f, met_value: e.target.value }))}
                    placeholder="e.g., 6.0"
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Description (optional)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={quickForm.description}
                    onChange={(e) => setQuickForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Coaching cues, setup, safety…"
                  />
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button className="btn btn-outline-light" style={{ borderRadius: 24 }} onClick={() => setQuickOpen(false)} disabled={quickBusy}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  style={{ borderRadius: 24, background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, border: "none" }}
                  onClick={createQuickExercise}
                  disabled={quickBusy}
                >
                  {quickBusy ? "Saving…" : "Save & select"}
                </button>
              </div>

              <div className="small text-dim mt-2">
                Need the full editor instead?{" "}
                <Link href="/admin/exercises/create" className="link-light">
                  Open Create Exercise
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}
