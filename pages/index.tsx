
import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import CoachBanner from "../components/CoachBanner";
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";

// Rings
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

export const getServerSideProps: GetServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const session = await getSession(context);
  // If the user is NOT logged in → show landing page instead
  if (!session) {
    return {
      redirect: { destination: "/landing", permanent: false },
    };
  }
  return { props: {} };
};

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

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Geometry helper for single rings
function ringBox(size = 180) {
  return { width: size, height: size };
}

export default function Home() {
  const { data: session, status } = useSession();

  // Programmed workouts
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  // Performed workouts (completions)
  const [range, setRange] = useState<"week" | "month" | "all">("week");
  const { data: completionData } = useSWR(
    session?.user?.email
      ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}&range=${range}`
      : null,
    fetcher
  );

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

  // ---- Metrics from completions (use raw data, not only filtered-by-range, for tabs)
  const allCompletions = (completionData?.history || []) as any[];

  // This week window (Mon..Sun)
  const startOfThisWeek = (() => {
    const s = new Date();
    s.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Monday
    s.setHours(0, 0, 0, 0);
    return s;
  })();
  const endOfThisWeek = (() => {
    const e = new Date(startOfThisWeek);
    e.setDate(startOfThisWeek.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    return e;
  })();

  // Workouts completed this week
  const workoutsThisWeek = allCompletions.filter((c) => {
    const d = new Date(c.completed_date);
    return d >= startOfThisWeek && d <= endOfThisWeek;
  }).length;
  const WORKOUTS_TARGET = 3; // recommended

  // Calories burned this week (sum of c.calories_burned)
  const caloriesThisWeek = allCompletions
    .filter((c) => {
      const d = new Date(c.completed_date);
      return d >= startOfThisWeek && d <= endOfThisWeek;
    })
    .reduce((sum, c) => sum + (c.calories_burned || 0), 0);

  // Self-normalising visual scale for calories:
  // Use the best weekly total from the last 4 weeks as "visual max" (no target label shown)
  const weeksBack = 4;
  const weeklyBuckets: number[] = [];
  for (let i = 0; i < weeksBack; i++) {
    const s = new Date(startOfThisWeek);
    s.setDate(s.getDate() - i * 7);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    const total = allCompletions
      .filter((c) => {
        const d = new Date(c.completed_date);
        return d >= s && d <= e;
      })
      .reduce((sum, c) => sum + (c.calories_burned || 0), 0);
    weeklyBuckets.push(total);
  }
  const bestRecentWeekCalories = Math.max(1, ...weeklyBuckets); // avoid division by 0
  const caloriesPct = Math.max(
    0,
    Math.min(100, (caloriesThisWeek / bestRecentWeekCalories) * 100)
  );

  // Streak calculation (consecutive days with ≥1 completion ending today)
  const dayKey = (d: Date) => {
    const n = new Date(d);
    n.setHours(0, 0, 0, 0);
    return n.toISOString().slice(0, 10);
  };
  const completionDays = new Set<string>(
    allCompletions.map((c) => {
      const d = new Date(c.completed_date);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    })
  );
  let streakDays = 0;
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  while (completionDays.has(dayKey(cur))) {
    streakDays += 1;
    cur.setDate(cur.getDate() - 1);
  }
  const STREAK_VISUAL_TARGET = 7; // for the ring visual only; we show the exact streak beside it
  const streakPct = Math.max(0, Math.min(100, (streakDays / STREAK_VISUAL_TARGET) * 100));

  // Nutrition check (today)
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: nutritionData } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${todayKey}` : null,
    fetcher
  );
  const noNutritionLogged = (nutritionData?.entries?.length || 0) === 0;

  const daysWithWorkout = weekDays.map((d) => {
    const dayName = getDayName(d);
    return (data?.workouts || []).some(
      (w: any) => (w.day_name || "").toLowerCase() === dayName.toLowerCase()
    );
  });

  // Tab selection
  const [tab, setTab] = useState<"workouts" | "calories" | "streak">("workouts");

  // Theme colours
  const COLORS = {
    workouts: "#ff7f32", // neon orange
    calories: "#ff4fa3", // hot pink
    streak: "#32ff7f",   // electric green
    trailOrange: "rgba(255,127,50,0.15)",
    trailPink: "rgba(255,79,163,0.15)",
    trailGreen: "rgba(50,255,127,0.15)",
  };

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main
        className="container py-3"
        style={{
          paddingBottom: "70px",
          background: "linear-gradient(135deg, #1a1a1a 0%, #2e1a0f 100%)",
          color: "#fff",
          borderRadius: "12px",
        }}
      >
        {/* Coach reminder pill */}
        {status === "authenticated" && noNutritionLogged && (
          <CoachBanner
            message="Log your meals for today to stay on track!"
            dateKey={todayKey}
          />
        )}

        {/* Greeting */}
        <h2 className="text-center" style={{ fontWeight: 700, fontSize: "1.8rem" }}>
          {greeting}, {session?.user?.name || "Athlete"}
        </h2>

        {/* Tabs: Workouts | Calories | Streak */}
        <div className="d-flex justify-content-center gap-2 mt-3 mb-2">
          <button
            className={`btn btn-sm ${tab === "workouts" ? "btn-primary" : "btn-outline-light"}`}
            style={{
              borderRadius: "24px",
              backgroundColor: tab === "workouts" ? COLORS.workouts : "transparent",
              border: tab === "workouts" ? "none" : `1px solid ${COLORS.workouts}`,
              fontWeight: 600,
              color: "#fff",
            }}
            onClick={() => setTab("workouts")}
          >
            Workouts
          </button>
          <button
            className={`btn btn-sm ${tab === "calories" ? "btn-primary" : "btn-outline-light"}`}
            style={{
              borderRadius: "24px",
              backgroundColor: tab === "calories" ? COLORS.calories : "transparent",
              border: tab === "calories" ? "none" : `1px solid ${COLORS.calories}`,
              fontWeight: 600,
              color: "#fff",
            }}
            onClick={() => setTab("calories")}
          >
            Calories
          </button>
          <button
            className={`btn btn-sm ${tab === "streak" ? "btn-primary" : "btn-outline-light"}`}
            style={{
              borderRadius: "24px",
              backgroundColor: tab === "streak" ? COLORS.streak : "transparent",
              border: tab === "streak" ? "none" : `1px solid ${COLORS.streak}`,
              fontWeight: 600,
              color: "#fff",
            }}
            onClick={() => setTab("streak")}
          >
            Streak
          </button>
        </div>

        {/* Tab panel */}
        <div
          className="d-flex flex-column align-items-center"
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: "16px",
            padding: "16px",
            backdropFilter: "blur(10px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            marginBottom: "16px",
          }}
        >
          {tab === "workouts" && (
            <>
              <div style={{ ...ringBox(180) }}>
                <CircularProgressbar
                  value={Math.min(100, (workoutsThisWeek / WORKOUTS_TARGET) * 100)}
                  strokeWidth={12}
                  styles={buildStyles({
                    pathColor: COLORS.workouts,
                    trailColor: COLORS.trailOrange,
                    strokeLinecap: "butt",
                    pathTransitionDuration: 0.8,
                  })}
                />
              </div>
              <div className="text-center mt-2">
                <div style={{ fontWeight: 700, color: COLORS.workouts }}>
                  {workoutsThisWeek}/{WORKOUTS_TARGET} completed
                </div>
                <div className="small" style={{ opacity: 0.85 }}>
                  Weekly recommendation: {WORKOUTS_TARGET}
                </div>
              </div>
            </>
          )}

          {tab === "calories" && (
            <>
              <div style={{ ...ringBox(180) }}>
                <CircularProgressbar
                  value={caloriesPct}
                  strokeWidth={12}
                  styles={buildStyles({
                    pathColor: COLORS.calories,
                    trailColor: COLORS.trailPink,
                    strokeLinecap: "butt",
                    pathTransitionDuration: 0.8,
                  })}
                />
              </div>
              <div className="text-center mt-2">
                <div style={{ fontWeight: 700, color: COLORS.calories }}>
                  {Math.round(caloriesThisWeek)} kcal this week
                </div>
                <div className="small" style={{ opacity: 0.85 }}>
                  Visual scale: relative to your best week in the last 4 weeks
                </div>
              </div>
            </>
          )}

          {tab === "streak" && (
            <>
              <div style={{ ...ringBox(180) }}>
                <CircularProgressbar
                  value={streakPct}
                  strokeWidth={12}
                  styles={buildStyles({
                    pathColor: COLORS.streak,
                    trailColor: COLORS.trailGreen,
                    strokeLinecap: "butt",
                    pathTransitionDuration: 0.8,
                  })}
                />
              </div>
              <div className="text-center mt-2">
                <div style={{ fontWeight: 700, color: COLORS.streak }}>
                  Current streak: {streakDays} {streakDays === 1 ? "day" : "days"}
                </div>
                <div className="small" style={{ opacity: 0.85 }}>
                  Ring saturates at {STREAK_VISUAL_TARGET}, number shows full streak
                </div>
              </div>
            </>
          )}
        </div>

        {/* Range Filter Buttons (existing) */}
        <div className="d-flex justify-content-center gap-2 mb-3">
          {["week", "month", "all"].map((r) => (
            <button
              key={r}
              className={`btn btn-sm ${range === r ? "btn-primary" : "btn-outline-primary"}`}
              style={{
                borderRadius: "24px",
                backgroundColor: range === r ? "#ff7f32" : "transparent",
                color: "#fff",
                border: range === r ? "none" : "1px solid #ff7f32",
              }}
              onClick={() => setRange(r as "week" | "month" | "all")}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        {/* Weekly strip */}
        <div className="d-flex justify-content-between text-center mb-4">
          {weekDays.map((d, i) => {
            const isToday = isSameDay(d, today);
            const isSelected = isSameDay(d, selectedDay);
            const hasWorkout = daysWithWorkout[i];

            return (
              <div
                key={i}
                style={{ width: "40px", cursor: "pointer" }}
                onClick={() => setSelectedDay(d)}
                aria-label={`Select ${dayLabels[i]} ${d.getDate()}`}
              >
                <div
                  style={{
                    fontSize: "0.8rem",
                    opacity: 0.7,
                    marginBottom: "4px",
                  }}
                >
                  {dayLabels[i]}
                </div>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    lineHeight: "32px",
                    borderRadius: "50%",
                    margin: "0 auto",
                    backgroundColor: isSelected
                      ? "#ff7f32"
                      : isToday
                      ? "rgba(255,127,50,0.2)"
                      : "transparent",
                    color: "#fff",
                    border: isToday && !isSelected ? "1px solid #ff7f32" : "none",
                    opacity: hasWorkout ? 1 : 0.5,
                    fontWeight: isSelected ? 700 : 500,
                    textAlign: "center",
                  }}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected day's workouts */}
        {selectedWorkouts.length > 0 &&
          selectedWorkouts.map((w: any) => (
            <div
              key={w.id}
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "16px",
                padding: "16px",
                backdropFilter: "blur(10px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                marginBottom: "12px",
              }}
            >
              <div className="mb-2 fw-bold">{selectedDayName}</div>
              <h6>{w.workout_name}</h6>
              <p>{w.notes || "Workout details"}</p>
              <Link
                href={`/workout/${w.id}`}
                className="btn btn-primary btn-sm mt-2"
                style={{
                  backgroundColor: "#ff7f32",
                  borderRadius: "24px",
                  fontWeight: 600,
                }}
              >
                Start Workout
              </Link>
            </div>
          ))}
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
