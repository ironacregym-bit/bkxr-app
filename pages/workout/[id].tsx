import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

const fetcher = (u: string) => fetch(u).then(r => r.json());

function ytEmbed(url?: string) {
  if (!url) return null;
  // Supports full YouTube links; otherwise return original URL
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export default function WorkoutPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const { data: session, status } = useSession();
  const { data, error, isLoading } = useSWR(id ? `/api/workouts/${id}` : null, fetcher);

  // Simple timer (count-up in seconds)
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timer | null>(null);

  useEffect(() => {
    if (running && !timerRef.current) {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    if (!running && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  const mmss = useMemo(() => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [seconds]);

  const DEFAULT_EXERCISE_SECONDS = Number(process.env.NEXT_PUBLIC_DEFAULT_EXERCISE_SECONDS || 60);
  const userWeightKg = Number(process.env.NEXT_PUBLIC_DEFAULT_WEIGHT_KG || 75); // fallback if not stored in Users

  function estimateCalories(): number {
    // MET × weight(kg) × time(hr) across exercises with missing durations → default seconds
    const exs = data?.workout?.exercises || [];
    const totalSeconds = exs.length * DEFAULT_EXERCISE_SECONDS;
    const avgMET =
      exs.length === 0
        ? 0
        : exs.reduce((sum: number, e: any) => sum + Number(e.met_value || 0), 0) / exs.length;
    const hours = totalSeconds / 3600;
    return Math.round(avgMET * userWeightKg * hours);
  }

  async function completeWorkout() {
    if (!session?.user?.email) {
      alert("Please sign in first.");
      return;
    }
    try {
      const calories = estimateCalories();
      const resp = await fetch("/api/completions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_email: session.user.email,
          workout_id: data?.workout?.id,
          calories_burned: calories,
          notes: `Timer ${mmss}`
        })
      });
      const json = await resp.json();
      if (json?.ok) {
        alert("Workout recorded—nice work!");
      } else {
        alert("Could not record workout");
      }
    } catch {
      alert("Error recording workout");
    }
  }

  return (
    <>
      <Head>
        <title>{data?.workout?.title ? `BXKR • ${data.workout.title}` : "BXKR"}</title>
        https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css
      </Head>

      <main className="container py-3">
        <div className="mb-3 d-flex gap-2 align-items-center">
          /← Back</Link>
          <div className="ms-auto d-flex gap-2 align-items-center">
            {status === "loading" ? (
              <span>Checking session…</span>
            ) : !session ? (
              <button className="btn btn-dark btn-sm" onClick={() => signIn("google")}>
                Sign in with Google
              </button>
            ) : (
              <>
                <img src={session.user?.image ?? ""} alt="" style={{ width: 24, height: 24, borderRadius: "50%" }} />
                <span className="text-muted small">{session.user?.email}</span>
                <button className="btn btn-outline-dark btn-sm" onClick={() => signOut()}>
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>

        {/* Workout header */}
        {error && <div className="alert alert-danger">Failed to load workout</div>}
        {isLoading && <div className="alert alert-secondary">Loading…</div>}

        {!isLoading && data?.workout && (
          <>
            <h2 className="mb-2">{data.workout.title}</h2>
            <p className="text-muted mb-3">{data.workout.dayName} — Focus: {data.workout.focus || "General"}</p>

            {/* Main video */}
            <div className="mb-3">
              {ytEmbed(data.workout.videoUrl) ? (
                <div className="ratio ratio-16x9">
                  <iframe
                    src={ytEmbed(data.workout.videoUrl)!}
                    title="Workout Video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : data.workout.videoUrl ? (
                <video controls width="100%">
                  <source src={data.workout.videoUrl} />
                </video>
              ) : (
                <div className="alert alert-warning">No workout video provided</div>
              )}
            </div>

            {/* Timer + complete */}
            <div className="d-flex align-items-center gap-2 mb-3">
              <div className="display-6 mb-0">{mmss}</div>
              {!running ? (
                <button className="btn btn-dark" onClick={() => setRunning(true)}>Start</button>
              ) : (
                <button className="btn btn-outline-dark" onClick={() => setRunning(false)}>Pause</button>
              )}
              <button className="btn btn-secondary" onClick={() => setSeconds(0)}>Reset</button>
              <button className="btn btn-success ms-auto" onClick={completeWorkout}>Complete workout</button>
            </div>

            {/* Exercise list */}
            <div className="card border-dark">
              <div className="card-header fw-bold">Exercises</div>
              <ul className="list-group list-group-flush">
                {data.workout.exercises.length === 0 && (
                  <li className="list-group-item text-muted">No exercises linked</li>
                )}
                {data.workout.exercises.map((ex: any) => (
                  <li key={`${ex.exercise_id}-${ex.order}`} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-semibold">
                          {ex.order}. {ex.name} <span className="badge bg-dark ms-2">{ex.type || data.workout.focus || "Work"}</span>
                        </div>
                        <div className="text-muted small">
                          {ex.description ? `${ex.description} • ` : ""}{ex.equipment || "Bodyweight"}
                          {ex.met_value ? ` • MET ${ex.met_value}` : ""}
                          {ex.reps ? ` • Reps ${ex.reps}` : ""}
                        </div>
                        {ex.video_url && (
                          ytEmbed(ex.video_url) ? (
                            <div className="ratio ratio-16x9 mt-2">
                              <iframe
                                src={ytEmbed(ex.video_url)!}
                                title={`Exercise ${ex.name}`}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          ) : (
                            <div className="mt-2">
                              <a href={ex.video_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-dark">
                                Open exercise video
                              </a>
                            </div>
                          )
                        )}
                      </div>
                      {/* Optional per-exercise actions */}
                      {/* <button className="btn btn-sm btn-outline-secondary">Done</button> */}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </main>
    </>
  );
}
