
// pages/workout/[id].tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import BottomNav from "../../components/BottomNav";
import RoundTimer from "../../components/RoundTimer";

// New components you asked for
import WorkoutViewToggle from "../../components/workouts/WorkoutViewToggle";
import ListViewer from "../../components/workouts/ListViewer";
import FollowAlongViewer from "../../components/workouts/FollowAlongViewer";

/* ---------------- Types kept compatible with your DTOs ---------------- */
type KBStyle = "EMOM" | "AMRAP" | "LADDER";

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
  style?: KBStyle | "Combo";
  order: number;
  duration_s?: number; // boxing
  combo?: { name?: string; actions: BoxingAction[]; notes?: string };
  exercise_id?: string; // kb
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
  duration_s?: number; // boxing = 180 default
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
  exercises?: any[]; // legacy
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

export default function WorkoutPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();

  // Weekly workouts (unchanged entrypoint)
  const { data, error, isLoading } = useSWR<{ weekStart: string; workouts: WorkoutDTO[] }>(
    "/api/workouts",
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60_000 }
  );

  // Boxing technique library (optional)
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

  // Global exercise names (for KB display)
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

  // Select current workout by id
  const workout: WorkoutDTO | undefined = useMemo(() => {
    const ws = Array.isArray(data?.workouts) ? data!.workouts : [];
    return ws.find((w) => String(w.id) === String(id));
  }, [data, id]);

  // Derived: boxing/kb rounds, durations
  const { hasRounds, boxingRounds, kbRounds, totalDurationSec, boxingDurationSec } = useMemo(() => {
    const rounds = workout?.rounds || [];
    const sorted = rounds.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const boxing = sorted.filter((r) => r.category === "Boxing");
    const kb = sorted.filter((r) => r.category === "Kettlebell");

    const boxingDur = boxing.reduce((sum, r) => sum + (r.duration_s ?? 180), 0);
    const kbDur = kb.length * 180; // 3:00 each in UI

    const legacyDur =
      (workout?.exercises || []).reduce((sum, ex: any) => sum + (ex.durationSec || 0), 0) || 1800;

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

  /* ---------------- View toggle (persist per workout id) ---------------- */
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

  /* ---------------- Completion modal state ---------------- */
  const [showComplete, setShowComplete] = useState(false);
  const [rpe, setRpe] = useState<number>(7);
  const [durationMins, setDurationMins] = useState<number>(() =>
    Math.round((totalDurationSec || 1800) / 60)
  );
  const [kbWeightUsed, setKbWeightUsed] = useState<number | "">("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
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

    // Simple calories estimate (same as your current logic)
    const assumedWeightKg = 70;
    const avgMET = 8;
    const calories = Math.round(avgMET * assumedWeightKg * (minutes / 60) * 1.05);

    try {
      const dateKey = formatDateKeyLocal(new Date());
      const payload = {
        user_email: session.user.email,
        workout_id: String(id),
        activity_type: "Strength training",
        calories_burned: calories,
        duration_minutes: minutes,
        weight_completed_with: kbWeightUsed === "" ? null : Number(kbWeightUsed),
        rpe: Number(rpe),
        notes: notes?.trim() || null,
        duration: minutes, // legacy
        dateKey,           // harmless on server if unused
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

  /* ---------------- Error/loading ---------------- */
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
          paddingBottom: 80,
          color: "#fff",
          borderRadius: 12,
          minHeight: "100vh",
        }}
      >
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

        {/* Optional: top video only in List view (Follow-along has its own pane) */}
        {view === "list" && workout.video_url && workout.video_url.startsWith("http") && (
          <section className="futuristic-card p-2 mb-3" style={{ overflow: "hidden" }}>
            <div className="ratio ratio-16x9" style={{ borderRadius: 12 }}>
              {workout.video_url.includes("youtube") ||
              workout.video_url.includes("youtu.be") ||
              workout.video_url.includes("vimeo") ? (
                <iframe
                  src={workout.video_url}
                  title="Workout video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video controls src={workout.video_url} style={{ width: "100%" }} />
              )}
            </div>
          </section>
        )}

        {/* Round Timer (List view only) */}
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

        {/* Main content */}
        {hasRounds ? (
          view === "follow" ? (
            <FollowAlongViewer
              rounds={(workout.rounds || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))}
              exerciseNameById={exerciseNameById}
              techVideoByCode={techVideoByCode}
              boxRoundsCount={5}
            />
          ) : (
            <ListViewer
              boxingRounds={boxingRounds}
              kbRounds={kbRounds}
              exerciseNameById={exerciseNameById}
            />
          )
        ) : (
          // Legacy fallback: simple list of exercises if rounds not present
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

        {/* Actions / Complete */}
        <section className="mt-3">
          <button
            className="btn btn-primary w-100"
            onClick={handleCompleteClick}
            disabled={isCompleted}
            style={{ borderRadius: 12 }}
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
                  <button className="btn btn-bxkr-outline btn-sm" onClick={() => setShowComplete(false)} style={{ borderRadius: 24 }}>
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
                  <button className="btn btn-bxkr-outline btn-sm" onClick={() => setShowComplete(false)} style={{ borderRadius: 24 }}>
                    Cancel
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={submitCompletion} style={{ borderRadius: 24 }}>
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

      <BottomNav />
    </>
  );
}
