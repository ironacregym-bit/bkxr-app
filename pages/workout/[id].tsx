
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import RoundTimer from "../../components/RoundTimer";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function WorkoutPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();
  
  const wid = useMemo(() => {
    const q = router.query.id;
    return Array.isArray(q) ? q[0] : q ?? "";
  }, [router.query.id]);

  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);
  if (error)
    return (
      <main className="container py-3">
        <div className="alert alert-danger">Failed to load workout</div>
      </main>
    );
  if (isLoading || !data)
    return (
      <main className="container py-3">
        <div className="alert alert-secondary">Loading…</div>
      </main>
    );

  const workout = (data.workouts || []).find((w: any) => String(w.id) === String(id));
  if (!workout) {
    return (
      <main className="container py-3">
        <div className="alert alert-warning">No workout found</div>
        <Link href="../">Back to week</Link>
      </main>
    );
  }

  // Check completion status
  const { data: completionData, mutate } = useSWR(
    session?.user?.email ? `/api/completions?email=${session.user.email}&workout_id=${id}` : null,
    fetcher
  );
  const isCompleted = completionData?.completed === true;

  const handleComplete = async () => {
    if (!session?.user?.email) {
      alert("Please sign in to log your workout.");
      return;
    }

    const userWeight = workout.userWeight || 70;
    const totalMET =
      Array.isArray(workout.exercises) && workout.exercises.length > 0
        ? workout.exercises.reduce((sum: number, ex: any) => sum + (ex.met || 8), 0) / workout.exercises.length
        : 8;
    const durationHours = (workout.totalDurationSec || 1800) / 3600;
    const calories = Math.round(totalMET * userWeight * durationHours * 1.05);

    try {
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
        mutate(); // Refresh completion status
      } else {
        alert("Failed to log workout.");
      }
    } catch {
      alert("Error logging workout.");
    }
  };

  return (
    <>
      <Head>
        <title>{workout.title} - BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"/>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
      </Head>


      <main className="container py-3" style={{ paddingBottom: "70px" }}>
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h3 mb-0">{workout.title}</h1>
            <small className="text-muted">{workout.day}</small>
          </div>
          <Link href="../">Back to week</Link>
        </div>

        {/* Notes */}
        {workout.notes && <div className="alert alert-info">{workout.notes}</div>}

        {/* Video */}
        {workout.video && workout.video.startsWith("http") && (
          <div className="ratio ratio-16x9 mb-3">
            {workout.video.includes("youtube") || workout.video.includes("youtu.be") || workout.video.includes("vimeo") ? (
              <iframe
                src={workout.video}
                title="Workout video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video controls src={workout.video} />
            )}
          </div>
        )}

        {/* Round Timer */}
        <div className="card mb-3 border-dark">
          <div className="card-body">
            <RoundTimer rounds={10} boxRounds={5} work={180} rest={60} />
          </div>
        </div>

        {/* Exercises */}
        <div className="card border-dark">
          <div className="card-header fw-bold">Exercises</div>
          <div className="list-group list-group-flush">
            {Array.isArray(workout.exercises) && workout.exercises.length > 0 ? (
              workout.exercises.map((ex: any, i: number) => (
                <div key={i} className="list-group-item">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-semibold">{ex.name || "Exercise"}</div>
                      <small className="text-muted">
                        {ex.type ? `${ex.type} · ` : ""}
                        {ex.durationSec ? `${ex.durationSec}s` : ""}
                        {ex.reps ? ` · ${ex.reps} reps` : ""}
                        {ex.restSec ? ` · rest ${ex.restSec}s` : ""}
                        {ex.met ? ` · MET ${ex.met}` : ""}
                      </small>
                    </div>
                    {ex.video && ex.video.startsWith("http") && (
                      <a className="btn btn-sm btn-outline-dark" href={ex.video} target="_blank" rel="noreferrer">
                        <i className="fa-solid fa-video me-1" /> Video
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="list-group-item text-muted">No exercises linked</div>
            )}
          </div>
        </div>

        {/* Complete Button */}
        <div className="mt-3 d-flex gap-2">
          <button
            className="btn btn-success w-100"
            onClick={handleComplete}
            disabled={isCompleted}
          >
            {isCompleted ? (
              <>
                <i className="fa-solid fa-check me-1" /> Completed
              </>
            ) : (
              <>
                <i className="fa-solid fa-check me-1" /> Mark Complete
              </>
            )}
          </button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="navbar fixed-bottom bg-light border-top">
        <div className="container d-flex justify-content-around">
          <Link href="/">
            <i className="fas fa-home fa-lg"></i>
            <div style={{ fontSize: "12px" }}>Home</div>
          </Link>
          <Link href="/workout/today">
            <i className="fas fa-dumbbell fa-lg"></i>
            <div style={{ fontSize: "12px" }}>WoD</div>
          </Link>
          <Link href="/profile">
            <i className="fas fa-user fa-lg"></i>
            <div style={{ fontSize: "12px" }}>Profile</div>
          </Link>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_TRAINER_PHONE || process.env.TRAINER_PHONE}?text=Hi%20Coach%20I%27m%20doing%20BXKR`}
            target="_blank"
            rel="noreferrer"
            className="text-center text-dark"
          >
            <i className="fas fa-comments fa-lg"></i>
            <div style={{ fontSize: "12px" }}>Chat</div>
          </a>
        </div>
      </nav>
    </>
  );
}
