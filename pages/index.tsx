
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

// ---- Goals used for ring percentages (tweak to taste)
const GOALS = {
  workoutsPerWeek: 4,     // Goal count for completed workouts per week
  caloriesPerWeek: 2000,  // Target calorie burn per week (from completions)
  streakTarget: 7,        // Target streak in days
};

// Geometry helper for concentric rings
function ringGeometry(index: number, totalSize = 180, stroke = 12, gap = 2) {
  const inset = index * (stroke + gap);
  const size = totalSize - inset * 2;
  return { size, inset, stroke };
}

export default function Home() {
  const { data: session, status } = useSession();

  // Fetch workouts (programmed)
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  // Completion history (performed workouts)
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

  // ---- Stats from completionData for the chosen range
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

  // ---- Streak calculation (consecutive days with ≥1 completion)
  const toKey = (d: Date) => {
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    return dd.toISOString().slice(0, 10);
  };
  const completionDays = new Set<string>(
    (completionData?.history || []).map((c: any) => {
      const d = new Date(c.completed_date);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    })
  );
  let streakDays = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (true) {
    const k = toKey(cursor);
    if (completionDays.has(k)) {
      streakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  const daysWithWorkout = weekDays.map((d) => {
    const dayName = getDayName(d);
    return (data?.workouts || []).some(
      (w: any) => (w.day_name || "").toLowerCase() === dayName.toLowerCase()
    );
  });

  // ===== Nutrition check (today)
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: nutritionData } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${todayKey}` : null,
    fetcher
  );
  const noNutritionLogged = (nutritionData?.entries?.length || 0) === 0;

  // ---- Ring targets based on range (simple scaling)
  const workoutsTarget =
    range === "week"
      ? GOALS.workoutsPerWeek
      : range === "month"
      ? GOALS.workoutsPerWeek * 4
      : Math.max(GOALS.workoutsPerWeek, workoutsCompleted || 1); // avoid 0 target on 'all'

  const caloriesTarget =
    range === "week"
      ? GOALS.caloriesPerWeek
      : range === "month"
      ? GOALS.caloriesPerWeek * 4
      : Math.max(GOALS.caloriesPerWeek, caloriesBurned || 1);

  const streakTarget = GOALS.streakTarget;

  const pctWorkouts = Math.min(100, (workoutsCompleted / workoutsTarget) * 100);
  const pctCalories = Math.min(100, (caloriesBurned / caloriesTarget) * 100);
  const pctStreak = Math.min(100, (streakDays / streakTarget) * 100);

  // ---- Ring colors (Apple-like but BXKR vibe)
  const COLORS = {
    workouts: "#ff7f32", // neon orange
    calories: "#ff4fa3", // hot pink / red
    streak: "#32ff7f",   // electric green
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
        <h2 className="mb-3 text-center" style={{ fontWeight: 700, fontSize: "1.8rem" }}>
          {greeting}, {session?.user?.name || "Athlete"}
        </h2>

        {/* Range Filter Buttons */}
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

        {/* Apple Fitness-style triple concentric ring */}
        <div className="d-flex justify-content-center mb-2">
          <div style={{ position: "relative", width: 180, height: 180 }}>
            {/* Outer: Workouts */}
            {(() => {
              const geo = ringGeometry(0, 180, 12, 2);
              return (
                <div
                  style={{
                    position: "absolute",
                    top: geo.inset,
                    left: geo.inset,
                    width: geo.size,
                    height: geo.size,
                  }}
                >
                  <CircularProgressbar
                    value={pctWorkouts}
                    strokeWidth={geo.stroke}
                    styles={buildStyles({
                      pathColor: COLORS.workouts,
                      trailColor: "rgba(255,127,50,0.15)",
                      strokeLinecap: "butt",
                      pathTransitionDuration: 0.8,
                    })}
                  />
                </div>
              );
            })()}
            {/* Middle: Calories */}
            {(() => {
              const geo = ringGeometry(1, 180, 12, 2);
              return (
                <div
                  style={{
                    position: "absolute",
                    top: geo.inset,
                    left: geo.inset,
                    width: geo.size,
                    height: geo.size,
                  }}
                >
                  <CircularProgressbar
                    value={pctCalories}
                    strokeWidth={geo.stroke}
                    styles={buildStyles({
                      pathColor: COLORS.calories,
                      trailColor: "rgba(255,79,163,0.15)",
                      strokeLinecap: "butt",
                      pathTransitionDuration: 0.8,
                    })}
                  />
                </div>
              );
            })()}
            {/* Inner: Streak (replaces Sets) */}
            {(() => {
              const geo = ringGeometry(2, 180, 12, 2);
              return (
                <div
                  style={{
                    position: "absolute",
                    top: geo.inset,
                    left: geo.inset,
                    width: geo.size,
                    height: geo.size,
                  }}
                >
                  <CircularProgressbar
                    value={pctStreak}
                    strokeWidth={geo.stroke}
                    styles={buildStyles({
                      pathColor: COLORS.streak,
                      trailColor: "rgba(50,255,127,0.15)",
                      strokeLinecap: "butt",
                      pathTransitionDuration: 0.8,
                    })}
                  />
                </div>
              );
            })()}
          </div>
        </div>

        {/* Legends under rings */}
        <div className="d-flex justify-content-around text-center mb-4">
          <div>
            <div style={{ color: COLORS.workouts, fontWeight: 700 }}>Workouts</div>
            <div className="small" style={{ opacity: 0.85 }}>
              {workoutsCompleted}/{workoutsTarget} ({Math.round(pctWorkouts)}%)
            </div>
          </div>
          <div>
            <div style={{ color: COLORS.calories, fontWeight: 700 }}>Calories</div>
            <div className="small" style={{ opacity: 0.85 }}>
              {Math.round(caloriesBurned)}/{caloriesTarget} ({Math.round(pctCalories)}%)
            </div>
          </div>
          <div>
            <div style={{ color: COLORS.streak, fontWeight: 700 }}>Streak</div>
            <div className="small" style={{ opacity: 0.85 }}>
              {streakDays}/{streakTarget} ({Math.round(pctStreak)}%)
            </div>
          </div>
        </div>

        {/* Auth */}
        <div className="mb-4 d-flex justify-content-center gap-3 flex-wrap">
          {status === "loading" ? (
            <span>Checking session…</span>
          ) : !session ? (
            <button
              className="btn btn-primary"
              style={{
                backgroundColor: "#ff7f32",
                borderRadius: "24px",
                fontWeight: 600,
              }}
              onClick={() => signIn("google")}
            >
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
              <span style={{ opacity: 0.7 }}>{session.user?.email}</span>
              <button
                className="btn btn-outline-light"
                style={{ borderRadius: "24px" }}
                onClick={() => signOut()}
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {error && <div className="alert alert-danger">Failed to load workouts</div>}
        {isLoading && <div className="alert alert-secondary">Loading…</div>}

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
