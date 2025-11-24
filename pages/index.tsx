import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function getWeek() {
  const today = new Date();
  const day = today.getDay();
  const diffToMon = (day + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

export default function Home() {
  const { data: session, status } = useSession();
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  const { data: completionData } = useSWR(
    session?.user?.email ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}` : null,
    fetcher
  );

  const completedIds = completionData?.history?.map((h: any) => h.workout_id) || [];

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      fetch("/api/users/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.user.email,
          name: session.user.name || "",
          image: session.user.image || "",
        }),
      }).catch(() => {});
    }
  }, [status, session?.user?.email]);

  const weekDays = getWeek();
  const today = new Date();
  const todayName = today.toLocaleDateString(undefined, { weekday: "long" });

  // Greeting
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  // Today's workouts
  const todaysWorkouts = (data?.workouts || []).filter(
    (w: any) => (w.day || "").toLowerCase() === todayName.toLowerCase()
  );

  // --- Week Overview Calculations ---
  // Get Monday of this week
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  // Filter completions for this week
  const completionsThisWeek = (completionData?.history || []).filter((c: any) => {
    const completedAt = new Date(c.completed_at);
    return completedAt >= monday && completedAt <= today;
  });

  // Workouts completed
  const workoutsCompleted = completionsThisWeek.length;

  // Calories burned
  const caloriesBurned = completionsThisWeek.reduce((sum: number, c: any) => sum + (c.calories_burned || 0), 0);

  // Weight lifted (if available in your workout data as total_weight_kg)
  let weightLifted = 0;
  completionsThisWeek.forEach((c: any) => {
    const workout = (data?.workouts || []).find((w: any) => w.id === c.workout_id);
    if (workout && workout.total_weight_kg) {
      weightLifted += workout.total_weight_kg;
    }
  });

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
      </Head>

      <main className="container py-3" style={{ paddingBottom: "70px" }}>
        {/* Greeting */}
        <h2 className="mb-4 text-center">{greeting}, {session?.user?.name || "Athlete"}</h2>

        {/* Week Overview */}
        <div className="row text-center mb-4 gx-3">
          <div className="col">
            <div className="bxkr-card py-2">
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                <i className="fas fa-dumbbell me-1"></i>Workouts
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{workoutsCompleted}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>Completed</div>
            </div>
          </div>
          <div className="col">
            <div className="bxkr-card py-2">
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                <i className="fas fa-fire me-1"></i>Calories
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{caloriesBurned}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>Burned</div>
            </div>
          </div>
          <div className="col">
            <div className="bxkr-card py-2">
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                <i className="fas fa-weight-hanging me-1"></i>Weight
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{weightLifted}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>kg Lifted</div>
            </div>
          </div>
        </div>

        {/* Auth bar */}
        <div className="mb-4 d-flex justify-content-center gap-3 flex-wrap">
          {status === "loading" ? (
            <span>Checking session…</span>
          ) : !session ? (
            <button className="btn btn-dark" onClick={() => signIn("google")}>
              Sign in with Google
            </button>
          ) : (
            <div className="d-flex gap-3 align-items-center">
              <img
                src={session.user?.image ?? ""}
                alt=""
                className="rounded-circle"
                style={{ width: 32, height: 32 }}
              />
              <span className="text-muted">{session.user?.email}</span>
              <button className="btn btn-outline-dark" onClick={() => signOut()}>
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Errors/Loading */}
        {error && <div className="alert alert-danger">Failed to load workouts</div>}
        {isLoading && <div className="alert alert-secondary">Loading…</div>}

        {/* Weekly strip */}
        <div className="d-flex justify-content-between text-center mb-4">
          {weekDays.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div key={i} style={{ width: "40px" }}>
                <div className="fw-bold">{dayLabels[i]}</div>
                <div
                  className={`rounded-circle d-flex justify-content-center align-items-center ${isToday ? "bg-warning text-dark" : ""}`}
                  style={{ width: "28px", height: "28px", margin: "4px auto" }}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Today's workout card */}
        {todaysWorkouts.length > 0 && (
          <div className="p-3 mb-3 bxkr-card">
            <div className="mb-2 fw-bold">{todayName}</div>
            <h6>{todaysWorkouts[0].title}</h6>
            <p>{todaysWorkouts[0].notes || "Workout details"}</p>
            <Link href={`/workout/${todaysWorkouts[0].id}`} className="btn btn-primary btn-sm mt-2">
              Start Workout
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
