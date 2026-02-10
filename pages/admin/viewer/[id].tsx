// pages/admin/viewer/[id].tsx
// Admin “Viewer-Style” Editor for both BXKR and Gym workouts.
// - Detects kind by shape (bxkr: boxing+kettlebell, gym: warmup/main/finisher).
// - BXKR editor mirrors /admin/workouts/create.tsx semantics (boxing shorthand → actions; KB rounds/items).
// - Gym editor mirrors /admin/workouts/gym-create.tsx (Single + Superset with sets at superset-level).
// - Save to admin update endpoints (see saveBxkr/saveGym).
// - Hydration-safe, SWR, glass/neon UI, orange accent.

"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import React, { useEffect, useMemo, useState } from "react";

const ACCENT = "#FF8A2A";
const fetcher = (u: string) => fetch(u).then(r => r.json());

function formatYMD(d: Date) {
  return d.toLocaleDateString("en-CA");
}

/* =========================
   Types for BOTH kinds
   ========================= */

// ---- BXKR ----
type BoxingAction = {
  kind: "punch" | "defence";
  code: string;
  count?: number;
  tempo?: string;
  notes?: string;
};
type BoxingCombo = { name?: string; actions: BoxingAction[]; notes?: string };
type BoxingRound = { name: string; combos: [BoxingCombo, BoxingCombo, BoxingCombo] };
type KBItem = {
  order: number;
  exercise_id: string;
  reps?: string;
  time_s?: number;
  weight_kg?: number;
  tempo?: string;
  rest_s?: number;
  notes?: string;
};
type KBRound = { name: string; style: "EMOM" | "AMRAP" | "LADDER"; items: KBItem[] };

type AdminWorkoutBxkr = {
  kind?: "bxkr";
  workout_id: string;
  workout_name: string;
  visibility: "global" | "private";
  owner_email?: string;
  focus?: string;
  notes?: string;
  video_url?: string;
  is_benchmark?: boolean;
  benchmark_name?: string;
  boxing?: { rounds: BoxingRound[] };
  kettlebell?: { rounds: KBRound[] };
};

// ---- Gym ----
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
  items?: SupersetSubItem[];       // normalised
  superset_items?: SupersetSubItem[]; // legacy tolerated
  sets?: number;
  rest_s?: number | null;
  notes?: string | null;
};
type AdminRound = { name: string; order: number; items: Array<SingleItem | SupersetItem> };

type AdminWorkoutGym = {
  kind?: "gym";
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
};

type AdminWorkout = AdminWorkoutBxkr | AdminWorkoutGym;

function isBxkr(w: any): w is AdminWorkoutBxkr {
  return Boolean(w && w.boxing && w.kettlebell);
}
function isGym(w: any): w is AdminWorkoutGym {
  return Boolean(w && (w.main || w.warmup || w.finisher));
}

/* =========================
   BXKR Boxing shorthand mapping
   (mirrors your create page behaviour)
   ========================= */
// We tolerate numeric (1..6) and names (jab, cross, lead_hook, rear_hook, lead_uppercut, rear_uppercut)
// plus defences: duck/slip/roll/parry
const BOXING_CODE_MAP: Record<string, BoxingAction> = {
  "1": { kind: "punch", code: "jab" },
  "2": { kind: "punch", code: "cross" },
  "3": { kind: "punch", code: "lead_hook" },
  "4": { kind: "punch", code: "rear_hook" },
  "5": { kind: "punch", code: "lead_uppercut" },
  "6": { kind: "punch", code: "rear_uppercut" },
  jab: { kind: "punch", code: "jab" },
  cross: { kind: "punch", code: "cross" },
  lead_hook: { kind: "punch", code: "lead_hook" },
  rear_hook: { kind: "punch", code: "rear_hook" },
  lead_uppercut: { kind: "punch", code: "lead_uppercut" },
  rear_uppercut: { kind: "punch", code: "rear_uppercut" },
  hook: { kind: "punch", code: "hook" }, // tolerated generic
  uppercut: { kind: "punch", code: "uppercut" }, // tolerated generic
  slip: { kind: "defence", code: "slip" },
  roll: { kind: "defence", code: "roll" },
  parry: { kind: "defence", code: "parry" },
  duck: { kind: "defence", code: "duck" },
};

function expandComboShorthand(name: string | undefined, input: string): BoxingCombo {
  const seq = String(input || "").trim();
  const parts = seq.split(/[\s,;/-]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
  const actions: BoxingAction[] = parts.map((p) => {
    const m = p.match(/^([a-z0-9_]+)x(\d+)$/);
    if (m) {
      const base = BOXING_CODE_MAP[m[1]];
      const count = parseInt(m[2], 10);
      if (!base) throw new Error(`Unknown boxing code: ${m[1]}`);
      return { ...base, count };
    }
    const base = BOXING_CODE_MAP[p];
    if (!base) throw new Error(`Unknown boxing code: ${p}`);
    return { ...base };
  });
  if (actions.length === 0) throw new Error("Combo must contain at least one action");
  return { name: name || undefined, actions };
}

// Reverse: actions[] -> shorthand string (for initialising the editor fields)
function toShorthand(actions: BoxingAction[]): string {
  const rev = (a: BoxingAction) => {
    const n = (code: string) =>
      code === "jab" ? "1" :
      code === "cross" ? "2" :
      code === "lead_hook" ? "3" :
      code === "rear_hook" ? "4" :
      code === "lead_uppercut" ? "5" :
      code === "rear_uppercut" ? "6" :
      code; // fallback to raw
    const base = a.kind === "defence" ? a.code : n(a.code);
    return `${base}${a.count ? `x${a.count}` : ""}`;
  };
  return (actions || []).map(rev).join(" - ");
}

/* =========================
   Shared UI bits
   ========================= */
const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: 16,
  padding: 16,
  backdropFilter: "blur(10px)",
  boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="futuristic-card p-3 mb-3">
      <div className="d-flex align-items-center justify-content-between">
        <h5 className="m-0">{title}</h5>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/* =========================
   BXKR Editor
   ========================= */
function BxkrEditor({
  data,
  onSaved,
}: {
  data: AdminWorkoutBxkr;
  onSaved: (id: string) => void;
}) {
  // Meta
  const [visibility, setVisibility] = useState<"global" | "private">(data.visibility || "global");
  const [workoutName, setWorkoutName] = useState<string>(data.workout_name || "");
  const [focus, setFocus] = useState<string>(data.focus || "");
  const [videoUrl, setVideoUrl] = useState<string>(data.video_url || "");
  const [notes, setNotes] = useState<string>(data.notes || "");
  const [isBenchmark, setIsBenchmark] = useState<boolean>(!!data.is_benchmark);
  const [benchmarkName, setBenchmarkName] = useState<string>(data.benchmark_name || "");

  // Boxing (use shorthand inputs for editor)
  type ComboInput = { name?: string; sequence: string };
  const [boxingRounds, setBoxingRounds] = useState<{ name: string; combos: [ComboInput, ComboInput, ComboInput] }[]>(
    () => (data.boxing?.rounds || []).map((r) => ({
      name: r.name,
      combos: [
        { name: r.combos?.[0]?.name, sequence: toShorthand(r.combos?.[0]?.actions || []) },
        { name: r.combos?.[1]?.name, sequence: toShorthand(r.combos?.[1]?.actions || []) },
        { name: r.combos?.[2]?.name, sequence: toShorthand(r.combos?.[2]?.actions || []) },
      ],
    }))
  );

  // Kettlebell
  const [kbRounds, setKbRounds] = useState<{ name: string; style: "EMOM" | "AMRAP" | "LADDER"; items: KBItem[] }[]>(
    () => (data.kettlebell?.rounds || []).map((r) => ({
      name: r.name,
      style: r.style,
      items: (r.items || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }))
  );

  // Editors
  const updateCombo = (rIdx: number, cIdx: number, field: "name" | "sequence", value: string) => {
    setBoxingRounds((prev) => {
      const next = [...prev];
      const combos = [...next[rIdx].combos] as [ComboInput, ComboInput, ComboInput];
      const u = { ...combos[cIdx], [field]: value };
      combos[cIdx] = u;
      next[rIdx] = { ...next[rIdx], combos };
      return next;
    });
  };

  const updateKbStyle = (rIdx: number, style: "EMOM" | "AMRAP" | "LADDER") => {
    setKbRounds((prev) => {
      const next = [...prev];
      next[rIdx] = { ...next[rIdx], style };
      return next;
    });
  };
  const addKbItem = (rIdx: number) => {
    setKbRounds((prev) => {
      const next = [...prev];
      const items = [...next[rIdx].items];
      const maxOrder = items.reduce((m, it) => Math.max(m, it.order || 0), 0);
      items.push({ order: maxOrder + 1, exercise_id: "", reps: "" });
      next[rIdx] = { ...next[rIdx], items };
      return next;
    });
  };
  const updateKbItem = (rIdx: number, idx: number, field: keyof KBItem, value: string) => {
    setKbRounds((prev) => {
      const next = [...prev];
      const items = [...next[rIdx].items];
      const cur = { ...items[idx] };
      if (field === "order") cur.order = Number(value) || 1;
      else if (field === "time_s") cur.time_s = value ? Number(value) : undefined;
      else if (field === "weight_kg") cur.weight_kg = value ? Number(value) : undefined;
      else if (field === "rest_s") cur.rest_s = value ? Number(value) : undefined;
      else if (field === "exercise_id") cur.exercise_id = value;
      else if (field === "reps") cur.reps = value;
      else if (field === "tempo") cur.tempo = value;
      else if (field === "notes") cur.notes = value;
      items[idx] = cur;
      next[rIdx] = { ...next[rIdx], items };
      return next;
    });
  };
  const removeKbItem = (rIdx: number, idx: number) => {
    setKbRounds((prev) => {
      const next = [...prev];
      const items = [...next[rIdx].items];
      items.splice(idx, 1);
      next[rIdx] = { ...next[rIdx], items };
      return next;
    });
  };

  // Save (calls admin update endpoint; adjust if you use a different route)
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveBxkr() {
    try {
      setSaving(true);
      setMsg("Saving…");

      // Validate boxing combos
      const boxingOut: BoxingRound[] = boxingRounds.map((r, idx) => ({
        name: r.name || `Boxing Round ${idx + 1}`,
        combos: [
          expandComboShorthand(r.combos[0].name, r.combos[0].sequence),
          expandComboShorthand(r.combos[1].name, r.combos[1].sequence),
          expandComboShorthand(r.combos[2].name, r.combos[2].sequence),
        ] as any,
      }));

      // KB rounds
      const kbOut: KBRound[] = kbRounds.map((r, idx) => ({
        name: r.name || `Kettlebell Round ${idx + 1}`,
        style: r.style,
        items: r.items.map((it) => ({
          exercise_id: String(it.exercise_id).trim(),
          order: Number(it.order) || 1,
          reps: it.reps?.trim() || undefined,
          time_s: typeof it.time_s === "number" ? it.time_s : undefined,
          weight_kg: typeof it.weight_kg === "number" ? it.weight_kg : undefined,
          tempo: it.tempo?.trim() || undefined,
          rest_s: typeof it.rest_s === "number" ? it.rest_s : undefined,
          notes: it.notes?.trim() || undefined,
        })),
      }));

      const payload = {
        workout_id: data.workout_id,
        visibility,
        owner_email: visibility === "private" ? (data.owner_email || undefined) : undefined,
        workout_name: workoutName.trim(),
        focus: focus.trim() || undefined,
        notes: notes.trim() || undefined,
        video_url: videoUrl.trim() || undefined,
        is_benchmark: !!isBenchmark,
        benchmark_name: isBenchmark ? (benchmarkName.trim() || undefined) : undefined,
        boxing: { rounds: boxingOut },
        kettlebell: { rounds: kbOut },
      };

      // Endpoint: implement server-side to update existing doc
      const res = await fetch("/api/workouts/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Update failed");
      setMsg("Saved ✅");
      onSaved(data.workout_id);
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "Failed to save"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Meta */}
      <Section title="Workout Meta">
        <div className="row g-2">
          <div className="col-12 col-md-4">
            <label className="form-label">Visibility</label>
            <select className="form-select" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
              <option value="global">Global</option>
              <option value="private">Private</option>
            </select>
            {visibility === "private" && <small className="text-muted">Owner: {data.owner_email || "—"}</small>}
          </div>
          <div className="col-12 col-md-8">
            <label className="form-label">Workout Name</label>
            <input className="form-control" value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label">Focus</label>
            <input className="form-control" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g., Power & Conditioning" />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label">Video URL</label>
            <input className="form-control" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label">Benchmark</label>
            <div className="d-flex align-items-center gap-2">
              <input id="bm" type="checkbox" checked={isBenchmark} onChange={(e) => setIsBenchmark(e.target.checked)} />
              <label htmlFor="bm" className="mb-0">Is benchmark?</label>
            </div>
            {isBenchmark && (
              <input className="form-control mt-2" value={benchmarkName} onChange={(e) => setBenchmarkName(e.target.value)} placeholder="Benchmark name" />
            )}
          </div>
          <div className="col-12">
            <label className="form-label">Notes</label>
            <textarea className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Boxing rounds */}
      <h5 className="mb-2">Boxing (5 rounds; each has 3 combos)</h5>
      {boxingRounds.map((r, ri) => (
        <div key={ri} className="card p-3 mb-3">
          <div className="fw-bold mb-2">Round {ri + 1} — {r.name}</div>
          <small className="text-muted mb-2">Use shorthand: <code>1-2-duck</code>, <code>jabx2-cross</code>, <code>3-2-slip</code></small>
          {(r.combos as any as Array<{ name?: string; sequence: string }>).map((c, ci) => (
            <div className="row g-2 mb-2" key={ci}>
              <div className="col-12 col-md-4">
                <input className="form-control" value={c.name || ""} onChange={(e) => updateCombo(ri, ci, "name", e.target.value)} placeholder={`Combo ${ci + 1} name (optional)`} />
              </div>
              <div className="col-12 col-md-8">
                <input className="form-control" value={c.sequence} onChange={(e) => updateCombo(ri, ci, "sequence", e.target.value)} placeholder="Sequence (e.g., 1-2-duck)" />
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Kettlebell rounds */}
      <h5 className="mb-2">Kettlebells (5 rounds)</h5>
      {kbRounds.map((r, ri) => (
        <div key={ri} className="card p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="fw-bold">Round {ri + 1} — {r.name}</div>
            <div className="d-flex align-items-center gap-2">
              <label className="form-label mb-0">Style</label>
              <select className="form-select" value={r.style} onChange={(e) => updateKbStyle(ri, e.target.value as any)} style={{ width: 140 }}>
                <option value="AMRAP">AMRAP</option>
                <option value="EMOM">EMOM</option>
                <option value="LADDER">LADDER</option>
              </select>
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>Items</strong>
            <button type="button" className="btn btn-sm" style={{ color: "#fff", background: ACCENT, borderRadius: 24 }} onClick={() => addKbItem(ri)}>
              + Add Item
            </button>
          </div>

          {(r.items || []).map((it, idx) => (
            <div key={idx} className="row g-2 mb-2">
              <div className="col-12 col-md-4">
                <label className="form-label">Exercise ID</label>
                <input className="form-control" value={it.exercise_id} onChange={(e) => updateKbItem(ri, idx, "exercise_id", e.target.value)} placeholder="e.g., 2H Kettlebell Swing" />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label">Order</label>
                <input className="form-control" type="number" min={1} value={it.order} onChange={(e) => updateKbItem(ri, idx, "order", e.target.value)} />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label">Reps</label>
                <input className="form-control" value={it.reps || ""} onChange={(e) => updateKbItem(ri, idx, "reps", e.target.value)} placeholder="e.g., 10 or 10-8-6" />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label">Time (s)</label>
                <input className="form-control" type="number" min={0} value={it.time_s ?? ""} onChange={(e) => updateKbItem(ri, idx, "time_s", e.target.value)} />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label">Weight (kg)</label>
                <input className="form-control" type="number" min={0} value={it.weight_kg ?? ""} onChange={(e) => updateKbItem(ri, idx, "weight_kg", e.target.value)} />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label">Tempo</label>
                <input className="form-control" value={it.tempo || ""} onChange={(e) => updateKbItem(ri, idx, "tempo", e.target.value)} placeholder="e.g., 3-1-1" />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label">Rest (s)</label>
                <input className="form-control" type="number" min={0} value={it.rest_s ?? ""} onChange={(e) => updateKbItem(ri, idx, "rest_s", e.target.value)} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Notes</label>
                <input className="form-control" value={it.notes || ""} onChange={(e) => updateKbItem(ri, idx, "notes", e.target.value)} />
              </div>
              <div className="col-12 col-md-2 d-flex align-items-end">
                <button type="button" className="btn btn-outline-light btn-sm" style={{ borderRadius: 24 }} onClick={() => removeKbItem(ri, idx)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Save */}
      {msg && <div className={`alert ${msg.startsWith("Error") ? "alert-danger" : "alert-info"}`}>{msg}</div>}
      <div className="d-grid">
        <button
          className="btn btn-primary"
          disabled={saving}
          onClick={saveBxkr}
          style={{ borderRadius: 24, background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, border: "none", fontWeight: 700 }}
        >
          {saving ? "Saving…" : "Save Workout"}
        </button>
      </div>
    </>
  );
}

/* =========================
   Gym Editor
   ========================= */

// Helper: re-number order
function renumber<T extends { order: number }>(items: T[]): T[] {
  return items.map((it, i) => ({ ...it, order: i + 1 }));
}
function isSuperset(it: any): it is SupersetItem {
  return it?.type === "Superset";
}
function supersetItems(item: SupersetItem): SupersetSubItem[] {
  return Array.isArray(item.items) ? item.items! : (Array.isArray(item.superset_items) ? item.superset_items! : []);
}

function GymEditor({
  data,
  onSaved,
}: {
  data: AdminWorkoutGym;
  onSaved: (id: string) => void;
}) {
  const [meta, setMeta] = useState({
    workout_name: data.workout_name || "",
    focus: data.focus || "",
    notes: data.notes || "",
    video_url: data.video_url || "",
    visibility: data.visibility || "global" as "global" | "private",
  });

  const [warmup, setWarmup] = useState<AdminRound | null>(data.warmup ? { ...data.warmup, items: (data.warmup.items || []).slice() } : null);
  const [main, setMain] = useState<AdminRound | null>(data.main ? { ...data.main, items: (data.main.items || []).slice() } : null);
  const [finisher, setFinisher] = useState<AdminRound | null>(data.finisher ? { ...data.finisher, items: (data.finisher.items || []).slice() } : null);

  const addSingle = (where: "warmup" | "main" | "finisher") => {
    const newItem: SingleItem = { type: "Single", order: 1, exercise_id: "", sets: 3, reps: "" };
    if (where === "warmup") setWarmup((prev) => prev ? { ...prev, items: renumber([...prev.items, { ...newItem, order: prev.items.length + 1 }]) } : { name: "Warm Up", order: 1, items: [newItem] });
    if (where === "main") setMain((prev) => prev ? { ...prev, items: renumber([...prev.items, { ...newItem, order: prev.items.length + 1 }]) } : { name: "Main Set", order: 2, items: [newItem] });
    if (where === "finisher") setFinisher((prev) => prev ? { ...prev, items: renumber([...prev.items, { ...newItem, order: prev.items.length + 1 }]) } : { name: "Finisher", order: 3, items: [newItem] });
  };

  const addSuperset = (where: "warmup" | "main" | "finisher") => {
    const ss: SupersetItem = {
      type: "Superset",
      order: 1,
      name: "",
      items: [{ exercise_id: "", reps: "", weight_kg: null }, { exercise_id: "", reps: "", weight_kg: null }],
      sets: 3,
      rest_s: null,
    };
    if (where === "warmup") setWarmup((prev) => prev ? { ...prev, items: renumber([...prev.items, { ...ss, order: prev.items.length + 1 }]) } : { name: "Warm Up", order: 1, items: [ss] });
    if (where === "main") setMain((prev) => prev ? { ...prev, items: renumber([...prev.items, { ...ss, order: prev.items.length + 1 }]) } : { name: "Main Set", order: 2, items: [ss] });
    if (where === "finisher") setFinisher((prev) => prev ? { ...prev, items: renumber([...prev.items, { ...ss, order: prev.items.length + 1 }]) } : { name: "Finisher", order: 3, items: [ss] });
  };

  const removeItem = (where: "warmup" | "main" | "finisher", idx: number) => {
    const drop = (r: AdminRound | null): AdminRound | null => {
      if (!r) return r;
      const nextItems = r.items.filter((_, i) => i !== idx);
      if (nextItems.length === 0 && r.name === "Finisher") return null;
      return { ...r, items: renumber(nextItems) };
    };
    if (where === "warmup") setWarmup((prev) => drop(prev));
    if (where === "main") setMain((prev) => drop(prev));
    if (where === "finisher") setFinisher((prev) => drop(prev));
  };

  const updateSingle = (where: "warmup" | "main" | "finisher", idx: number, patch: Partial<SingleItem>) => {
    const up = (r: AdminRound | null) => r ? { ...r, items: r.items.map((it, i) => (i === idx ? { ...(it as SingleItem), ...patch } : it)) } : r;
    if (where === "warmup") setWarmup((prev) => up(prev));
    if (where === "main") setMain((prev) => up(prev));
    if (where === "finisher") setFinisher((prev) => up(prev));
  };

  const updateSuperset = (where: "warmup" | "main" | "finisher", idx: number, patch: Partial<SupersetItem>) => {
    const up = (r: AdminRound | null) => r ? { ...r, items: r.items.map((it, i) => (i === idx ? { ...(it as SupersetItem), ...patch } : it)) } : r;
    if (where === "warmup") setWarmup((prev) => up(prev));
    if (where === "main") setMain((prev) => up(prev));
    if (where === "finisher") setFinisher((prev) => up(prev));
  };

  const setSupersetField = (where: "warmup" | "main" | "finisher", idx: number, field: keyof SupersetItem, value: any) => {
    const up = (r: AdminRound | null) =>
      r
        ? {
            ...r,
            items: r.items.map((it, i) => {
              if (i !== idx) return it;
              const ss = { ...(it as SupersetItem) };
              ss.items = supersetItems(ss);
              (ss as any)[field] = value;
              return ss;
            }),
          }
        : r;
    if (where === "warmup") setWarmup((prev) => up(prev));
    if (where === "main") setMain((prev) => up(prev));
    if (where === "finisher") setFinisher((prev) => up(prev));
  };

  const setSupersetSub = (
    where: "warmup" | "main" | "finisher",
    idx: number,
    subIdx: number,
    patch: Partial<SupersetSubItem>
  ) => {
    const up = (r: AdminRound | null) =>
      r
        ? {
            ...r,
            items: r.items.map((it, i) => {
              if (i !== idx) return it;
              const ss = { ...(it as SupersetItem) };
              const arr = supersetItems(ss).slice();
              arr[subIdx] = { ...arr[subIdx], ...patch };
              ss.items = arr;
              return ss;
            }),
          }
        : r;
    if (where === "warmup") setWarmup((prev) => up(prev));
    if (where === "main") setMain((prev) => up(prev));
    if (where === "finisher") setFinisher((prev) => up(prev));
  };

  const addSupersetSub = (where: "warmup" | "main" | "finisher", idx: number) => {
    const up = (r: AdminRound | null) =>
      r
        ? {
            ...r,
            items: r.items.map((it, i) => {
              if (i !== idx) return it;
              const ss = { ...(it as SupersetItem) };
              const arr = supersetItems(ss).slice();
              arr.push({ exercise_id: "", reps: "", weight_kg: null });
              ss.items = arr;
              return ss;
            }),
          }
        : r;
    if (where === "warmup") setWarmup((prev) => up(prev));
    if (where === "main") setMain((prev) => up(prev));
    if (where === "finisher") setFinisher((prev) => up(prev));
  };

  const removeSupersetSub = (where: "warmup" | "main" | "finisher", idx: number, subIdx: number) => {
    const up = (r: AdminRound | null) =>
      r
        ? {
            ...r,
            items: r.items.map((it, i) => {
              if (i !== idx) return it;
              const ss = { ...(it as SupersetItem) };
              const arr = supersetItems(ss).slice();
              if (arr.length <= 1) return ss; // at least one sub
              arr.splice(subIdx, 1);
              ss.items = arr;
              return ss;
            }),
          }
        : r;
    if (where === "warmup") setWarmup((prev) => up(prev));
    if (where === "main") setMain((prev) => up(prev));
    if (where === "finisher") setFinisher((prev) => up(prev));
  };

  // Save
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveGym() {
    try {
      setSaving(true);
      setMsg("Saving…");

      const payload = {
        workout_id: data.workout_id,
        visibility: meta.visibility,
        owner_email: meta.visibility === "private" ? (data.owner_email || undefined) : undefined,
        workout_name: meta.workout_name.trim(),
        focus: meta.focus.trim() || undefined,
        notes: meta.notes.trim() || undefined,
        video_url: meta.video_url.trim() || undefined,
        warmup: warmup ? { ...warmup, items: warmup.items } : null,
        main: main ? { ...main, items: main.items } : null,
        finisher: finisher ? { ...finisher, items: finisher.items } : null,
      };

      const res = await fetch("/api/workouts/gym-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Update failed");
      setMsg("Saved ✅");
      onSaved(data.workout_id);
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "Failed to save"}`);
    } finally {
      setSaving(false);
    }
  }

  // UI helpers
  const RoundBlock = ({ title, r, where, setR }: { title: string; r: AdminRound | null | undefined; where: "warmup" | "main" | "finisher"; setR: (v: AdminRound | null) => void }) => {
    return (
      <Section title={title}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="d-flex gap-2">
            <button className="btn btn-sm" style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }} onClick={() => addSingle(where)}>
              + Single
            </button>
            <button className="btn btn-sm btn-outline-light" style={{ borderRadius: 24 }} onClick={() => addSuperset(where)}>
              + Superset
            </button>
          </div>
          {r && (
            <div className="d-flex align-items-center gap-2">
              <span className="text-dim small">Order</span>
              <input className="form-control form-control-sm" type="number" min={1} style={{ width: 100 }} value={r.order} onChange={(e) => setR({ ...(r as AdminRound), order: Number(e.target.value) || 1 })} />
            </div>
          )}
        </div>

        {!r?.items?.length ? (
          <div className="small text-dim">No items yet.</div>
        ) : (
          r.items.map((it, idx) => (
            <div key={idx} className="p-2 mb-2" style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
              {isSuperset(it) ? (
                <>
                  <div className="row g-2">
                    <div className="col-12 col-md-4">
                      <label className="form-label">Superset name</label>
                      <input className="form-control" value={it.name || ""} onChange={(e) => setSupersetField(where, idx, "name", e.target.value)} />
                    </div>
                    <div className="col-6 col-md-2">
                      <label className="form-label">Sets</label>
                      <input className="form-control" type="number" min={1} value={Number.isFinite(it.sets) ? it.sets : 3} onChange={(e) => setSupersetField(where, idx, "sets", Math.max(1, Number(e.target.value) || 3))} />
                    </div>
                    <div className="col-6 col-md-2">
                      <label className="form-label">Rest (s)</label>
                      <input className="form-control" type="number" min={0} value={it.rest_s ?? ""} onChange={(e) => setSupersetField(where, idx, "rest_s", Number(e.target.value) || 0)} />
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label">Notes</label>
                      <input className="form-control" value={it.notes || ""} onChange={(e) => setSupersetField(where, idx, "notes", e.target.value)} />
                    </div>
                    <div className="col-12 col-md-1 d-flex align-items-end">
                      <button className="btn btn-outline-danger btn-sm ms-auto" style={{ borderRadius: 12 }} onClick={() => removeItem(where, idx)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-2">
                    {(supersetItems(it) || []).map((s, sidx) => (
                      <div key={sidx} className="row g-2 align-items-end mb-2">
                        <div className="col-12 col-md-5">
                          <label className="form-label">Exercise ID</label>
                          <input className="form-control" value={s.exercise_id} onChange={(e) => setSupersetSub(where, idx, sidx, { exercise_id: e.target.value })} placeholder="e.g., 2H Kettlebell Row" />
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="form-label">Reps</label>
                          <input className="form-control" value={s.reps || ""} onChange={(e) => setSupersetSub(where, idx, sidx, { reps: e.target.value })} />
                        </div>
                        <div className="col-4 col-md-2">
                          <label className="form-label">Weight (kg)</label>
                          <input className="form-control" type="number" min={0} value={s.weight_kg ?? ""} onChange={(e) => setSupersetSub(where, idx, sidx, { weight_kg: Number(e.target.value) || null })} />
                        </div>
                        <div className="col-2 col-md-2 d-flex">
                          <button className="btn btn-outline-danger ms-auto" onClick={() => removeSupersetSub(where, idx, sidx)} title="Remove exercise from superset">
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                    <button className="btn btn-sm btn-outline-light" style={{ borderRadius: 24 }} onClick={() => addSupersetSub(where, idx)}>
                      + Add Exercise to Superset
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="row g-2">
                    <div className="col-12 col-md-4">
                      <label className="form-label">Exercise ID</label>
                      <input className="form-control" value={(it as SingleItem).exercise_id} onChange={(e) => updateSingle(where, idx, { exercise_id: e.target.value })} placeholder="e.g., Bench Press" />
                    </div>
                    <div className="col-4 col-md-2">
                      <label className="form-label">Sets</label>
                      <input className="form-control" type="number" min={1} value={(it as SingleItem).sets ?? ""} onChange={(e) => updateSingle(where, idx, { sets: Number(e.target.value) || undefined })} />
                    </div>
                    <div className="col-8 col-md-3">
                      <label className="form-label">Reps</label>
                      <input className="form-control" value={(it as SingleItem).reps ?? ""} onChange={(e) => updateSingle(where, idx, { reps: e.target.value })} placeholder="e.g., 10 or 10-8-6" />
                    </div>
                    <div className="col-6 col-md-2">
                      <label className="form-label">Weight (kg)</label>
                      <input className="form-control" type="number" min={0} value={(it as SingleItem).weight_kg ?? ""} onChange={(e) => updateSingle(where, idx, { weight_kg: Number(e.target.value) || null })} />
                    </div>
                    <div className="col-6 col-md-1">
                      <label className="form-label">Rest (s)</label>
                      <input className="form-control" type="number" min={0} value={(it as SingleItem).rest_s ?? ""} onChange={(e) => updateSingle(where, idx, { rest_s: Number(e.target.value) || null })} />
                    </div>
                    <div className="col-12 d-flex">
                      <button className="btn btn-outline-danger ms-auto" style={{ borderRadius: 12 }} onClick={() => removeItem(where, idx)}>
                        Delete item
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </Section>
    );
  };

  return (
    <>
      {/* Meta */}
      <Section title="Workout Meta">
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
            {meta.visibility === "private" && <small className="text-muted">Owner: {data.owner_email || "—"}</small>}
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
      </Section>

      <RoundBlock title={warmup?.name || "Warm Up"} r={warmup} where="warmup" setR={setWarmup} />
      <RoundBlock title={main?.name || "Main Set"} r={main} where="main" setR={(v) => setMain(v)} />
      <RoundBlock title={finisher?.name || "Finisher"} r={finisher} where="finisher" setR={setFinisher} />

      {msg && <div className={`alert ${msg.startsWith("Error") ? "alert-danger" : "alert-info"}`}>{msg}</div>}
      <div className="d-grid">
        <button
          className="btn btn-primary"
          disabled={saving}
          onClick={saveGym}
          style={{ borderRadius: 24, background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, border: "none", fontWeight: 700 }}
        >
          {saving ? "Saving…" : "Save Workout"}
        </button>
      </div>
    </>
  );
}

/* =========================
   PAGE
   ========================= */
export default function AdminViewerEditorPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";

  const url = id ? `/api/workouts/admin/${encodeURIComponent(String(id))}` : null;
  const { data, error, isLoading } = useSWR<AdminWorkout>(url, fetcher, { revalidateOnFocus: false });

  const [viewerDate, setViewerDate] = useState<string>(formatYMD(new Date()));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (status === "loading") return <div className="container py-4">Checking access…</div>;
  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4">
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const kind: "gym" | "bxkr" | "unknown" = useMemo(() => {
    if (isGym(data)) return "gym";
    if (isBxkr(data)) return "bxkr";
    return "unknown";
  }, [data]);

  const viewerHref = useMemo(() => {
    if (!id) return "#";
    if (kind === "gym") {
      const ymd = (mounted && viewerDate) ? viewerDate : formatYMD(new Date());
      return `/gymworkout/${encodeURIComponent(String(id))}?date=${encodeURIComponent(ymd)}`;
    }
    if (kind === "bxkr") return `/workout/${encodeURIComponent(String(id))}`;
    return "#";
  }, [id, kind, viewerDate, mounted]);

  return (
    <>
      <Head>
        <title>{data?.workout_name ? `${data.workout_name} • Admin Editor` : "Admin Editor"}</title>
      </Head>
      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="mb-3 d-flex justify-content-between align-items-center">
          <Link href="/admin" className="btn btn-outline-secondary">← Back to Admin</Link>

          <div className="d-flex align-items-center gap-2">
            {kind === "gym" && (
              <>
                <label htmlFor="viewer-date" className="small text-dim mb-0">Viewer date</label>
                <input
                  id="viewer-date"
                  type="date"
                  className="form-control form-control-sm"
                  value={viewerDate}
                  onChange={(e) => setViewerDate(e.target.value)}
                  style={{ width: 150, background: "transparent", color: "#fff" }}
                />
              </>
            )}
            <Link
              href={viewerHref}
              className="btn btn-outline-light"
              style={{ borderRadius: 24 }}
              title={kind === "gym" ? "Open Gym Viewer" : kind === "bxkr" ? "Open BXKR Viewer" : "Viewer"}
            >
              Open in Viewer
            </Link>
          </div>
        </div>

        <h2 className="mb-2">{data?.workout_name || "Workout"}</h2>
        <div className="small text-dim mb-3">
          Kind: <span className="text-light">{kind !== "unknown" ? kind.toUpperCase() : "Unknown"}</span>
        </div>

        {isLoading && <div className="small text-dim">Loading workout…</div>}
        {error && <div className="alert alert-danger">Failed to load: {String((error as Error)?.message || error)}</div>}

        {data && (
          <>
            {/* Render the appropriate editor */}
            {isBxkr(data) ? (
              <BxkrEditor
                data={data}
                onSaved={() => {
                  // stay here; message shown inside component
                }}
              />
            ) : isGym(data) ? (
              <GymEditor
                data={data}
                onSaved={() => {
                  // stay here; message shown inside component
                }}
              />
            ) : (
              <section className="futuristic-card p-3">
                <div className="small text-dim">
                  Unrecognised workout shape. Ensure the admin API returns either Gym (warmup/main/finisher) or BXKR (boxing+kettlebell).
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
