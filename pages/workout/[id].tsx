
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

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function formatDateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function WorkoutPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();

  // Weekly endpoint (what you “used to use”)
  const { data, error, isLoading } = useSWR<{ weekStart: string; workouts: WorkoutDTO[] }>(
    "/api/workouts",
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60_000 }
  );

  const workout: WorkoutDTO | undefined = useMemo(() => {
    const ws = Array.isArray(data?.workouts) ? data!.workouts : [];
    return ws.find((w) => String(w.id) === String(id));
  }, [data, id]);

  // Hydrate exercise names for KB items (client-side map)
  const { data: exData } = useSWR<{ exercises: Array<{ id: string; exercise_name: string }> }>(
    "/api/exercises?limit=500",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000, shouldRetryOnError: false }
  );
  const exerciseNameById: Record<string, string> = useMemo(() => {
    const rows = exData?.exercises || [];
    return rows.reduce((acc, e) => { acc[e.id] = e.exercise_name || e.id; return acc; }, {} as Record<string, string>);
  }, [exData]);

  // Completion status (your existing route)
  const { data: completionData, mutate } = useSWR(
    session?.user?.email && id ? `/api/completions?email=${encodeURIComponent(session.user.email)}&workout_id=${encodeURIComponent(String(id))}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );
  const isCompleted = completionData?.completed === true;

  const [submitting, setSubmitting] = useState(false);

  // Derived stats
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

    // Legacy exercises fallback duration heuristic
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
  const subLabel = workout?.is_benchmark ? `Benchmark${workout?.benchmark_name ? `: ${workout.benchmark_name}` : ""}` : (workout?.focus || "");
  const videoUrl = workout?.video_url || undefined;

  async function handleComplete() {
    if (!session?.user?.email) {
      alert("Please sign in to log your workout.");
      return;
    }
    if (!id) {
      alert("Workout ID missing.");
      return;
    }

    // Simple calorie estimate
    const assumedWeightKg = 70;
    const avgMET = 8;
    const durationHours = (totalDurationSec || 1800) / 3600;
    const calories = Math.round(avgMET * assumedWeightKg * durationHours * 1.05);

    try {
      setSubmitting(true);
      const dateKey = formatDateKeyLocal(new Date());
      const res = await fetch("/api/completions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_email: session.user.email,
          dateKey,
          workout_id: String(id),
          duration: Math.round(totalDurationSec || 1800) / 60, // minutes
          calories_burned: calories,
        }),
      });

      if (res.ok) {
        alert(`Workout logged! Calories burned: ${calories}`);
        mutate();
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

  // Error/loading
  if (error) {
    return (
      <main className="container py-3" style={{ paddingBottom: "70px", background: "linear-gradient(135deg,#1a1a1a,#2c2c2c)", color: "#fff", borderRadius: 12, minHeight: "100vh" }}>
        <div className="futuristic-card">Failed to load workout</div>
      </main>
    );
  }
  if (isLoading || !workout) {
    return (
      <main className="container py-3" style={{ paddingBottom: "70px", background: "linear-gradient(135deg,#1a1a1a,#2c2c2c)", color: "#fff", borderRadius: 12, minHeight: "100vh" }}>
        <div className="futuristic-card d-flex align-items-center">
          <span>Loading…</span>
          <span className="inline-spinner" aria-hidden="true" />
        </div>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>{title} • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3" style={{ paddingBottom: "80px", background: "linear-gradient(135deg,#1a1a1a,#2c2c2c)", color: "#fff", borderRadius: 12, minHeight: "100vh" }}>
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h4 mb-0" style={{ fontWeight: 700 }}>{title}</h1>
            <small style={{ opacity: 0.75 }}>{subLabel}</small>
          </div>
          <Link href="/workouts" className="bxkr-btn" style={{ padding: "6px 12px", fontSize: "0.85rem" }}>
            ← Back
          </Link>
        </div>

        {/* Notes */}
        {workout.notes && <section className="futuristic-card mb-3">{workout.notes}</section>}

        {/* Video */}
        {videoUrl && videoUrl.startsWith("http") && (
          <section className="glass-card mb-3" style={{ overflow: "hidden" }}>
            <div className="ratio ratio-16x9">
              {videoUrl.includes("youtube") || videoUrl.includes("youtu.be") || videoUrl.includes("vimeo") ? (
                <iframe src={videoUrl} title="Workout video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              ) : (
                <video controls src={videoUrl} style={{ width: "100%" }} />
              )}
            </div>
          </section>
        )}

        {/* Round Timer */}
        <section className="glass-card p-3 mb-3">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="fw-semibold">Round Timer</div>
            <small style={{ opacity: 0.7 }}>
              Boxing: {Math.round((boxingDurationSec || 900) / 60)} mins • Est total: {Math.round((totalDurationSec || 1800) / 60)} mins
            </small>
          </div>
          <RoundTimer rounds={10} boxRounds={5} work={180} rest={60} />
        </section>

        {/* New schema path: rounds */}
        {hasRounds ? (
          <>
            {/* Boxing */}
            <section className="futuristic-card mb-3">
              <div className="fw-bold mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}>Boxing Rounds</div>
              {boxingRounds.length === 0 ? (
                <div className="text-muted">No boxing rounds</div>
              ) : (
                <div className="p-1">
                  {boxingRounds.map((round, idx) => (
                    <div key={round.round_id || `box-${idx}`} className="mb-2 p-2 glass-card" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div style={{ fontWeight: 600 }}>{round.name || `Boxing Round ${idx + 1}`}</div>
                        <small style={{ opacity: 0.7 }}>{(round.duration_s ?? 180) / 60} mins</small>
                      </div>
                      <div className="row gx-2 gy-2">
                        {(round.items || []).map((item, i) => {
                          const combo = item.combo;
                          return (
                            <div key={item.item_id || `box-item-${i}`} className="col-12 col-md-4">
                              <div className="p-2 glass-card" style={{ borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <div className="d-flex align-items-center justify-content-between mb-1">
                                  <div style={{ fontWeight: 600 }}>{combo?.name || `Combo ${i + 1}`}</div>
                                  <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: "0.75rem", background: "rgba(255,127,50,0.15)", border: "1px solid rgba(255,127,50,0.35)", color: "#FF8A2A" }}>
                                    Combo
                                  </span>
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {(combo?.actions || []).map((a, j) => {
                                    const isDef = a.kind === "defence";
                                    return (
                                      <span key={`${i}-${j}`} style={{
                                        display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, fontSize: "0.8rem",
                                        background: isDef ? "rgba(100,195,122,0.15)" : "rgba(255,138,42,0.15)",
                                        border: `1px solid ${isDef ? "rgba(100,195,122,0.35)" : "rgba(255,138,42,0.35)"}`,
                                        color: isDef ? "#64c37a" : "#FF8A2A"
                                      }}>
                                        <span style={{ fontWeight: 700 }}>{a.code}</span>
                                        {a.count ? <span style={{ opacity: 0.8 }}>×{a.count}</span> : null}
                                      </span>
                                    );
                                  })}
                                </div>
                                {combo?.notes ? <div style={{ marginTop: 6 }}><small style={{ opacity: 0.7 }}>{combo.notes}</small></div> : null}
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
              <div className="fw-bold mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}>Kettlebell Rounds</div>
              {kbRounds.length === 0 ? (
                <div className="text-muted">No kettlebell rounds</div>
              ) : (
                <div className="p-1">
                  {kbRounds.map((round, idx) => (
                    <div key={round.round_id || `kb-${idx}`} className="mb-2 p-2 glass-card" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div style={{ fontWeight: 600 }}>{round.name || `Kettlebells Round ${idx + 1}`}</div>
                        {round.style && (
                          <span style={{ padding: "6px 10px", borderRadius: 999, fontSize: "0.75rem", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}>
                            {round.style}
                          </span>
                        )}
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
                        ].filter(Boolean).join(" · ");
                        return (
                          <div key={it.item_id || `kb-item-${i}`} className="d-flex justify-content-between align-items-center p-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
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
            <div className="fw-bold mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}>Exercises</div>
            {Array.isArray(workout.exercises) && workout.exercises.length > 0 ? (
              workout.exercises.map((ex, i) => {
                const meta = [
                  ex.type || "",
                  ex.durationSec ? `${ex.durationSec}s` : "",
                  ex.reps ? `${ex.reps} reps` : "",
                  ex.restSec ? `rest ${ex.restSec}s` : "",
                  ex.met != null ? `MET ${ex.met}` : ""
                ].filter(Boolean).join(" · ");
                return (
                  <div key={i} className="d-flex justify-content-between align-items-center p-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{ex.name || "Exercise"}</div>
                      {!!meta && <small style={{ opacity: 0.7 }}>{meta}</small>}
                    </div>
                    {ex.video_url?.startsWith("http") && (
                      <a href={ex.video_url} target="_blank" rel="noreferrer" className="bxkr-btn" style={{ padding: "6px 12px", fontSize: "0.85rem" }}>
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
          <button className="bxkr-btn w-100" onClick={handleComplete} disabled={isCompleted || submitting}>
            {isCompleted ? "✓ Completed" : submitting ? "Saving..." : "Mark Complete"}
          </button>
          <div className="mt-3 text-center">
            <Link href="/train" className="bxkr-bottomnav-link">
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
