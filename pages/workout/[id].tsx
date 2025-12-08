
"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useState } from "react";
import BottomNav from "../../components/BottomNav";
import RoundTimer from "../../components/RoundTimer";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function WorkoutPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();

  // Load workouts catalogue
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
  });

  if (error) {
    return (
      <main className="container py-3" style={{ minHeight: "100vh" }}>
        <div className="alert alert-danger">Failed to load workout</div>
      </main>
    );
  }
  if (isLoading || !data) {
    return (
      <main className="container py-3" style={{ minHeight: "100vh" }}>
        <div className="alert alert-secondary">Loading…</div>
      </main>
    );
  }

  // Find the requested workout
  const workout = (data.workouts || []).find((w: any) => String(w.id) === String(id));
  if (!workout) {
    return (
      <main className="container py-3" style={{ minHeight: "100vh" }}>
        <div className="alert alert-warning">No workout found</div>
        <button
          type="button"
          onClick={() => router.back()}
          className="bxkr-btn mt-2"
          style={{ padding: "8px 14px", fontSize: "0.9rem" }}
        >
          ← Back
        </button>
      </main>
    );
  }

  // Normalised fields (support both shapes you’ve used elsewhere)
  const title: string = workout.title || workout.workout_name || "Workout";
  const dayLabel: string = workout.day || workout.day_name || "";
  const videoUrl: string | undefined =
    (typeof workout.video === "string" && workout.video) ||
    (typeof workout.video_url === "string" && workout.video_url) ||
    undefined;

  // Completion status for this workout
  const { data: completionData, mutate } = useSWR(
    session?.user?.email
      ? `/api/completions?email=${encodeURIComponent(session.user.email)}&workout_id=${encodeURIComponent(
          String(id || "")
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

  const handleComplete = async () => {
    if (!session?.user?.email) {
      alert("Please sign in to log your workout.");
      return;
    }

    // Calorie estimate (as per your earlier approach, kept intact)
    const userWeight = workout.userWeight || 70;
    const exs: any[] = Array.isArray(workout.exercises) ? workout.exercises : [];
    const avgMET =
      exs.length > 0
        ? exs.reduce((sum, ex) => sum + (ex.met ?? ex.MET ?? 8), 0) / exs.length
        : 8;
    const durationHours = ((workout.totalDurationSec as number) || 1800) / 3600;
    const calories = Math.round(avgMET * userWeight * durationHours * 1.05);

    try {
      setSubmitting(true);
      const res = await fetch("/api/completions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workout_id: workout.id,
          user_email: session.user.email,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          calories_burned: calories,
          notes: "Completed via app",
        }),
      });

      if (res.ok) {
        alert(`Workout logged! Calories burned: ${calories}`);
        mutate(); // refresh completion status
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j?.error || "Failed to log workout.");
      }
    } catch {
      alert("Error logging workout.");
    } finally {
      setSubmitting(false);
    }
  };

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
          background: "linear-gradient(135deg,#101317,#1f1a14)",
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
            {!!dayLabel && <small style={{ opacity: 0.7 }}>{dayLabel}</small>}
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
          {/* Kept as 10 rounds with 5 boxing as per BXKR format */}
          <RoundTimer rounds={10} boxRounds={5} work={180} rest={60} />
        </div>

        {/* Exercises */}
        <div className="glass-card mb-3">
          <div className="p-3 fw-bold" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
            Exercises
          </div>
          <div>
            {Array.isArray(workout.exercises) && workout.exercises.length > 0 ? (
              workout.exercises.map((ex: any, i: number) => {
                const exName = ex.name || ex.exercise_name || "Exercise";
                const exType = ex.type ? String(ex.type) : "";
                const exDur = ex.durationSec ? `${ex.durationSec}s` : "";
                const exReps = ex.reps ? `${ex.reps} reps` : "";
                const exRest = ex.restSec ? `rest ${ex.restSec}s` : "";
                const exMet = ex.met ?? ex.MET;
                const exVideo: string | undefined =
                  (typeof ex.video === "string" && ex.video) ||
                  (typeof ex.video_url === "string" && ex.video_url) ||
                  undefined;

                const metaBits = [exType, exDur, exReps, exRest, exMet != null ? `MET ${exMet}` : ""]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <div
                    key={i}
                    className="d-flex justify-content-between align-items-center p-3"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{exName}</div>
                      {!!metaBits && <small style={{ opacity: 0.7 }}>{metaBits}</small>}
                    </div>
                    {exVideo && exVideo.startsWith("http") && (
                      <a
                        href={exVideo}
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
              <div className="p-3 text-muted">No exercises linked</div>
            )}
          </div>
        </div>

        {/* Complete Button */}
        <div className="mt-3">
          <button
            className="bxkr-btn w-100"
            onClick={handleComplete}
            disabled={isCompleted || submitting}
          >
            {isCompleted ? "✓ Completed" : submitting ? "Saving..." : "Mark Complete"}
          </button>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
