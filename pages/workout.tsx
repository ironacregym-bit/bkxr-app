
import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import { useState } from "react";

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

export default function WorkoutPage() {
  const { data: session } = useSession();
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  const hour = today.getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const getDayName = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "long" });

  const selectedDayName = getDayName(selectedDay);

  // Fetch workouts for the week
  const { data: workoutsData } = useSWR("/api/workouts", fetcher);

  // Fetch workout completions for history
  const { data: completionData } = useSWR(
    session?.user?.email
      ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}`
      : null,
    fetcher
  );

  const weekDays = getWeek();

  // Today’s workout
  const todaysWorkout = (workoutsData?.workouts || []).find(
    (w: any) => (w.day_name || "").toLowerCase() === getDayName(today).toLowerCase()
  );

  // Weekly plan
  const daysWithWorkout = weekDays.map((d) => {
    const dayName = getDayName(d);
    return (workoutsData?.workouts || []).some(
      (w: any) => (w.day_name || "").toLowerCase() === dayName.toLowerCase()
    );
  });

  // Recommend Me (placeholder logic)
  const recommendWorkout = () => {
    const allWorkouts = workoutsData?.workouts || [];
    if (allWorkouts.length === 0) return alert("No workouts available to recommend.");
    const randomWorkout = allWorkouts[Math.floor(Math.random() * allWorkouts.length)];
    alert(`Recommended Workout: ${randomWorkout.workout_name}`);
  };

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
      </Head>

      <main className="container py-3" style={{ paddingBottom: "70px" }}>
        <h2 className="mb-4 text-center">
          {greeting}, {session?.user?.name || "Athlete"}
        </h2>

        {/* Today’s Workout */}
        <div className="mb-4">
          <h4 className="mb-3 text-center">Today</h4>
          {todaysWorkout ? (
            <div className="bxkr-card p-3 text-center">
              <h5>{todaysWorkout.workout_name}</h5>
              <p>{todaysWorkout.notes || "Workout details"}</p>
              <Link
                href={`/workout/${todaysWorkout.id}`}
                className="btn btn-primary mt-2"
              >
                Start Workout
              </Link>
            </div>
          ) : (
            <div className="bxkr-card p-3 text-center">
              <h5>Rest Day</h5>
              <p>No workout scheduled for today.</p>
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_TRAINER_PHONE}?text=Hi%20Coach%20I%27d%20like%20to%20book%20a%20session`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline-primary mt-2"
              >
                Book Gym Session
              </a>
            </div>
          )}
        </div>

        {/* Weekly Plan */}
        <h4 className="mb-3 text-center">Weekly Plan</h4>
        <div className="d-flex justify-content-between text-center mb-4">
          {weekDays.map((d, i) => {
            const isToday = isSameDay(d, today);
            const isSelected = isSameDay(d, selectedDay);
            const hasWorkout = daysWithWorkout[i];

            const pillClasses = [
              "bxkr-day-pill",
              isSelected ? "bxkr-selected" : "",
              !isSelected && isToday ? "bxkr-today" : "",
              hasWorkout ? "bxkr-has-workout" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={i}
                style={{ width: "40px", cursor: "pointer" }}
                onClick={() => setSelectedDay(d)}
              >
                <div className="fw-bold">{dayLabels[i]}</div>
                <div className={pillClasses}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>
        <div className="text-center mb-4">
          <button className="btn btn-outline-primary" onClick={recommendWorkout}>
            Recommend Me
          </button>
        </div>

        {/* Workout History */}
        <h4 className="mb-3 text-center">Workout History</h4>
        <div className="bxkr-card p-3">
          {completionData?.history?.length > 0 ? (
            completionData.history.slice(0, 5).map((c: any, idx: number) => (
              <div key={idx} className="d-flex justify-content-between mb-2">
                <span>{new Date(c.completed_date).toLocaleDateString()}</span>
                <span>{c.calories_burned} cal | {c.sets_completed} sets</span>
              </div>
            ))
          ) : (
            <p>No history yet.</p>
          )}
          /history
            View Full History
          </Link>
        </div>

        {/* Benchmark Results */}
        <h4 className="mt-4 mb-3 text-center">Benchmark Results</h4>
        <div className="bxkr-card p-3 text-center">
          <p>Track your benchmark workouts here.</p>
          /benchmarks
            View Benchmarks
          </Link>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
