
// pages/admin/workouts/create.tsx
"use client";

import Head from "next/head";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import useSWR from "swr";
import BottomNav from "../../../components/BottomNav";
import type {
  WorkoutCreatePayload,
  KBStyle,
  BoxingAction,
} from "../../../types/workouts";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const ACCENT = "#FF8A2A";
const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: 16,
  padding: 16,
  backdropFilter: "blur(10px)",
  boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
};

const roundLabels = [
  "Basics",
  "Speed",
  "Power",
  "Defensive",
  "Engine", // Boxing (1..5)
  "Engine",
  "Power",
  "Ladder",
  "Core",
  "Load", // Kettlebell (6..10)
];

// --- Boxing shorthand mapping (includes DUCK) ---
const BOXING_CODE_MAP: Record<string, BoxingAction> = {
  "1": { kind: "punch", code: "jab" },
  "2": { kind: "punch", code: "cross" },
  "3": { kind: "punch", code: "lead_hook" },
  "4": { kind: "punch", code: "rear_hook" },
  "5": { kind: "punch", code: "lead_uppercut" },
  "6": { kind: "punch", code: "rear_uppercut" },
  jab: { kind: "punch", code: "jab" },
  cross: { kind: "punch", code: "cross" },
  hook: { kind: "punch", code: "hook" }, // generic hook
  uppercut: { kind: "punch", code: "uppercut" }, // generic uppercut
  slip: { kind: "defence", code: "slip" },
  roll: { kind: "defence", code: "roll" },
  parry: { kind: "defence", code: "parry" },
  duck: { kind: "defence", code: "duck" }, // ✅ added duck
};

function expandComboShorthand(name: string | undefined, input: string) {
  const seq = String(input || "").trim();
  const parts = seq.split(/[\s,;/-]+/).map((p) => p.trim().toLowerCase());
  const actions: BoxingAction[] = parts
    .filter(Boolean)
    .map((p) => {
      // support "xN" suffix (e.g., "jabx2")
      const m = p.match(/^([a-z0-9]+)x(\d+)$/);
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

  if (!actions.length) throw new Error("Combo must contain at least one action");

  return {
    name: name || undefined,
    actions,
  };
}

type BoxingComboInput = { name?: string; sequence: string };
type KbItemInput = {
  exercise_id: string;
  order: number;
  reps?: string;
  time_s?: number;
  weight_kg?: number;
  tempo?: string;
  rest_s?: number;
  notes?: string;
};

export default function CreateWorkoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role || "user";
  const ownerEmail = session?.user?.email || "";

  // --- Load exercises for dropdown ---
  const { data: exData } = useSWR<{ exercises: Array<{ id: string; exercise_name: string; type: string }> }>(
    "/api/exercises/index?limit=500",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  const exercises = exData?.exercises || [];

  // --- Template metadata ---
  const [visibility, setVisibility] = useState<"global" | "private">("global");
  const [workoutName, setWorkoutName] = useState("");
  const [focus, setFocus] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [isBenchmark, setIsBenchmark] = useState(false);
  const [benchmarkName, setBenchmarkName] = useState("");

  // --- Boxing rounds: 5 rounds × exactly 3 combos (with shorthand inputs) ---
  const [boxingRounds, setBoxingRounds] = useState<
    { label: string; combos: [BoxingComboInput, BoxingComboInput, BoxingComboInput] }[]
  >(
    Array.from({ length: 5 }, (_, i) => ({
      label: roundLabels[i],
      combos: [
        { name: "", sequence: "" },
        { name: "", sequence: "" },
        { name: "", sequence: "" },
      ],
    }))
  );

  // --- Kettlebell rounds: 5 rounds with style + dynamic items ---
  const [kbRounds, setKbRounds] = useState<
    { label: string; style: KBStyle; items: KbItemInput[]; is_benchmark_component?: boolean }[]
  >(
    Array.from({ length: 5 }, (_, i) => ({
      label: roundLabels[5 + i],
      style: "AMRAP",
      items: [{ exercise_id: "", order: 1, reps: "" }],
      is_benchmark_component: false,
    }))
  );

  const [statusMsg, setStatusMsg] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  if (status === "loading") {
    return <div className="container py-4">Checking access…</div>;
  }
  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4">
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  // --- Boxing handlers ---
  function updateCombo(roundIndex: number, comboIndex: number, field: "name" | "sequence", value: string) {
    setBoxingRounds((prev) => {
      const next = [...prev];
      const combos = [...next[roundIndex].combos] as [BoxingComboInput, BoxingComboInput, BoxingComboInput];
      const updated = { ...combos[comboIndex], [field]: value };
      combos[comboIndex] = updated;
      next[roundIndex] = { ...next[roundIndex], combos };
      return next;
    });
  }

  // --- KB handlers ---
  function updateKbStyle(roundIndex: number, style: KBStyle) {
    setKbRounds((prev) => {
      const next = [...prev];
      next[roundIndex] = { ...next[roundIndex], style };
      return next;
    });
  }
  function addKbItem(roundIndex: number) {
    setKbRounds((prev) => {
      const next = [...prev];
      const items = [...next[roundIndex].items];
      const maxOrder = items.reduce((m, it) => Math.max(m, it.order || 0), 0);
      items.push({ exercise_id: "", order: maxOrder + 1, reps: "" });
      next[roundIndex] = { ...next[roundIndex], items };
      return next;
    });
  }
  function removeKbItem(roundIndex: number, idx: number) {
    setKbRounds((prev) => {
      const next = [...prev];
      const items = [...next[roundIndex].items];
      items.splice(idx, 1);
      next[roundIndex] = { ...next[roundIndex], items };
      return next;
    });
  }
  function updateKbItem(roundIndex: number, idx: number, field: keyof KbItemInput, value: string) {
    setKbRounds((prev) => {
      const next = [...prev];
      const items = [...next[roundIndex].items];
      const current = { ...items[idx] };
      if (field === "order") {
        current.order = Number(value) || 1;
      } else if (field === "time_s") {
        current.time_s = value ? Number(value) : undefined;
      } else if (field === "weight_kg") {
        current.weight_kg = value ? Number(value) : undefined;
      } else if (field === "rest_s") {
        current.rest_s = value ? Number(value) : undefined;
      } else {
        (current as any)[field] = value;
      }
      items[idx] = current;
      next[roundIndex] = { ...next[roundIndex], items };
      return next;
    });
  }
  function toggleKbBenchmark(roundIndex: number) {
    setKbRounds((prev) => {
      const next = [...prev];
      next[roundIndex].is_benchmark_component = !next[roundIndex].is_benchmark_component;
      return next;
    });
  }
  function selectKbExercise(roundIndex: number, idx: number, exerciseId: string) {
    setKbRounds((prev) => {
      const next = [...prev];
      const items = [...next[roundIndex].items];
      const current = { ...items[idx], exercise_id: exerciseId };
      items[idx] = current;
      next[roundIndex] = { ...next[roundIndex], items };
      return next;
    });
  }

  // --- Validation ---
  function validateForm(): string | null {
    if (!workoutName.trim()) return "Workout name is required.";
    // Boxing rounds: each combo must expand to ≥1 action
    for (let r = 0; r < boxingRounds.length; r++) {
      for (let c = 0; c < 3; c++) {
        const seq = boxingRounds[r].combos[c].sequence.trim();
        if (!seq) return `Boxing round ${r + 1}: combo ${c + 1} sequence is required.`;
        try {
          expandComboShorthand(boxingRounds[r].combos[c].name, seq);
        } catch (e: any) {
          return `Boxing round ${r + 1}, combo ${c + 1}: ${e.message}`;
        }
      }
    }
    // KB rounds: must have ≥1 item with exercise_id + order
    for (let r = 0; r < kbRounds.length; r++) {
      const round = kbRounds[r];
      if (!round.items.length) return `Kettlebell round ${r + 1}: add at least one item.`;
      for (let i = 0; i < round.items.length; i++) {
        const it = round.items[i];
        if (!String(it.exercise_id).trim()) return `Kettlebell round ${r + 1}, item ${i + 1}: exercise_id is required.`;
        if (typeof it.order !== "number" || it.order < 1) return `Kettlebell round ${r + 1}, item ${i + 1}: order must be ≥ 1.`;
      }
    }
    return null;
  }

  async function saveWorkout() {
    const err = validateForm();
    if (err) {
      setStatusMsg(`Error: ${err}`);
      return;
    }

    setSaving(true);
    setStatusMsg("Saving workout…");

    const payload: WorkoutCreatePayload = {
      visibility,
      owner_email: visibility === "private" ? ownerEmail : undefined,
      workout_name: workoutName.trim(),
      focus: focus.trim() || undefined,
      notes: notes.trim() || undefined,
      video_url: videoUrl.trim() || undefined,
      is_benchmark: !!isBenchmark,
      benchmark_name: isBenchmark ? (benchmarkName.trim() || undefined) : undefined,
      boxing: {
        rounds: boxingRounds.map((r, idx) => ({
          name: r.label || `Boxing Round ${idx + 1}`,
          combos: [
            expandComboShorthand(r.combos[0].name, r.combos[0].sequence),
            expandComboShorthand(r.combos[1].name, r.combos[1].sequence),
            expandComboShorthand(r.combos[2].name, r.combos[2].sequence),
          ] as any,
        })),
      },
      kettlebell: {
        rounds: kbRounds.map((r, idx) => ({
          name: r.label || `Kettlebells Round ${idx + 1}`,
          style: r.style,
          order: idx + 6,
          items: r.items.map((it) => ({
            exercise_id: it.exercise_id.trim(),
            order: it.order,
            reps: it.reps?.trim() || undefined,
            time_s: typeof it.time_s === "number" ? it.time_s : undefined,
            weight_kg: typeof it.weight_kg === "number" ? it.weight_kg : undefined,
            tempo: it.tempo?.trim() || undefined,
            rest_s: typeof it.rest_s === "number" ? it.rest_s : undefined,
            notes: it.notes?.trim() || undefined,
          })),
          is_benchmark_component: !!r.is_benchmark_component,
        })),
      },
    };

    try {
      const res = await fetch("/api/workouts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.workout_id) {
        setStatusMsg("Workout created successfully!");
        setTimeout(() => router.push(`/workouts/${data.workout_id}`), 800);
      } else {
        setStatusMsg(`Error: ${data?.error || "Failed to create workout template"}`);
      }
    } catch (e: any) {
      console.error(e);
      setStatusMsg(`Error: ${e?.message || "Network error"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head>
        <title>Create Workout - BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main
        className="container py-3"
        style={{
          paddingBottom: "70px",
          minHeight: "100vh",
          color: "#fff",
          background: "linear-gradient(135deg,#0E0F12,#151923)",
          borderRadius: 12,
        }}
      >
        <div className="mb-3">
          <button className="btn btn-outline-secondary mb-3" onClick={() => router.push("/admin")}>
            ← Back to Admin Dashboard
          </button>
        </div>

        <h2 className="mb-4 text-center">Create Workout</h2>

        {statusMsg && (
          <div className={`alert ${statusMsg.startsWith("Error") ? "alert-danger" : "alert-info"}`}>
            {statusMsg}
          </div>
        )}

        {/* Template meta */}
        <section style={{ ...CARD, marginBottom: 16 }}>
          <div className="row g-2">
            <div className="col-12 col-md-4">
              <label className="form-label">Visibility</label>
              <select
                className="form-select"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "global" | "private")}
              >
                <option value="global">Global (everyone)</option>
                <option value="private">Private (owner only)</option>
              </select>
              {visibility === "private" && <small className="text-muted">Owner: {ownerEmail || "(unknown)"}</small>}
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">Focus</label>
              <input
                className="form-control"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="e.g., Power & Conditioning"
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">Video URL</label>
              <input
                className="form-control"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>

          <div className="row g-2 mt-2">
            <div className="col-12 col-md-8">
              <label className="form-label">Workout Name</label>
              <input
                className="form-control"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                placeholder="Enter workout name"
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">Benchmark</label>
              <div className="d-flex align-items-center gap-2">
                <input
                  type="checkbox"
                  id="isBenchmark"
                  checked={isBenchmark}
                  onChange={(e) => setIsBenchmark(e.target.checked)}
                />
                <label htmlFor="isBenchmark" style={{ marginBottom: 0 }}>Is benchmark?</label>
              </div>
              {isBenchmark && (
                <input
                  className="form-control mt-2"
                  value={benchmarkName}
                  onChange={(e) => setBenchmarkName(e.target.value)}
                  placeholder="Benchmark name (optional)"
                />
              )}
            </div>
          </div>

          <div className="mt-2">
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-control"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        </section>

        {/* Boxing rounds (5 × 3 combos) */}
        <h4 className="mb-3">Boxing (5 rounds · each has 3 combos)</h4>
        {boxingRounds.map((round, i) => (
          <div key={`box-${i}`} className="card p-3 mb-3">
            <h6 className="fw-bold mb-2">Round {i + 1} – {round.label} (Boxing)</h6>
            <small className="text-muted mb-2">
              Use shorthand like <code>1-2-slip</code>, <code>jabx2-cross</code>, <code>1-2-duck</code>
            </small>
            {round.combos.map((combo, idx) => (
              <div className="row g-2 mb-2" key={`box-${i}-c-${idx}`}>
                <div className="col-12 col-md-4">
                  <input
                    className="form-control"
                    value={combo.name || ""}
                    onChange={(e) => updateCombo(i, idx, "name", e.target.value)}
                    placeholder={`Combo ${idx + 1} name (optional)`}
                  />
                </div>
                <div className="col-12 col-md-8">
                  <input
                    className="form-control"
                    value={combo.sequence}
                    onChange={(e) => updateCombo(i, idx, "sequence", e.target.value)}
                    placeholder="Sequence (e.g., 1-2-slip, 1-2-duck)"
                  />
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Kettlebell rounds (5) */}
        <h4 className="mb-3">Kettlebells (5 rounds)</h4>
        {kbRounds.map((round, i) => (
          <div key={`kb-${i}`} className="card p-3 mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold m-0">Round {i + 1} – {round.label} (Kettlebell)</h6>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`kb-bm-${i}`}
                  checked={!!round.is_benchmark_component}
                  onChange={() => toggleKbBenchmark(i)}
                />
                <label htmlFor={`kb-bm-${i}`} className="form-check-label">Counts toward benchmark</label>
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-12 col-md-4">
                <label className="form-label">Style</label>
                <select
                  className="form-select"
                  value={round.style}
                  onChange={(e) => updateKbStyle(i, e.target.value as KBStyle)}
                >
                  <option value="AMRAP">AMRAP</option>
                  <option value="EMOM">EMOM</option>
                  <option value="LADDER">LADDER</option>
                </select>
              </div>
            </div>

            <div className="mb-2">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>Items</strong>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ color: "#fff", background: ACCENT, borderRadius: 24 }}
                  onClick={() => addKbItem(i)}
                >
                  + Add Item
                </button>
              </div>

              {round.items.map((it, idx) => {
                const selectedOption = exercises.find((e) => e.id === it.exercise_id);
                return (
                  <div key={`kb-${i}-it-${idx}`} className="row g-2 mb-2">
                    <div className="col-12 col-md-4">
                      <label className="form-label">Exercise</label>
                      <select
                        className="form-select"
                        value={it.exercise_id}
                        onChange={(e) => selectKbExercise(i, idx, e.target.value)}
                      >
                        <option value="">— Select exercise —</option>
                        {exercises.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.exercise_name} {e.type ? `• ${e.type}` : ""}
                          </option>
                        ))}
                      </select>
                      <small className="text-muted">
                        {selectedOption ? `Selected: ${selectedOption.exercise_name}` : "Or type ID below"}
                      </small>
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label">Manual ID (optional)</label>
                      <input
                        className="form-control"
                        value={it.exercise_id}
                        onChange={(e) => updateKbItem(i, idx, "exercise_id", e.target.value)}
                        placeholder="exercise_id (e.g., e1)"
                      />
                    </div>

                    <div className="col-6 col-md-2">
                      <label className="form-label">Order</label>
                      <input
                        className="form-control"
                        type="number"
                        min={1}
                        value={it.order}
                        onChange={(e) => updateKbItem(i, idx, "order", e.target.value)}
                        placeholder="Order"
                      />
                    </div>

                    <div className="col-6 col-md-3">
                      <label className="form-label">Reps</label>
                      <input
                        className="form-control"
                        value={it.reps || ""}
                        onChange={(e) => updateKbItem(i, idx, "reps", e.target.value)}
                        placeholder="e.g., 10 or 1-2-3-4-5"
                      />
                    </div>

                    <div className="col-6 col-md-2">
                      <label className="form-label">Time (s)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={it.time_s ?? ""}
                        onChange={(e) => updateKbItem(i, idx, "time_s", e.target.value)}
                        placeholder="e.g., 60"
                      />
                    </div>

                    <div className="col-6 col-md-2">
                      <label className="form-label">Weight (kg)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={it.weight_kg ?? ""}
                        onChange={(e) => updateKbItem(i, idx, "weight_kg", e.target.value)}
                        placeholder="e.g., 24"
                      />
                    </div>

                    <div className="col-6 col-md-2">
                      <label className="form-label">Tempo</label>
                      <input
                        className="form-control"
                        value={it.tempo || ""}
                        onChange={(e) => updateKbItem(i, idx, "tempo", e.target.value)}
                        placeholder="e.g., 3-1-1"
                      />
                    </div>

                    <div className="col-6 col-md-2">
                      <label className="form-label">Rest (s)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={it.rest_s ?? ""}
                        onChange={(e) => updateKbItem(i, idx, "rest_s", e.target.value)}
                        placeholder="e.g., 30"
                      />
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label">Notes</label>
                      <input
                        className="form-control"
                        value={it.notes || ""}
                        onChange={(e) => updateKbItem(i, idx, "notes", e.target.value)}
                        placeholder="Optional notes"
                      />
                    </div>

                    <div className="col-12 col-md-2 d-flex align-items-end">
                      <button
                        type="button"
                        className="btn btn-outline-light btn-sm"
                        style={{ borderRadius: 24 }}
                        onClick={() => removeKbItem(i, idx)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <button
          className="btn btn-primary w-100 mt-3"
          onClick={saveWorkout}
          disabled={saving}
          style={{
            borderRadius: 24,
            background: ACCENT,
            border: "none",
            boxShadow: `0 0 14px ${ACCENT}88`,
          }}
        >
          {saving ? "Saving…" : "Save Workout"}
        </button>
      </main>

      <BottomNav />
    </>
   );
}
