
"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";
import RoundTimer from "../../components/RoundTimer";
import type { WorkoutTemplateDTO, RoundOut, ExerciseItemOut } from "../../types/workouts";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function formatDateKeyLocal(d: Date): string {
  // Local date → YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function WorkoutPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();

  const workoutId = useMemo(() => (id ? String(id) : ""), [id]);

  // Fetch ONE workout template (hydrated rounds/items)
  const { data, error, isLoading } = useSWR<WorkoutTemplateDTO | { error: string }>(
    workoutId ? `/api/workouts/get?workout_id=${encodeURIComponent(workoutId)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000,
    }
  );

  const workout: WorkoutTemplateDTO | null =
    data && (data as any).workout_id ? (data as WorkoutTemplateDTO) : null;

  // Completion status (kept compatible with your previous route)
  const { data: completionData, mutate } = useSWR(
    session?.user?.email && workoutId
      ? `/api/completions?email=${encodeURIComponent(session.user.email)}&workout_id=${encodeURIComponent(
          workoutId
        )}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30_000,
    }
  );
  const isCompleted = completionData?.completed === true;

  const [submitting, setSubmitting] = useState(false);

  // Derived stats for display & logging
  const { boxingRounds, kbRounds, totalDurationSec, boxingDurationSec } = useMemo(() => {
    const rounds = workout?.rounds || [];
    const boxing = rounds.filter((r) => r.category === "Boxing");
    const kb = rounds.filter((r) => r.category === "Kettlebell");
    // Boxing duration: 5 rounds × 180s = 900s (explicitly stored as r.duration_s)
    const boxingDur = boxing.reduce((sum, r) => sum + (r.duration_s ?? 180), 0);
    // Kettlebell: if items provide time_s, sum them; otherwise assume 60s per item as a fallback
    const kbDur = kb.reduce((sumRounds, r) => {
      const itemDur = (r.items || []).reduce((sumItems, it) => {
        const t = typeof it.time_s === "number" ? it.time_s : 60; // heuristic fallback
        return sumItems + t;
      }, 0);
      return sumRounds + itemDur;
    }, 0);
    return {
      boxingRounds: boxing,
      kbRounds: kb,
      totalDurationSec: boxingDur + kbDur,
      boxingDurationSec: boxingDur,
    };
  }, [workout]);

  const title: string = workout?.workout_name || "Workout";
  const videoUrl: string | undefined = workout?.video_url || undefined;

  async function handleComplete() {
    if (!session?.user?.email) {
      alert("Please sign in to log your workout.");
      return;
    }
    if (!workoutId) {
      alert("Workout ID missing.");
      return;
    }

    // Simple calorie estimate:
    // If no METs are available, approximate calories at 8 METs (moderate/vigorous), scaled by 70kg and duration.
    const assumedWeightKg = 70;
    const avgMET = 8; // heuristic
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
          workout_id: workoutId,
          duration: Math.round(totalDurationSec || 1800) / 60, // minutes (for your weekly stats)
          calories_burned: calories,
          rating: null,
          // Optional: round_logs if you want later
          // round_logs: [
          //   ...boxingRounds.map(r => ({ round_id: r.round_id, rounds_completed: 1 })),
          // ]
        }),
      });

      if (res.ok) {
        alert(`Workout logged! Calories burned: ${calories}`);
        mutate(); // refresh completion status
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

  if (error) {
    return (
      <main className="container py-3" style={{ minHeight: "100vh" }}>
        <div className="alert alert-danger">Failed to load workout</div>
      </main>
    );
  }
  if (isLoading || !workout) {
    return (
      <main className="container py-3" style={{ minHeight: "100vh" }}>
        <div className="alert alert-secondary">Loading…</div>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>{title} • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main
        className="container py-3"
        style={{
          paddingBottom: "70px",
          background: "linear-gradient(135deg,#0E0F12,#151923)",
          color: "#fff",
          borderRadius: 12,
          minHeight: "100vh",
        }}
      >
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h4 mb-0" style={{ fontWeight: 700 }}>
              {title}
            </h1>
            {workout.is_benchmark ? (
              <small style={{ opacity: 0.8, color: "#7CF67B" }}>
                Benchmark{workout.benchmark_name ? `: ${workout.benchmark_name}` : ""}
              </small>
            ) : (
              <small style={{ opacity: 0.7 }}>{workout.focus || ""}</small>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="bxkr-btn"
            style={{ padding: "6px 12px", fontSize: "0.85rem" }}
            aria-label="Go back"
            title="Back"
          >
            ← Back
          </button>
        </div>

        {/* Notes */}
        {workout.notes && (
          <div className="glass-card p-3 mb-3" style={{ color: "#fff" }}>
            {workout.notes}
          </div>
        )}

        {/* Video */}
        {videoUrl && videoUrl.startsWith("http") && (
          <div className="ratio ratio-16x9 mb-3 glass-card" style={{ overflow: "hidden" }}>
            {videoUrl.includes("youtube") ||
            videoUrl.includes("youtu.be") ||
            videoUrl.includes("vimeo") ? (
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
        )}

        {/* Round Timer */}
        <div className="glass-card p-3 mb-3">
          {/* 10 rounds total: 5 boxing + 5 kettlebell */}
          <RoundTimer rounds={10} boxRounds={5} work={180} rest={60} />
          <small style={{ opacity: 0.7 }}>
            Boxing: {Math.round(boxingDurationSec / 60)} mins • Total est: {Math.round((totalDurationSec || 0) / 60)} mins
          </small>
        </div>

        {/* Boxing (5 rounds, each with 3 combos) */}
        <section className="glass-card mb-3">
          <div className="p-3 fw-bold" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
            Boxing Rounds
          </div>
          {boxingRounds.length === 0 ? (
            <div className="p-3 text-muted">No boxing rounds</div>
          ) : (
            <div className="p-2">
              {boxingRounds.map((round: RoundOut, idx: number) => (
                <div
                  key={round.round_id || idx}
                  className="p-3 mb-2"
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div style={{ fontWeight: 600 }}>{round.name || `Boxing Round ${idx + 1}`}</div>
                    <small style={{ opacity: 0.7 }}>{(round.duration_s ?? 180) / 60} mins</small>
                  </div>

                  {/* Exactly three combo items */}
                  <div className="row gx-2 gy-2">
                    {(round.items || []).map((item: ExerciseItemOut, i: number) => {
                      const combo = item.combo;
                      return (
                        <div key={item.item_id || i} className="col-12 col-md-4">
                          <div
                            className="p-2"
                            style={{
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 10,
                              background: "rgba(255,255,255,0.03)",
                            }}
                          >
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                              {combo?.name || `Combo ${i + 1}`}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {(combo?.actions || []).map((a, j) => {
                                const isDef = a.kind === "defence";
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
                                      background: isDef ? "rgba(124,246,123,0.15)" : "rgba(255,138,42,0.15)",
                                      border: `1px solid ${isDef ? "rgba(124,246,123,0.35)" : "rgba(255,138,42,0.35)"}`,
                                      color: isDef ? "#7CF67B" : "#FF8A2A",
                                    }}
                                  >
                                    <span style={{ fontWeight: 700 }}>{a.code}</span>
                                    {a.count ? <span style={{ opacity: 0.8 }}>×{a.count}</span> : null}
                                  </span>
                                );
                              })}
                            </div>
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

        {/* Kettlebells (5 rounds) */}
        <section className="glass-card mb-3">
          <div className="p-3 fw-bold" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
            Kettlebell Rounds
          </div>
          {kbRounds.length === 0 ? (
            <div className="p-3 text-muted">No kettlebell rounds</div>
          ) : (
            <div className="p-2">
              {kbRounds.map((round: RoundOut, idx: number) => (
                <div
                  key={round.round_id || idx}
                  className="p-3 mb-2"
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div style={{ fontWeight: 600 }}>{round.name || `Kettlebells Round ${idx + 1}`}</div>
                    <small style={{ opacity: 0.7 }}>{round.style}</small>
                  </div>

                  <div>
                    {(round.items || []).map((it: ExerciseItemOut, i: number) => {
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
                          key={it.item_id || i}
                          className="d-flex justify-content-between align-items-center p-2"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {it.exercise_id || `Item ${i + 1}`}
                            </div>
                            {!!bits && <small style={{ opacity: 0.7 }}>{bits}</small>}
                          </div>
                          {!!round.style && (
                            <span
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                fontSize: "0.75rem",
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.15)",
                              }}
                            >
                              {round.style}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Complete Button */}
        <div className="mt-3">
          <button className="bxkr-btn w-100" onClick={handleComplete} disabled={isCompleted || submitting}>
            {isCompleted ? "✓ Completed" : submitting ? "Saving..." : "Mark Complete"}
          </button>
        </div>

        {/* Footer link (optional) */}
        <div className="mt-3 text-center">
          <Link href="/train" className="text-decoration-none" style={{ color: "#FF8A2A" }}>
            Back to Train
          </Link>
        </div>
      </main>

      <BottomNav />
    </>
  );
}

