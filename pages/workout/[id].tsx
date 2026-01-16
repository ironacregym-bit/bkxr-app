
// pages/workout/[id].tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";
import RoundTimer from "../../components/RoundTimer";

/* ---------------- Types (kept compatible with your code) ---------------- */
type Exercise = {
  type?: string;
  name?: string;
  video_url?: string;
  met?: number;
  MET?: number;
  order?: number;
  durationSec?: number;
  restSec?: number;
  reps?: number | string;
  style?: string;
};

type BoxingAction = {
  kind: "punch" | "defence";
  code: string;
  count?: number;
  tempo?: string;
  notes?: string;
};

type ExerciseItemOut = {
  item_id: string;
  type: "Boxing" | "Kettlebell";
  style?: "EMOM" | "AMRAP" | "LADDER" | "Combo";
  order: number;
  // Boxing
  duration_s?: number;
  combo?: {
    name?: string;
    actions: BoxingAction[];
    notes?: string;
  };
  // KB
  exercise_id?: string;
  reps?: string;
  time_s?: number;
  weight_kg?: number;
  tempo?: string;
  rest_s?: number;
};

type RoundOut = {
  round_id: string;
  name: string;
  order: number;
  category: "Boxing" | "Kettlebell";
  style?: "EMOM" | "AMRAP" | "LADDER";
  duration_s?: number;
  is_benchmark_component?: boolean;
  items: ExerciseItemOut[];
};

type WorkoutDTO = {
  id: string;
  workout_name: string;
  video_url?: string;
  notes?: string;
  focus?: string;
  is_benchmark?: boolean;
  benchmark_name?: string;
  // Either legacy exercises OR new rounds
  exercises?: Exercise[];
  rounds?: RoundOut[];
};

/* ---------------- Fetch helpers ---------------- */
const fetcher = (u: string) => fetch(u).then((r) => r.json());

function formatDateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ---------------- UX helpers: protocol micro‑docs ---------------- */
const PROTOCOL_INFO: Record<
  "EMOM" | "AMRAP" | "LADDER",
  { title: string; bullets: string[] }
> = {
  EMOM: {
    title: "EMOM — Every Minute On the Minute",
    bullets: [
      "When the minute starts, perform the prescribed work.",
      "Rest in the remaining time of that minute.",
      "Repeat for the full round duration (e.g., 3 minutes ⇒ 3 repeats).",
    ],
  },
  AMRAP: {
    title: "AMRAP — As Many Rounds/Reps As Possible",
    bullets: [
      "Work continuously for the round duration.",
      "Cycle through the listed movements in order.",
      "Keep quality high; pace so you can maintain form.",
    ],
  },
  LADDER: {
    title: "LADDER — Ascending Reps",
    bullets: [
      "Alternate movements while increasing reps (e.g., 2 → 4 → 6…).",
      "Reset to the lowest rep once you reach the top and continue.",
      "Stay smooth; don’t rush the early rungs.",
    ],
  },
};

const BOXING_ROUND_INFO = {
  title: "Boxing Round Format",
  bullets: [
    "3 minutes per round; cycle the listed 3 combos throughout.",
    "Keep hands up; return to guard after each combo.",
    "Breathe on punches; relax shoulders; move your feet.",
  ],
};

/* Optional pretty labels for action codes (UI only) */
const PRETTY: Record<string, string> = {
  jab: "Jab",
  cross: "Cross",
  lead_hook: "Lead Hook",
  rear_hook: "Rear Hook",
  lead_uppercut: "Lead Uppercut",
  rear_uppercut: "Rear Uppercut",
  duck: "Duck",
};

export default function WorkoutPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();

  // Weekly endpoint (unchanged)
  const { data, error, isLoading } = useSWR<{ weekStart: string; workouts: WorkoutDTO[] }>(
    "/api/workouts",
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60_000 }
  );

  // Boxing technique videos (optional; safe if missing)
  const { data: techData } = useSWR<{ videos: Array<{ code: string; name?: string; video_url?: string }> }>(
    "/api/boxing/tech",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 120_000, shouldRetryOnError: false }
  );

  const techVideoByCode: Record<string, string | undefined> = useMemo(() => {
    const arr = techData?.videos || [];
    const map: Record<string, string> = {};
    for (const v of arr) if (v?.code && v?.video_url) map[v.code] = v.video_url;
    return map;
  }, [techData]);

  // Choose workout
  const workout: WorkoutDTO | undefined = useMemo(() => {
    const ws = Array.isArray(data?.workouts) ? data!.workouts : [];
    return ws.find((w) => String(w.id) === String(id));
  }, [data, id]);

  // Hydrate exercise names for KB items
  const { data: exData } = useSWR<{ exercises: Array<{ id: string; exercise_name: string }> }>(
    "/api/exercises?limit=500",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000, shouldRetryOnError: false }
  );
  const exerciseNameById: Record<string, string> = useMemo(() => {
    const rows = exData?.exercises || [];
    return rows.reduce((acc, e) => {
      acc[e.id] = e.exercise_name || e.id;
      return acc;
    }, {} as Record<string, string>);
  }, [exData]);

  // Completion status
  const { data: completionData, mutate } = useSWR(
    session?.user?.email && id
      ? `/api/completions?email=${encodeURIComponent(session.user.email)}&workout_id=${encodeURIComponent(
          String(id)
        )}`
      : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );
  const isCompleted = completionData?.completed === true;

  const [submitting, setSubmitting] = useState(false);

  // Derived stats + sections
  const { hasRounds, boxingRounds, kbRounds, totalDurationSec, boxingDurationSec } = useMemo(() => {
    const rounds = workout?.rounds || [];
    const boxing = rounds.filter((r) => r.category === "Boxing");
    const kb = rounds.filter((r) => r.category === "Kettlebell");
    const boxingDur = boxing.reduce((sum, r) => sum + (r.duration_s ?? 180), 0);
    const kbDur = kb.reduce((sumRounds, r) => {
      const itemDur = (r.items || []).reduce((sumItems, it) => {
        const t = typeof it.time_s === "number" ? it.time_s : 60;
        return sumItems + t;
      }, 0);
      return sumRounds + itemDur;
    }, 0);

    const legacyDur =
      (workout?.exercises || []).reduce((sum, ex) => sum + (ex.durationSec || 0), 0) || 1800;

    const has = (workout?.rounds || []).length > 0;
    return {
      hasRounds: has,
      boxingRounds: boxing,
      kbRounds: kb,
      totalDurationSec: has ? boxingDur + kbDur : legacyDur,
      boxingDurationSec: has ? boxingDur : 900,
    };
  }, [workout]);

  const title = workout?.workout_name || "Workout";
  const subLabel = workout?.is_benchmark
    ? `Benchmark${workout?.benchmark_name ? `: ${workout.benchmark_name}` : ""}`
    : workout?.focus || "";
  const videoUrl = workout?.video_url || undefined;

  /* ---------------- NEW: Completion modal state ---------------- */
  const [showComplete, setShowComplete] = useState(false);
  const [rpe, setRpe] = useState<number>(7);
  const [durationMins, setDurationMins] = useState<number>(() =>
    Math.round((totalDurationSec || 1800) / 60)
  );
  const [kbWeightUsed, setKbWeightUsed] = useState<number | "">("");
  const [notes, setNotes] = useState<string>("");

  useMemo(() => {
    setDurationMins(Math.round((totalDurationSec || 1800) / 60));
  }, [totalDurationSec]);

  async function handleCompleteClick() {
    if (!session?.user?.email) {
      alert("Please sign in to log your workout.");
      return;
    }
    setShowComplete(true);
  }

  async function submitCompletion() {
    if (!session?.user?.email || !id) return;

    const minutes =
      Number(durationMins) > 0 ? Number(durationMins) : Math.round((totalDurationSec || 1800) / 60);

    // Simple calories estimate (keep your formula)
    const assumedWeightKg = 70;
    const avgMET = 8;
    const calories = Math.round(avgMET * assumedWeightKg * (minutes / 60) * 1.05);

    try {
      setSubmitting(true);
      const dateKey = formatDateKeyLocal(new Date());

      const payload = {
        user_email: session.user.email,
        workout_id: String(id),

        // New fields
        activity_type: "Strength training",
        calories_burned: calories,
        duration_minutes: minutes,
        weight_completed_with: kbWeightUsed === "" ? null : Number(kbWeightUsed),
        rpe: Number(rpe),
        notes: notes?.trim() || null,

        // legacy support (if your API still uses/accepts this)
        duration: minutes,
        dateKey, // harmless; ignore in API if unused
      };

      const res = await fetch("/api/completions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert(`Workout logged! Calories burned: ${calories}`);
        setShowComplete(false);
        setKbWeightUsed("");
        setNotes("");
        setRpe(7);
        mutate(); // refresh completion badge
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j?.error || "Failed to log workout.");
      }
    } catch (e) {
      console.error(e);
      alert("Error logging workout.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- Error/loading (hooks already called) ---------------- */
  if (error) {
    return (
      <main
        className="container py-3"
        style={{
          paddingBottom: "70px",
          background: "linear-gradient(135deg,#1a1a1a,#2c2c2c)",
          color: "#fff",
          borderRadius: 12,
          minHeight: "100vh",
        }}
      >
        <div className="futuristic-card">Failed to load workout</div>
      </main>
    );
  }
  if (isLoading || !workout) {
    return (
      <main
        className="container py-3"
        style={{
          paddingBottom: "70px",
          background: "linear-gradient(135deg,#1a1a1a,#2c2c2c)",
          color: "#fff",
          borderRadius: 12,
          minHeight: "100vh",
        }}
      >
        <div className="futuristic-card d-flex align-items-center">
          <span>Loading…</span>
          <span className="inline-spinner" aria-hidden="true" />
        </div>
      </main>
    );
  }

  /* ------------- Inline UI helpers (no hooks inside) ------------- */
  function ProtocolBadge({ style }: { style?: "EMOM" | "AMRAP" | "LADDER" }) {
    if (!style) return null;
    const s = style.toUpperCase() as "EMOM" | "AMRAP" | "LADDER";
    return (
      <details style={{ marginLeft: 8 }}>
        <summary
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 10px",
            borderRadius: 999,
            fontSize: "0.75rem",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            cursor: "pointer",
            listStyle: "none",
          }}
        >
          {s}
        </summary>
        <div style={{ marginTop: 8, padding: "8px 10px", borderLeft: "2px solid rgba(255,255,255,0.15)" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{PROTOCOL_INFO[s].title}</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {PROTOCOL_INFO[s].bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      </details>
    );
  }

  function BoxingHowTo() {
    return (
      <details>
        <summary
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 10px",
            borderRadius: 999,
            fontSize: "0.75rem",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            cursor: "pointer",
            listStyle: "none",
          }}
        >
          How this round works
        </summary>
        <div style={{ marginTop: 8, padding: "8px 10px", borderLeft: "2px solid rgba(255,255,255,0.15)" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{BOXING_ROUND_INFO.title}</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {BOXING_ROUND_INFO.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      </details>
    );
  }

  function BoxingTechniqueChips({ actions }: { actions: BoxingAction[] }) {
    const codes = Array.from(new Set(actions.map((a) => a.code)));
    if (codes.length === 0) return null;
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {codes.map((code) => {
          const label = PRETTY[code] || code;
          const href = techVideoByCode[code]; // undefined → placeholder chip
          return href ? (
            <a
              key={code}
              href={href}
              target="_blank"
              rel="noreferrer"
              title={`Technique: ${label}`}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: "0.75rem",
                background: "rgba(100,195,122,0.15)",
                border: "1px solid rgba(100,195,122,0.35)",
                color: "#64c37a",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {label} • video
            </a>
          ) : (
            <span
              key={code}
              title={`Technique (add later): ${label}`}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: "0.75rem",
                background: "rgba(255,255,255,0.06)",
                border: "1px dashed rgba(255,255,255,0.25)",
                color: "rgba(255,255,255,0.85)",
                whiteSpace: "nowrap",
              }}
            >
              {label} • add video
            </span>
          );
        })}
      </div>
    );
  }

  /* ----------------------------- Render ----------------------------- */
  return (
    <>
      <Head>
        <title>{title} • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main
        className="container py-3"
        style={{
          paddingBottom: "80px",
          background: "linear-gradient(135deg,#1a1a1a,#2c2c2c)",
          color: "#fff",
          borderRadius: 12,
          minHeight: "100vh",
        }}
      >
        {/* Header: title clamp, Back never wraps */}
        <div className="d-flex align-items-center justify-content-between mb-3" style={{ gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1
              className="mb-0"
              style={{
                fontWeight: 700,
                fontSize: "clamp(1.05rem, 2.6vw, 1.35rem)",
                lineHeight: 1.15,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "min(78vw, 640px)",
              }}
              title={title}
            >
              {title}
            </h1>
            <small style={{ opacity: 0.75 }}>{subLabel}</small>
          </div>
          <Link
            href="/workouts"
            className="bxkr-btn"
            style={{ padding: "6px 12px", fontSize: "0.85rem", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            ← Back
          </Link>
        </div>

        {/* Notes as expandable bullets */}
        {workout.notes && (
          <section className="futuristic-card mb-3">
            <details open>
              <summary
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: "0.8rem",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                  listStyle: "none",
                  marginBottom: 8,
                }}
              >
                Session Notes
              </summary>
              <div style={{ paddingLeft: 4 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {String(workout.notes)
                    .split(/\n+/)
                    .map((ln, i) => (
                      <li key={i}>{ln.trim()}</li>
                    ))}
                </ul>
              </div>
            </details>
          </section>
        )}

        {/* Video */}
        {videoUrl && videoUrl.startsWith("http") && (
          <section className="glass-card mb-3" style={{ overflow: "hidden" }}>
            <div className="ratio ratio-16x9">
              {videoUrl.includes("youtube") || videoUrl.includes("youtu.be") || videoUrl.includes("vimeo") ? (
                <iframe
                  src={videoUrl}
                  title="Workout video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video controls src={videoUrl} style={{ width: "100%" }} />
              )}
            </div>
          </section>
        )}

        {/* Round Timer */}
        <section className="glass-card p-3 mb-3">
          <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
            <div className="fw-semibold">Round Timer</div>
            <small style={{ opacity: 0.7 }}>
              Boxing: {Math.round((boxingDurationSec || 900) / 60)} mins • Est total:{" "}
              {Math.round((totalDurationSec || 1800) / 60)} mins
            </small>
          </div>
          <RoundTimer rounds={10} boxRounds={5} work={180} rest={60} />
        </section>

        {/* New schema path: rounds */}
        {hasRounds ? (
          <>
            {/* Boxing */}
            <section className="futuristic-card mb-3">
              <div
                className="fw-bold mb-2 d-flex align-items-center justify-content-between"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}
              >
                <span>Boxing Rounds</span>
                <BoxingHowTo />
              </div>

              {boxingRounds.length === 0 ? (
                <div className="text-muted">No boxing rounds</div>
              ) : (
                <div className="p-1">
                  {boxingRounds.map((round, idx) => (
                    <div
                      key={round.round_id || `box-${idx}`}
                      className="mb-2 p-2 glass-card"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-2" style={{ gap: 8 }}>
                        <div style={{ fontWeight: 600 }}>{round.name || `Boxing Round ${idx + 1}`}</div>
                        <small style={{ opacity: 0.7 }}>{(round.duration_s ?? 180) / 60} mins</small>
                      </div>

                      <div className="row gx-2 gy-2">
                        {(round.items || []).map((item, i) => {
                          const combo = item.combo;
                          const actions = combo?.actions || [];
                          return (
                            <div key={item.item_id || `box-item-${i}`} className="col-12 col-md-4">
                              <div
                                className="p-2 glass-card"
                                style={{
                                  borderRadius: 12,
                                  background: "rgba(255,255,255,0.03)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                }}
                              >
                                <div className="d-flex align-items-center justify-content-between mb-1" style={{ gap: 8 }}>
                                  <div style={{ fontWeight: 600 }}>{combo?.name || `Combo ${i + 1}`}</div>
                                  <span
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: 999,
                                      fontSize: "0.75rem",
                                      background: "rgba(255,127,50,0.15)",
                                      border: "1px solid rgba(255,127,50,0.35)",
                                      color: "#FF8A2A",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    Combo
                                  </span>
                                </div>

                                {/* Action chips */}
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {actions.map((a, j) => {
                                    const isDef = a.kind === "defence";
                                    const label = PRETTY[a.code] || a.code;
                                    return (
                                      <span
                                        key={`${i}-${j}`}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 6,
                                          padding: "6px 10px",
                                          borderRadius: 999,
                                          fontSize: "0.8rem",
                                          background: isDef
                                            ? "rgba(100,195,122,0.15)"
                                            : "rgba(255,138,42,0.15)",
                                          border: `1px solid ${
                                            isDef ? "rgba(100,195,122,0.35)" : "rgba(255,138,42,0.35)"
                                          }`,
                                          color: isDef ? "#64c37a" : "#FF8A2A",
                                        }}
                                      >
                                        <span style={{ fontWeight: 700 }}>{label}</span>
                                        {a.count ? <span style={{ opacity: 0.8 }}>×{a.count}</span> : null}
                                      </span>
                                    );
                                  })}
                                </div>

                                {/* Technique video placeholders / links */}
                                <BoxingTechniqueChips actions={actions} />

                                {combo?.notes ? (
                                  <div style={{ marginTop: 6 }}>
                                    <small style={{ opacity: 0.7 }}>{combo.notes}</small>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Kettlebells */}
            <section className="futuristic-card mb-3">
              <div
                className="fw-bold mb-2"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}
              >
                Kettlebell Rounds
              </div>

              {kbRounds.length === 0 ? (
                <div className="text-muted">No kettlebell rounds</div>
              ) : (
                <div className="p-1">
                  {kbRounds.map((round, idx) => (
                    <div
                      key={round.round_id || `kb-${idx}`}
                      className="mb-2 p-2 glass-card"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-2" style={{ gap: 8 }}>
                        <div style={{ fontWeight: 600, display: "flex", alignItems: "center" }}>
                          {round.name || `Kettlebells Round ${idx + 1}`}
                          {/* Clickable protocol explainer */}
                          {round.style ? <ProtocolBadge style={round.style as any} /> : null}
                        </div>
                        {round.style ? (
                          <span
                            style={{
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontSize: "0.75rem",
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.15)",
                              whiteSpace: "nowrap",
                            }}
                            title={round.style}
                          >
                            {round.style}
                          </span>
                        ) : null}
                      </div>

                      {(round.items || []).map((it, i) => {
                        const displayName =
                          (it.exercise_id && exerciseNameById[it.exercise_id]) ||
                          it.exercise_id ||
                          `Item ${i + 1}`;
                        const bits = [
                          it.reps ? `${it.reps} reps` : "",
                          typeof it.time_s === "number" ? `${it.time_s}s` : "",
                          typeof it.weight_kg === "number" ? `${it.weight_kg}kg` : "",
                          it.tempo ? `${it.tempo}` : "",
                          typeof it.rest_s === "number" ? `rest ${it.rest_s}s` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ");

                        return (
                          <div
                            key={it.item_id || `kb-item-${i}`}
                            className="d-flex justify-content-between align-items-center p-2"
                            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                          >
                            <div>
                              <div style={{ fontWeight: 600 }}>{displayName}</div>
                              {!!bits && <small style={{ opacity: 0.7 }}>{bits}</small>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          // Legacy fallback: exercises[]
          <section className="futuristic-card mb-3">
            <div
              className="fw-bold mb-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}
            >
              Exercises
            </div>
            {Array.isArray(workout.exercises) && workout.exercises.length > 0 ? (
              workout.exercises.map((ex, i) => {
                const meta = [
                  ex.type || "",
                  ex.durationSec ? `${ex.durationSec}s` : "",
                  ex.reps ? `${ex.reps} reps` : "",
                  ex.restSec ? `rest ${ex.restSec}s` : "",
                  ex.met != null ? `MET ${ex.met}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div
                    key={i}
                    className="d-flex justify-content-between align-items-center p-2"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{ex.name || "Exercise"}</div>
                      {!!meta && <small style={{ opacity: 0.7 }}>{meta}</small>}
                    </div>
                    {ex.video_url?.startsWith("http") && (
                      <a
                        href={ex.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="bxkr-btn"
                        style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                      >
                        Video
                      </a>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-muted">No exercises linked</div>
            )}
          </section>
        )}

        {/* Actions */}
        <section className="mt-3">
          <button
            className="bxkr-btn w-100"
            onClick={handleCompleteClick}
            disabled={isCompleted || submitting}
          >
            {isCompleted ? "✓ Completed" : submitting ? "Saving..." : "Mark Complete"}
          </button>

          {/* Completion modal */}
          {showComplete && (
            <div
              role="dialog"
              aria-modal="true"
              className="position-fixed top-0 start-0 w-100 h-100"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 1050 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowComplete(false);
              }}
            >
              <div
                className="glass-card"
                style={{
                  maxWidth: 520,
                  margin: "10vh auto",
                  background: "rgba(30,30,30,0.9)",
                  borderRadius: 16,
                  padding: 16,
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="fw-semibold">Log completion</div>
                  <button
                    className="btn btn-sm btn-outline-light"
                    onClick={() => setShowComplete(false)}
                  >
                    Close
                  </button>
                </div>

                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label">RPE (1–10)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="form-control"
                      value={rpe}
                      onChange={(e) =>
                        setRpe(Math.max(1, Math.min(10, Number(e.target.value || 7))))
                      }
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Duration (mins)</label>
                    <input
                      type="number"
                      min={1}
                      className="form-control"
                      value={durationMins}
                      onChange={(e) => setDurationMins(Math.max(1, Number(e.target.value || 0)))}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">KB weight used (kg)</label>
                    <input
                      type="number"
                      min={0}
                      className="form-control"
                      placeholder="e.g., 16"
                      value={kbWeightUsed}
                      onChange={(e) => {
                        const v = e.target.value;
                        setKbWeightUsed(v === "" ? "" : Math.max(0, Number(v)));
                      }}
                    />
                    <small className="text-muted">If mixed bells, enter most-used or average.</small>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Notes (optional)</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any comments from today’s session…"
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-3">
                  <button className="btn btn-outline-light" onClick={() => setShowComplete(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={submitCompletion} disabled={submitting}>
                    {submitting ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 text-center">
            <Link href="/workout" className="bxkr-bottomnav-link">
              <i className="fa-solid fa-dumbbell nav-icon" aria-hidden="true" />
              <span>Back to Train</span>
            </Link>
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
