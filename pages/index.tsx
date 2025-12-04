
import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import CoachBanner from "../components/CoachBanner";
// Redirect logic for index
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getSession(context);

  // If the user is NOT logged in → show landing page instead
  if (!session) {
    return {
      redirect: {
        destination: "/landing",
        permanent: false,
      },
    };
  }

  return {
    props: {}, // loads your existing home/dashboard
  };
}
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

  // Fetch workouts
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  // Completion history
  const [range, setRange] = useState<"week" | "month" | "all">("week");
  const { data: completionData } = useSWR(
    session?.user?.email
      ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}&range=${range}`
      : null,
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
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  const hour = today.getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const getDayName = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "long" });

  const selectedDayName = getDayName(selectedDay);

  const selectedWorkouts = (data?.workouts || []).filter(
    (w: any) => (w.day_name || "").toLowerCase() === selectedDayName.toLowerCase()
  );

  // Stats from completionData
  const now = new Date();
  let startDate: Date;
  if (range === "week") {
    startDate = new Date();
    startDate.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
    startDate.setHours(0, 0, 0, 0);
  } else if (range === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    startDate = new Date(2000, 0, 1);
  }

  const filteredCompletions = (completionData?.history || []).filter((c: any) => {
    const completedAt = new Date(c.completed_date);
    return completedAt >= startDate && completedAt <= now;
  });

  const workoutsCompleted = filteredCompletions.length;
  const caloriesBurned = filteredCompletions.reduce(
    (sum: number, c: any) => sum + (c.calories_burned || 0),
    0
  );
  const setsCompleted = filteredCompletions.reduce(
    (sum: number, c: any) => sum + (c.sets_completed || 0),
    0
  );

  const daysWithWorkout = weekDays.map((d) => {
    const dayName = getDayName(d);
    return (data?.workouts || []).some(
      (w: any) => (w.day_name || "").toLowerCase() === dayName.toLowerCase()
    );
  });

  // ===== Nutrition check (today) =====
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: nutritionData } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${todayKey}` : null,
    fetcher
  );
  const noNutritionLogged = (nutritionData?.entries?.length || 0) === 0;

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main
        className="bxkr-main container"
        style={{
          paddingBottom: "80px",
          background: "var(--bxkr-bg-1)",
          color: "var(--bxkr-text-main)"
        }}
      >
      
        {/* Header */}
        <div className="bxkr-header">
          <div>
            <h2 className="bxkr-greeting">{greeting}, {session?.user?.name || "Athlete"}</h2>
            {noNutritionLogged && (
              <div className="bxkr-nudge">
                <span>Don’t forget to log your meals today</span>
                <button className="bxkr-nudge-btn">Log</button>
              </div>
            )}
          </div>
      
          {session?.user?.image && (
            <img src={session.user.image} className="bxkr-avatar" alt="profile" />
          )}
        </div>
      
        {/* Stats */}
        <div className="bxkr-stats-row">
          <div className="bxkr-stat-card">
            <div className="bxkr-stat-label">Workouts</div>
            <div className="bxkr-stat-value">{workoutsCompleted}</div>
            <div className="bxkr-stat-sub">{range === "week" ? "This Week" : range === "month" ? "This Month" : "All Time"}</div>
          </div>
          <div className="bxkr-stat-card">
            <div className="bxkr-stat-label">Calories</div>
            <div className="bxkr-stat-value">{caloriesBurned}</div>
            <div className="bxkr-stat-sub">{range === "week" ? "This Week" : range === "month" ? "This Month" : "All Time"}</div>
          </div>
          <div className="bxkr-stat-card">
            <div className="bxkr-stat-label">Sets</div>
            <div className="bxkr-stat-value">{setsCompleted}</div>
            <div className="bxkr-stat-sub">{range === "week" ? "This Week" : range === "month" ? "This Month" : "All Time"}</div>
          </div>
        </div>
      
        {/* Range Tabs */}
        <div className="bxkr-range-tabs">
          {["week", "month", "all"].map((r) => (
            <button
              key={r}
              className={`bxkr-range-btn ${range === r ? "active" : ""}`}
              onClick={() => setRange(r as any)}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      
        {/* Calendar */}
        <div className="bxkr-calendar">
          {weekDays.map((d, i) => {
            const isToday = isSameDay(d, today);
            const isSelected = isSameDay(d, selectedDay);
            const hasWorkout = daysWithWorkout[i];
      
            return (
              <div key={i} className="bxkr-day" onClick={() => setSelectedDay(d)}>
                <div className="bxkr-day-label">{dayLabels[i]}</div>
                <div
                  className={`
                    bxkr-day-pill
                    ${isSelected ? "selected" : ""}
                    ${isToday && !isSelected ? "today" : ""}
                    ${hasWorkout ? "has-workout" : ""}
                  `}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
      
        {/* Workouts */}
        {selectedWorkouts.map((w: any) => (
          <div key={w.id} className="bxkr-workout-card">
            <div className="bxkr-workout-strip" />
            <div className="bxkr-workout-content">
              <h5>{w.workout_name}</h5>
              <p>{w.notes || "Workout details"}</p>
              <Link href={`/workout/${w.id}`} className="bxkr-start-btn">
                Start Workout
              </Link>
            </div>
          </div>
        ))}
      
      </main>


      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
