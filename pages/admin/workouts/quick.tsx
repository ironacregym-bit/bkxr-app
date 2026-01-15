
// pages/admin/workouts/quick.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import BottomNav from "../../../components/BottomNav";

type KBStyle = "AMRAP" | "EMOM" | "LADDER";

type BoxingAction =
  | { kind: "punch"; code: "jab" | "cross" | "lead_hook" | "rear_hook" | "lead_uppercut" | "rear_uppercut" | "hook" | "uppercut" }
  | { kind: "defence"; code: "slip" | "roll" | "parry" | "duck" };

type BoxingCombo = { name?: string; actions: BoxingAction[] };

type WorkoutCreatePayload = {
  visibility: "global" | "private";
  owner_email?: string;
  workout_name: string;
  focus?: string;
  notes?: string;
  video_url?: string;
  is_benchmark: boolean;
  benchmark_name?: string;
  boxing: {
    rounds: Array<{
      name: string;
      combos: [BoxingCombo, BoxingCombo, BoxingCombo];
    }>;
  };
  kettlebell: {
    rounds: Array<{
      name: string;
      style: KBStyle;
      order: number; // 6..10
      items: Array<{
        exercise_id: string;
        order: number;
        reps?: string;
        time_s?: number;
        weight_kg?: number;
        tempo?: string;
        rest_s?: number;
        notes?: string;
      }>;
      is_benchmark_component?: boolean;
    }>;
  };
};

type ExerciseListItem = { id: string; exercise_name: string; type?: string };

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

/* Deep clone helper to avoid depending on structuredClone */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/* ---------- Boxing helpers ---------- */
const P = {
  JAB: { kind: "punch", code: "jab" } as const,
  CROSS: { kind: "punch", code: "cross" } as const,
  L_HOOK: { kind: "punch", code: "lead_hook" } as const,
  R_HOOK: { kind: "punch", code: "rear_hook" } as const,
  L_UP: { kind: "punch", code: "lead_uppercut" } as const,
  R_UP: { kind: "punch", code: "rear_uppercut" } as const,
};
const D = {
  DUCK: { kind: "defence", code: "duck" } as const,
  SLIP: { kind: "defence", code: "slip" } as const,
  ROLL: { kind: "defence", code: "roll" } as const,
  PARRY: { kind: "defence", code: "parry" } as const,
};

function boxingRound(
  kind: "Basics" | "Speed" | "Power" | "Defensive" | "Engine",
  name = kind
): { name: string; combos: [BoxingCombo, BoxingCombo, BoxingCombo] } {
  if (kind === "Basics") {
    return {
      name,
      combos: [
        { actions: [P.JAB, P.CROSS, P.JAB] },
        { actions: [P.JAB, P.CROSS, P.L_HOOK] },
        { actions: [P.CROSS, P.L_HOOK, P.CROSS] },
      ],
    };
  }
  if (kind === "Speed") {
    return {
      name,
      combos: [
        { actions: [P.JAB, P.JAB, P.CROSS] },
        { actions: [P.JAB, P.CROSS, P.L_HOOK, P.CROSS] },
        { actions: [P.JAB, P.CROSS, P.JAB, P.CROSS] },
      ],
    };
  }
  if (kind === "Power") {
    return {
      name,
      combos: [
        { actions: [P.CROSS, P.L_HOOK, P.CROSS] },
        { actions: [P.L_HOOK, P.R_HOOK, P.R_UP] },
        { actions: [P.CROSS, P.L_UP, P.R_UP] },
      ],
    };
  }
  if (kind === "Defensive") {
    return {
      name,
      combos: [
        { actions: [P.JAB, D.DUCK, P.CROSS] },
        { actions: [P.L_HOOK, D.DUCK, P.L_HOOK] },
        { actions: [P.JAB, P.CROSS, D.DUCK, P.R_HOOK] },
      ],
    };
  }
  // Engine
  return {
    name,
    combos: [
      { actions: [P.JAB, P.CROSS, P.JAB, P.CROSS] },
      { actions: [P.L_HOOK, P.CROSS, P.L_HOOK] },
      { actions: [P.JAB, P.CROSS, P.L_HOOK, P.CROSS] },
    ],
  };
}

/* ---------- KB suggestions library (names for fuzzy match) ---------- */
const KB_SUGGESTIONS = {
  ENGINE: ["Goblet Squat", "Deadlift", "Plank Up-Downs"],
  POWER: ["Swing", "Pushups", "Lunges"],
  LADDER: ["Clean", "V-Ups"],
  CORE: ["Crunches", "Full Body Crunch", "Plank Up-Downs"],
  LOAD: ["Thruster", "Pull throughs", "Lunges"],
};

// Fuzzy find best matching exercise_id by name (case-insensitive contains)
function fuzzyFindId(exercises: ExerciseListItem[], label: string): string | null {
  const target = label.toLowerCase();
  // direct contains
  const direct = exercises.find((e) => e.exercise_name?.toLowerCase().includes(target));
  if (direct) return direct.id;

  // minor normalisation
  const normalised = target.replace(/\s+/g, " ").replace(/-/g, " ").trim();
  const alt = exercises.find((e) =>
    e.exercise_name?.toLowerCase().replace(/\s+/g, " ").replace(/-/g, " ").includes(normalised)
  );
  return alt ? alt.id : null;
}

// Compose kettlebell round items with exercise_id matches where possible
function buildKbRoundItems(
  kind: "ENGINE" | "POWER" | "LADDER" | "CORE" | "LOAD",
  order: number,
  exercises: ExerciseListItem[]
) {
  const labels = KB_SUGGESTIONS[kind as keyof typeof KB_SUGGESTIONS] as string[];
  const items = labels.map((label, idx) => {
    const id = fuzzyFindId(exercises, label);
    // rep/time suggestions
    const reps =
      kind === "ENGINE" ? (idx < 2 ? "6" : "6") :
      kind === "POWER" ? "8-10" :
      kind === "LADDER" ? "2/4/6" :
      kind === "CORE"
        ? (label.toLowerCase().includes("plank") ? undefined : label === "Full Body Crunch" ? "16" : "20")
        : kind === "LOAD"
        ? (label.toLowerCase().includes("lunges") ? "8" : "6")
        : undefined;

    const time_s = kind === "CORE" && label.toLowerCase().includes("plank") ? 30 : undefined;

    return {
      desired_label: label,
      exercise_id: id || "",
      order: idx + 1,
      reps,
      time_s,
    };
  });

  const style: KBStyle =
    kind === "ENGINE" || kind === "LOAD" ? "AMRAP" : kind === "POWER" || kind === "CORE" ? "EMOM" : "LADDER";

  return { style, order, items };
}

/* ---------------- Component ---------------- */
export default function QuickCreateWorkout() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const ownerEmail = session?.user?.email || "";

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Load exercises list for mapping
  const exKey = mounted ? "/api/exercises?limit=500" : null;
  const { data: exData } = useSWR<{ exercises: ExerciseListItem[] }>(exKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const exercises = exData?.exercises || [];

  // UI: tabs
  const [tab, setTab] = useState<"generate" | "paste">("generate");
  const isAllowed = mounted && status !== "loading" && !!session && (role === "admin" || role === "gym");

  // Generate form
  const [visibility, setVisibility] = useState<"global" | "private">("global");
  const [workoutName, setWorkoutName] = useState<string>("BXKR Session");
  const [focus, setFocus] = useState<string>("Mixed");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isBenchmark, setIsBenchmark] = useState<boolean>(false);
  const [benchmarkName, setBenchmarkName] = useState<string>("");

  // Generated preview
  const [preview, setPreview] = useState<WorkoutCreatePayload | null>(null);

  // Paste JSON
  const [rawJson, setRawJson] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /* Build a full WorkoutCreatePayload from current form */
  function generatePayload(): WorkoutCreatePayload {
    // Boxing (Rounds 1–5)
    const boxingKinds = ["Basics", "Speed", "Power", "Defensive", "Engine"] as const;
    const boxingRounds = boxingKinds.map((k) => boxingRound(k, `${k}`));

    // Kettlebell (Rounds 6–10)
    const kbKinds = ["ENGINE", "POWER", "LADDER", "CORE", "LOAD"] as const;
    const kbBuilt = kbKinds.map((kind, idx) => {
      const { style, order, items } = buildKbRoundItems(kind, 6 + idx, exercises);
      return {
        name: kind[0] + kind.slice(1).toLowerCase(),
        style,
        order,
        items: items.map((it) => ({
          exercise_id: it.exercise_id, // may be empty if not matched yet
          order: it.order,
          reps: it.reps,
          time_s: it.time_s,
        })),
        is_benchmark_component: false,
      };
    });

    return {
      visibility,
      owner_email: visibility === "private" ? ownerEmail : undefined,
      workout_name: workoutName.trim(),
      focus: focus.trim() || undefined,
      notes: notes.trim() || undefined,
      video_url: videoUrl.trim() || undefined,
      is_benchmark: !!isBenchmark,
      benchmark_name: isBenchmark ? benchmarkName.trim() || undefined : undefined,
      boxing: { rounds: boxingRounds as any }, // keep simple for strict TS compatibility
      kettlebell: { rounds: kbBuilt as any },
    };
  }

  /* Find unmapped KB items (exercise_id === "") for friendly picker */
  function computeUnmapped(
    p?: WorkoutCreatePayload
  ): Array<{ roundIdx: number; itemIdx: number; desired?: string }> {
    if (!p) return [];
    const list: Array<{ roundIdx: number; itemIdx: number; desired?: string }> = [];
    p.kettlebell.rounds.forEach((r, ri) => {
      r.items.forEach((it, ii) => {
        if (!String(it.exercise_id).trim()) {
          // Attempt to guess a "desired" label based on our library (best effort only)
          const desired = (KB_SUGGESTIONS as any)[(r.name || "").toUpperCase()]?.[ii];
          list.push({ roundIdx: ri, itemIdx: ii, desired });
        }
      });
    });
    return list;
  }

  function updatePreviewItem(roundIdx: number, itemIdx: number, exercise_id: string) {
    setPreview((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      next.kettlebell.rounds[roundIdx].items[itemIdx].exercise_id = exercise_id;
      return next;
    });
  }

  function validatePayload(p?: WorkoutCreatePayload): string | null {
    if (!p) return "No workout generated.";
    if (!p.workout_name) return "Workout name is required.";

    // Boxing: 5 rounds; each has 3 combos with ≥1 action
    for (let r = 0; r < p.boxing.rounds.length; r++) {
      const combos = p.boxing.rounds[r].combos;
      if (!combos || combos.length !== 3) return `Boxing round ${r + 1} must have 3 combos.`;
      for (let c = 0; c < 3; c++) {
        if (!combos[c]?.actions?.length) return `Boxing round ${r + 1}, combo ${c + 1} must have actions.`;
      }
    }
    // KB: each round has ≥1 item with exercise_id and order
    for (let r = 0; r < p.kettlebell.rounds.length; r++) {
      const round = p.kettlebell.rounds[r];
      if (!round.items?.length) return `Kettlebell round ${r + 1}: add at least one item.`;
      for (let i = 0; i < round.items.length; i++) {
        const it = round.items[i];
        if (!String(it.exercise_id).trim()) return `Kettlebell round ${r + 1}, item ${i + 1}: select an exercise.`;
        if (!it.order || it.order < 1) return `Kettlebell round ${r + 1}, item ${i + 1}: order must be ≥ 1.`;
      }
    }
    return null;
  }

  /* Actions */
  function handleGenerate() {
    setMsg(null);
    const p = generatePayload();
    setPreview(p);
    setTab("generate");
  }

  function handlePasteValidate() {
    setMsg(null);
    try {
      const j = JSON.parse(rawJson);
      // Minimal sanity checks
      if (!j || typeof j !== "object") throw new Error("Invalid JSON");
      if (!j.workout_name) throw new Error("Missing `workout_name`");
      if (!j.boxing?.rounds || !Array.isArray(j.boxing.rounds) || j.boxing.rounds.length !== 5)
        throw new Error("`boxing.rounds` must be an array of 5");
      if (!j.kettlebell?.rounds || !Array.isArray(j.kettlebell.rounds) || j.kettlebell.rounds.length !== 5)
        throw new Error("`kettlebell.rounds` must be an array of 5");

      setPreview(j as WorkoutCreatePayload);
      setTab("paste");
    } catch (e: any) {
      setPreview(null);
      setMsg(e?.message || "Invalid JSON");
    }
  }

  async function handleSave() {
    if (!preview) return;
    const err = validatePayload(preview);
    if (err) {
      setMsg(`Error: ${err}`);
      return;
    }
    setBusy(true);
    setMsg("Saving…");
    try {
      const res = await fetch("/api/workouts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to create workout");
      if (!json?.workout_id) throw new Error("Workout saved but no id returned");
      setMsg(`Saved ✅ (id: ${json.workout_id})`);
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  /* Derived (TS fix: coerce null → undefined) */
  const unmapped = useMemo(() => computeUnmapped(preview || undefined), [preview]);

  return (
    <>
      <Head>
        <title>Quick Create Workout • Admin</title>
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        {!mounted || status === "loading" ? (
          <div>Checking access…</div>
        ) : !isAllowed ? (
          <div className="py-4">
            <h3>Access Denied</h3>
            <p>You do not have permission to view this page.</p>
            <Link href="/more" className="btn btn-outline-secondary mt-2">← Back</Link>
          </div>
        ) : (
          <>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center gap-2">
                <Link href="/admin" className="btn btn-outline-secondary btn-sm">← Admin</Link>
                <h2 className="m-0">Quick Create Workout</h2>
              </div>
              <div className="btn-group">
                <button
                  className={`btn btn-${tab === "generate" ? "bxkr" : "outline-light"}`}
                  onClick={() => setTab("generate")}
                >
                  Generate
                </button>
                <button
                  className={`btn btn-${tab === "paste" ? "bxkr" : "outline-light"}`}
                  onClick={() => setTab("paste")}
                >
                  Paste JSON
                </button>
              </div>
            </div>

            {msg && (
              <div className={`alert ${msg.toLowerCase().startsWith("error") ? "alert-danger" : "alert-info"}`}>
                {msg}
              </div>
            )}

            {/* Generate tab */}
            {tab === "generate" && (
              <section
                className="mb-3"
                style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, backdropFilter: "blur(10px)" }}
              >
                <div className="row g-2">
                  <div className="col-12 col-md-3">
                    <label className="form-label">Visibility</label>
                    <select
                      className="form-select"
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as "global" | "private")}
                    >
                      <option value="global">Global (everyone)</option>
                      <option value="private">Private (owner only)</option>
                    </select>
                    {visibility === "private" && (
                      <small className="text-muted">Owner: {ownerEmail || "(unknown)"}</small>
                    )}
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label">Workout name</label>
                    <input className="form-control" value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label">Focus</label>
                    <input
                      className="form-control"
                      value={focus}
                      onChange={(e) => setFocus(e.target.value)}
                      placeholder="e.g., Engine / Power"
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label">Video URL</label>
                    <input
                      className="form-control"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="form-check mt-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="isBenchmark"
                        checked={isBenchmark}
                        onChange={(e) => setIsBenchmark(e.target.checked)}
                      />
                      <label htmlFor="isBenchmark" className="form-check-label">Is benchmark?</label>
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
                  <div className="col-12">
                    <label className="form-label">Notes (optional)</label>
                    <textarea
                      className="form-control"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>

                <div className="mt-2">
                  <button
                    className="btn"
                    style={{ color: "#fff", background: ACCENT, borderRadius: 24, boxShadow: `0 0 14px ${ACCENT}66` }}
                    onClick={handleGenerate}
                  >
                    Generate
                  </button>
                </div>
              </section>
            )}

            {/* Paste tab */}
            {tab === "paste" && (
              <section
                className="mb-3"
                style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, backdropFilter: "blur(10px)" }}
              >
                <label className="form-label">WorkoutCreatePayload JSON</label>
                <textarea
                  className="form-control"
                  rows={12}
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  placeholder='{"visibility":"global","workout_name":"…","boxing":{"rounds":[…]},"kettlebell":{"rounds":[…]}}'
                />
                <div className="mt-2">
                  <button className="btn btn-outline-light" onClick={handlePasteValidate}>
                    Validate & Preview
                  </button>
                </div>
              </section>
            )}

            {/* Preview & unmapped mapper */}
            {preview && (
              <section
                className="mb-3"
                style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, backdropFilter: "blur(10px)" }}
              >
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h5 className="m-0">Preview</h5>
                  <button
                    className="btn btn-bxkr"
                    onClick={handleSave}
                    disabled={busy || unmapped.length > 0}
                  >
                    {busy ? "Saving…" : "Save Workout"}
                  </button>
                </div>

                {/* Boxing summary */}
                <div className="mb-2">
                  <h6>Boxing (5 rounds, 3 combos each)</h6>
                  <ul className="m-0" style={{ paddingLeft: 18 }}>
                    {preview.boxing.rounds.map((r, i) => (
                      <li key={`bx-${i}`} className="mb-1">
                        <span className="fw-semibold">Round {i + 1} — {r.name}</span>
                        <span className="text-dim">
                          {" "}
                          • {r.combos.map((c) => c.actions.map((a) => ("code" in a ? a.code : "")).join("-")).join(" | ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* KB summary + mapping */}
                <div className="mt-3">
                  <h6>Kettlebells (5 rounds)</h6>
                  <ul className="m-0" style={{ paddingLeft: 18 }}>
                    {preview.kettlebell.rounds.map((r, i) => (
                      <li key={`kb-${i}`} className="mb-2">
                        <div className="fw-semibold">Round {i + 1} — {r.name} ({r.style})</div>
                        <div className="small">
                          {r.items.map((it, idx) => {
                            const ex = exercises.find((e) => e.id === it.exercise_id);
                            const label = ex ? ex.exercise_name : (it.exercise_id ? `ID: ${it.exercise_id}` : "(unmapped)");
                            return (
                              <div key={`kbi-${i}-${idx}`} className="d-flex align-items-center gap-2 mb-1">
                                <span>#{it.order} · {label}</span>
                                {!it.exercise_id && (
                                  <select
                                    className="form-select form-select-sm"
                                    style={{ width: "auto" }}
                                    value={it.exercise_id}
                                    onChange={(e) => updatePreviewItem(i, idx, e.target.value)}
                                  >
                                    <option value="">— Select exercise —</option>
                                    {exercises.map((e) => (
                                      <option key={e.id} value={e.id}>
                                        {e.exercise_name} {e.type ? `• ${e.type}` : ""}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                {it.reps ? <span className="text-dim"> • Reps: {it.reps}</span> : null}
                                {typeof it.time_s === "number" ? <span className="text-dim"> • {it.time_s}s</span> : null}
                              </div>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {unmapped.length > 0 && (
                    <div className="alert alert-warning mt-2">
                      {unmapped.length} item(s) need an exercise selected before saving.
                    </div>
                  )}
                </div>

                <details className="mt-3">
                  <summary className="small">Raw payload</summary>
                  <pre className="small mt-2" style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(preview, null, 2)}
                  </pre>
                </details>
              </section>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}
