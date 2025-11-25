import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useEffect, useState } from "react";
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

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  const { data: completionData } = useSWR(
    session?.user?.email
      ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}`
      : null,
    fetcher
  );

  const completedIds =
    completionData?.history?.map((h: any) => h.workout_id) || [];

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

  // Add state for selected day (default: today)
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  // Greeting
  const hour = today.getHours();
  const greeting =
    hour < 12
      ? "Good Morning"
      : hour < 18
      ? "Good Afternoon"
      : "Good Evening";

  // Helper: get day name for a date
  function getDayName(date: Date) {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }

  // Workouts for the selected day
  const selectedDayName = getDayName(selectedDay);
  const selectedWorkouts = (data?.workouts || []).filter(
    (w: any) =>
      (w.day || "").toLowerCase() === selectedDayName.toLowerCase()
  );

  // --- Week Overview Calculations ---
  // Get Monday of this week
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  // Filter completions for this week
  const completionsThisWeek = (completionData?.history || []).filter(
    (c: any) => {
      const completedAt = new Date(c.completed_at);
      return completedAt >= monday && completedAt <= today;
    }
  );

  // Workouts completed
  const workoutsCompleted = completionsThisWeek.length;

  // Calories burned
  const caloriesBurned = completionsThisWeek.reduce(
    (sum: number, c: any) => sum + (c.calories_burned || 0),
    0
  );

  // Weight lifted (if available in your workout data as total_weight_kg)
  let weightLifted = 0;
  completionsThisWeek.forEach((c: any) => {
    const workout = (data?.workouts || []).find(
      (w: any) => w.id === c.workout_id
    );
    if (workout && workout.total_weight_kg) {
      weightLifted += workout.total_weight_kg;
    }
  });

  // --- Find which days have a workout scheduled ---
  // Map: day index (0-6) => true if workout exists
  const daysWithWorkout = weekDays.map((d) => {
    const dayName = getDayName(d);
    return (data?.workouts || []).some(
      (w: any) => (w.day || "").toLowerCase() === dayName.toLowerCase()
    );
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
        <h2 className="mb-4 text-center">
          {greeting}, {session?.user?.name || "Athlete"}
        </h2>

        {/* Week Overview */}
        <div className="row text-center mb-4 gx-3">
          <div className="col">
            <div className="bxkr-card py-2">
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                <i className="fas fa-dumbbell me-1"></i>Workouts
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {workoutsCompleted}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>Completed</div>
            </div>
          </div>
          <div className="col">
            <div className="bxkr-card py-2">
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                <i className="fas fa-fire me-1"></i>Calories
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {caloriesBurned}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>Burned</div>
            </div>
          </div>
          <div className="col">
            <div className="bxkr-card py-2">
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                <i className="fas fa-weight-hanging me-1"></i>Weight
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {weightLifted}
              </div>
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
              <button
                className="btn btn-outline-dark"
                onClick={() => signOut()}
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Errors/Loading */}
        {error && (
          <div className="alert alert-danger">Failed to load workouts</div>
        )}
        {isLoading && (
          <div className="alert alert-secondary">Loading…</div>
        )}

        {/* Weekly strip */}
        <div className="d-flex justify-content-between text-center mb-4">
          {weekDays.map((d, i) => {
            const isToday = isSameDay(d, today);
            const isSelected = isSameDay(d, selectedDay);
            const hasWorkout = daysWithWorkout[i];

            // Ring logic: blue ring if workout, thicker ring if selected
            let borderStyle = "";
            if (hasWorkout && isSelected) {
              borderStyle = "3px solid #0d6efd"; // Bootstrap primary, thicker
            } else if (hasWorkout) {
              borderStyle = "2px solid #0d6efd";
            } else if (isSelected) {
              borderStyle = "2px solid #fff";
            }

            return (
              <div
                key={i}
                style={{ width: "40px", cursor: "pointer" }}
                onClick={() => setSelectedDay(d)}
              >
                <div className="fw-bold">{dayLabels[i]}</div>
                <div
                  className={`rounded-circle d-flex justify-content-center align-items-center ${
                    isSelected
                      ? "bg-primary text-white"
                      : isToday
                      ? "bg-warning text-dark"
                      : ""
                  }`}
                  style={{
                    width: "28px",
                    height: "28px",
                    margin: "4px auto",
                    border: borderStyle,
                    boxSizing: "border-box",
                    transition: "background 0.2s, color 0.2s, border 0.2s",
                  }}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected day's workout card */}
        {selectedWorkouts.length > 0 && (
          <div className="p-3 mb-3 bxkr-card">
            <div className="mb-2 fw-bold">{selectedDayName}</div>
            <h6>{selectedWorkouts[0].title}</h6>
            <p>{selectedWorkouts[0].notes || "Workout details"}</p>
            <Link
              href={`/workout/${selectedWorkouts[0].id}`}
              className="btn btn-primary btn-sm mt-2"
            >
              Start Workout
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
