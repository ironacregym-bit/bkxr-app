
"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import BottomNav from "../../components/BottomNav";
import RoundTimer from "../../components/RoundTimer";

import WorkoutViewToggle from "../../components/workouts/WorkoutViewToggle";
import ListViewer from "../../components/workouts/ListViewer";
import FollowAlongViewer from "../../components/workouts/FollowAlongViewer";
import useExerciseMediaMap from "../../hooks/useExerciseMediaMap";

type KBStyle = "EMOM" | "AMRAP" | "LADDER";
type BoxingAction = { kind: "punch" | "defence"; code: string; count?: number; tempo?: string; notes?: string };

type ExerciseItemOut = {
  item_id: string;
  type: "Boxing" | "Kettlebell";
  style?: KBStyle | "Combo";
  order: number;
  duration_s?: number;
  combo?: { name?: string; actions: BoxingAction[]; notes?: string };
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
  style?: KBStyle;
  duration_s?: number;
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
  exercises?: any[];
  rounds?: RoundOut[];
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

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

  // Weekly workouts
  const { data, error, isLoading } = useSWR<{ weekStart: string; workouts: WorkoutDTO[] }>(
    "/api/workouts",
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60_000 }
  );

  // Technique videos (optional)
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

  // Exercise names
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

  // Pick current workout
  const workout: WorkoutDTO | undefined = useMemo(() => {
    const ws = Array.isArray(data?.workouts) ? data!.workouts : [];
    return ws.find((w) => String(w.id) === String(id));
  }, [data, id]);

  // Sorted rounds + durations
  const { hasRounds, boxingRounds, kbRounds, totalDurationSec, boxingDurationSec, sortedRounds } = useMemo(() => {
    const rounds = workout?.rounds || [];
    const sorted = rounds.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const boxing = sorted.filter((r) => r.category === "Boxing");
    const kb = sorted.filter((r) => r.category === "Kettlebell");
    const boxingDur = boxing.reduce((sum, r) => sum + (r.duration_s ?? 180), 0);
    const kbDur = kb.length * 180;
    const legacyDur =
      (workout?.exercises || []).reduce((sum, ex: any) => sum + (ex.durationSec || 0), 0) || 1800;
    const has = sorted.length > 0;

    return {
      hasRounds: has,
      boxingRounds: boxing,
      kbRounds: kb,
      totalDurationSec: has ? boxingDur + kbDur : legacyDur,
      boxingDurationSec: has ? boxingDur : 900,
      sortedRounds: sorted,
    };
  }, [workout]);

  const title = workout?.workout_name || "Workout";
  const subLabel = workout?.is_benchmark
    ? `Benchmark${workout?.benchmark_name ? `: ${workout.benchmark_name}` : ""}`
    : workout?.focus || "";
  const videoUrl = workout?.video_url || undefined;

  // Completion state
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

  // Media map for KB exercises in this workout
  const { videoByExerciseId } = useExerciseMediaMap(sortedRounds as any);

  /* ---------- View toggle (persist per workout) ---------- */
  type ViewMode = "list" | "follow";
  const storageKey = useMemo(
    () => (id ? `bxkr_workout_view_${id}` : "bxkr_workout_view"),
    [id]
  );
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(storageKey) as ViewMode | null;
      if (saved === "list" || saved === "follow") setView(saved);
    } catch {}
  }, [storageKey]);
  const handleViewChange = (v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem(storageKey, v);
    } catch {}
  };

  /* ---------- Completion modal state ---------- */
  const [showComplete, setShowComplete] = useState(false);
  const [rpe, setRpe] = useState<number>(7);
  const [durationMins, setDurationMins] = useState<number>(() =>
    Math.round((totalDurationSec || 1800) / 60)
  );

  // NEW: allow manual calories entry (pre-filled with estimate)
  const [calories, setCalories] = useState<number | "">("");
  const [caloriesTouched, setCaloriesTouched] = useState<boolean>(false);

  const [kbWeightUsed, setKbWeightUsed] = useState<number | "">("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    setDurationMins(Math.round((totalDurationSec || 1800) / 60));
  }, [totalDurationSec]);

  // Prefill calories when opening modal or when duration changes (only if user hasn't edited)
  function estimateCalories(minutes: number): number {
    // Simple estimate, editable by user
    const assumedWeightKg = 70;
    const avgMET = 8;
    return Math.round(avgMET * assumedWeightKg * (minutes / 60) * 1.05);
  }

  async function handleCompleteClick() {
    if (!session?.user?.email) {
      alert("Please sign in to log your workout.");
      return;
    }
    const mins = Number(durationMins) > 0 ? Number(durationMins) : Math.round((totalDurationSec || 1800) / 60);
    const est = estimateCalories(mins);
    setCalories(est);
    setCaloriesTouched(false);
    setShowComplete(true);
  }

  useEffect(() => {
    if (!showComplete) return;
    const mins = Number(durationMins) > 0 ? Number(durationMins) : Math.round((totalDurationSec || 1800) / 60);
    if (!caloriesTouched) setCalories(estimateCalories(mins));
  }, [durationMins, totalDurationSec, showComplete, caloriesTouched]);

  async function submitCompletion() {
    if (!id) return;
    const minutes = Number(durationMins) > 0 ? Number(durationMins) : Math.round((totalDurationSec || 1800) / 60);
    const cals = calories === "" ? null : Number(calories);

    try {
      const dateKey = formatDateKeyLocal(new Date());
      // IMPORTANT:
      // The unified /api/completions/create handler expects either:
      //  - gym { sets: [] } OR
      //  - benchmark mode. We trigger benchmark mode by setting is_benchmark: true
      //    so BXKR sessions without detailed per-part metrics can still be saved.
      const payload = {
        workout_id: String(id),
        is_benchmark: true, // ensure BXKR completion is accepted by API
        activity_type: "Strength training",
        calories_burned: cals,
        duration_minutes: minutes,
        weight_completed_with: kbWeightUsed === "" ? null : Number(kbWeightUsed),
        rpe: Number(rpe),
        notes: notes?.trim() || null,
        duration: minutes, // legacy compatibility
        dateKey,
      };

      const res = await fetch("/api/completions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowComplete(false);
        setKbWeightUsed("");
        setNotes("");
        setRpe(7);
        mutate();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j?.error || "Failed to log workout.");
      }
    } catch (e) {
      console.error(e);
      alert("Error logging workout.");
    }
  }

  /* ---------- Error/loading ---------- */
  if (error) {
    return (
      <main className="container py-3" style={{ paddingBottom: 70, color: "#fff", borderRadius: 12, minHeight: "100vh" }}>
        <div className="futuristic-card p-3">Failed to load workout</div>
      </main>
    );
  }
  if (isLoading || !workout) {
    return (
      <main className="container py-3" style={{ paddingBottom: 70, color: "#fff", borderRadius: 12, minHeight: "100vh" }}>
        <div className="futuristic-card p-3 d-flex align-items-center" style={{ gap: 8 }}>
          <span>Loading…</span>
          <span className="inline-spinner" aria-hidden="true" />
        </div>
      </main>
    );
  }

  /* ---------- Render ---------- */
  return (
    <>
      <Head>
        <title>{title} • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3" style={{ paddingBottom: 80, color: "#fff", borderRadius: 12, minHeight: "100vh" }}>
        {/* Header */}
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
          <div className="d-flex align-items-center" style={{ gap: 8 }}>
            {mounted && <WorkoutViewToggle value={view} onChange={handleViewChange} />}
            <Link href="/workouts" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
              ← Back
            </Link>
          </div>
        </div>

        {/* Notes */}
        {workout.notes && (
          <section className="futuristic-card p-3 mb-3">
            <details open>
              <summary
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 12,
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

        {/* Optional workout-level video in List view */}
        {view === "list" && videoUrl && videoUrl.startsWith("http") && (
          <section className="futuristic-card p-2 mb-3" style={{ overflow: "hidden" }}>
            <div className="ratio ratio-16x9" style={{ borderRadius: 12 }}>
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

        {/* Timer in List view only */}
        {view === "list" && (
          <section className="futuristic-card p-3 mb-3">
            <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
              <div className="fw-semibold">Round Timer</div>
              <small style={{ opacity: 0.7 }}>
                Boxing: {Math.round((boxingDurationSec || 900) / 60)} mins • Est total:{" "}
                {Math.round((totalDurationSec || 1800) / 60)} mins
              </small>
            </div>
            <RoundTimer rounds={10} boxRounds={5} work={180} rest={60} />
          </section>
        )}

        {/* Main View */}
        {hasRounds ? (
          view === "follow" ? (
            <FollowAlongViewer
              rounds={sortedRounds as any}
              exerciseNameById={exerciseNameById}
              videoByExerciseId={videoByExerciseId}
              techVideoByCode={techVideoByCode}
              boxRoundsCount={5}
            />
          ) : (
            <ListViewer
              boxingRounds={boxingRounds as any}
              kbRounds={kbRounds as any}
              exerciseNameById={exerciseNameById}
              techVideoByCode={techVideoByCode}
            />
          )
        ) : (
          <section className="futuristic-card p-3 mb-3">
            <div
              className="fw-bold mb-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}
            >
              Exercises
            </div>
            {Array.isArray(workout.exercises) && workout.exercises.length > 0 ? (
              workout.exercises.map((ex: any, i: number) => {
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
                        className="btn btn-bxkr-outline btn-sm"
                        style={{ borderRadius: 24 }}
                      >
                        Video
                      </a>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-dim">No exercises linked</div>
            )}
          </section>
        )}

        {/* Actions */}
        <section className="mt-3">
          <button
            onClick={handleCompleteClick}
            disabled={isCompleted}
            style={{
              width: "100%",
              borderRadius: 12,
              color: "#fff",
              background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
              boxShadow: `0 0 16px ${ACCENT}66`,
              border: "none",
              padding: "10px 14px",
              fontWeight: 700,
            }}
          >
            {isCompleted ? "✓ Completed" : "Mark Complete"}
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
                className="futuristic-card p-3"
                style={{
                  maxWidth: 520,
                  margin: "10vh auto",
                  background: "rgba(30,30,30,0.9)",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="fw-semibold">Log completion</div>
                  <button
                    className="btn btn-bxkr-outline btn-sm"
                    onClick={() => setShowComplete(false)}
                    style={{ borderRadius: 24 }}
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

                  {/* NEW: Manual calories field (prefilled, editable) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label">Calories burned</label>
                    <input
                      type="number"
                      min={0}
                      className="form-control"
                      placeholder="e.g., 350"
                      value={calories}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") {
                          setCalories("");
                          setCaloriesTouched(true);
                        } else {
                          const n = Math.max(0, Number(v));
                          setCalories(Number.isFinite(n) ? n : 0);
                          setCaloriesTouched(true);
                        }
                      }}
                    />
                    <small className="text-dim">Prefilled estimate — you can edit this.</small>
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
                    <small className="text-dim">If mixed bells, enter most-used or average.</small>
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
                  <button
                    className="btn btn-bxkr-outline btn-sm"
                    onClick={() => setShowComplete(false)}
                    style={{ borderRadius: 24 }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={submitCompletion}
                    style={{
                      borderRadius: 24,
                      color: "#fff",
                      background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                      boxShadow: `0 0 14px ${ACCENT}66`,
                      border: "none",
                      paddingInline: 14,
                    }}
                  >
                    Save
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

      {/* -------- Global, scoped overrides to enforce 64px thumbs + compact inputs -------- */}
      <style jsx global>{`
        /* Keep exercise thumbnails 64x64 no matter what (buttons with image inside) */
        main.container .futuristic-card button.btn.btn-sm.btn-outline-light img,
        main.container .futuristic-card .exercise-thumb,
        main.container .futuristic-card .kb-thumb img {
          width: 64px !important;
          height: 64px !important;
          object-fit: cover !important;
          display: block;
        }

        /* On small screens, keep inputs compact so thumbs are never squeezed */
        @media (max-width: 560px) {
          main.container .futuristic-card input[type="number"] {
            max-width: 80px;
            font-size: 0.9rem;
          }
          /* Make reps even narrower */
          main.container .futuristic-card input[type="number"][placeholder="Reps"],
          main.container .futuristic-card input[aria-label*="reps"],
          main.container .futuristic-card input[aria-label*="Reps"] {
            max-width: 60px;
          }
        }
      `}</style>

      <BottomNav />
    </>
  );
}
