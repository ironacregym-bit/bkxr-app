
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

import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

export const getServerSideProps: GetServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const session = await getSession(context);
  if (!session) {
    return { redirect: { destination: "/landing", permanent: false } };
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

// ----- Helpers for aligned week/month/year windows
function startOfAlignedWeek(d: Date) {
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s;
}
function endOfAlignedWeek(d: Date) {
  const s = startOfAlignedWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function startOfMonth(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), 1);
  s.setHours(0, 0, 0, 0);
  return s;
}
function endOfMonth(d: Date) {
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  e.setHours(23, 59, 59, 999);
  return e;
}
function weeksInMonthAligned(d: Date) {
  // Count Monday–Sunday blocks overlapping the month
  const s = startOfMonth(d);
  const e = endOfMonth(d);
  const sAligned = startOfAlignedWeek(s);
  const eAligned = endOfAlignedWeek(e);
  const diffDays =
    Math.ceil((eAligned.getTime() - sAligned.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.ceil(diffDays / 7); // typically 4 or 5
}
function weeksInYear(year: number) {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const sAligned = startOfAlignedWeek(jan1);
  const eAligned = endOfAlignedWeek(dec31);
  const diffDays =
    Math.ceil((eAligned.getTime() - sAligned.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.ceil(diffDays / 7); // 52 or 53
}

// small ring wrapper with glow
function ringWrapGlow(color: string): React.CSSProperties {
  return {
    filter: `drop-shadow(0 0 6px ${hexToRGBA(color, 0.35)})`,
    animation: "bxkrPulse 3.2s ease-in-out infinite",
  };
}
function hexToRGBA(hex: string, alpha = 1) {
  const m = hex.replace("#", "");
  const bigint = parseInt(m, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function Home() {
  const { data: session, status } = useSession();

  // Programmed workouts
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  // Performed workouts (full history; we compute week/month/year windows client-side)
  const { data: completionData } = useSWR(
    session?.user?.email
      ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}&range=all`
      : null,
    fetcher
  );
  const allCompletions = (completionData?.history || []) as any[];

  // Upsert user record (as before)
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

  // Calendar strip
  const weekDays = getWeek();
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  // Greeting
  const hour = today.getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const getDayName = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "long" });
  const selectedDayName = getDayName(selectedDay);

  const selectedWorkouts = (data?.workouts || []).filter(
    (w: any) => (w.day_name || "").toLowerCase() === selectedDayName.toLowerCase()
  );

  // Windows
  const thisWeekStart = startOfAlignedWeek(today);
  const thisWeekEnd = endOfAlignedWeek(today);
  const thisMonthStart = startOfMonth(today);
  const thisMonthEnd = endOfMonth(today);
  const weeksInMonth = weeksInMonthAligned(today);
  const weeksInThisYear = weeksInYear(today.getFullYear());

  // Workouts counts
  const workoutsThisWeek = allCompletions.filter((c) => {
    const d = new Date(c.completed_date);
    return d >= thisWeekStart && d <= thisWeekEnd;
  }).length;

  const workoutsThisMonth = allCompletions.filter((c) => {
    const d = new Date(c.completed_date);
    return d >= thisMonthStart && d <= thisMonthEnd;
  }).length;

  const startOfYear = new Date(today.getFullYear(), 0, 1);
  startOfYear.setHours(0, 0, 0, 0);
  const workoutsYTD = allCompletions.filter((c) => {
    const d = new Date(c.completed_date);
    return d >= startOfYear && d <= today;
  }).length;

  // Calories per spec (500 per session for week/month; all-time uses recorded calories)
  const caloriesThisWeek = workoutsThisWeek * 500;
  const caloriesThisMonth = workoutsThisMonth * 500;
  const caloriesAllTime = allCompletions.reduce(
    (sum, c) => sum + (c.calories_burned || 0),
    0
  );

  // Streak
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
  // Saturate streak ring at a full year (365)
  const STREAK_VISUAL_TARGET = 365;

  // Nutrition (selected day key for banner under calendar)
  function formatYMD(d: Date) {
    const n = new Date(d);
    n.setHours(0, 0, 0, 0);
    return n.toISOString().slice(0, 10);
  }
  const selectedDateKey = useMemo(() => formatYMD(selectedDay), [selectedDay]);

  const { data: nutritionForSelected } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${selectedDateKey}` : null,
    fetcher
  );
  const noNutritionForSelected = (nutritionForSelected?.entries?.length || 0) === 0;

  // Pills: Week | Month | All Time (controls visuals)
  const [mode, setMode] = useState<"week" | "month" | "all">("week");

  // Targets
  const WORKOUTS_TARGET_WEEK = 3;
  const WORKOUTS_TARGET_MONTH = 3 * weeksInMonth;
  const WORKOUTS_TARGET_YEAR = 3 * weeksInThisYear;

  const CALORIES_TARGET_WEEK = 500 * 3; // 1500
  const CALORIES_TARGET_MONTH = 500 * (3 * weeksInMonth);
  // All-time calories: no target

  // Values by mode
  const workoutsValue =
    mode === "week" ? workoutsThisWeek : mode === "month" ? workoutsThisMonth : workoutsYTD;
  const workoutsTarget =
    mode === "week"
      ? WORKOUTS_TARGET_WEEK
      : mode === "month"
      ? WORKOUTS_TARGET_MONTH
      : WORKOUTS_TARGET_YEAR;
  const workoutsPct = Math.min(100, (workoutsValue / Math.max(1, workoutsTarget)) * 100);

  const caloriesValue =
    mode === "week" ? caloriesThisWeek : mode === "month" ? caloriesThisMonth : Math.round(caloriesAllTime);
  const caloriesTarget =
    mode === "week" ? CALORIES_TARGET_WEEK : mode === "month" ? CALORIES_TARGET_MONTH : null;
  const caloriesPct = caloriesTarget ? Math.min(100, (caloriesValue / Math.max(1, caloriesTarget)) * 100) : 100;

  const streakPct = Math.min(100, (streakDays / STREAK_VISUAL_TARGET) * 100);

  // Mode labels for dynamic wording under visuals
  const modeLabel = mode === "week" ? "This week" : mode === "month" ? "This month" : "Year to date";
  const modeLabelCalories = mode === "week" ? "This week" : mode === "month" ? "This month" : "All time";

  // Dynamic callout under greeting (kept for overall message)
  const remaining = Math.max(0, 3 - workoutsThisWeek);

  // Momentum: compare week calories vs last week (aligned weeks)
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekEnd);
  lastWeekEnd.setDate(thisWeekEnd.getDate() - 7);

  const lastWeekCalories = allCompletions
    .filter((c) => {
      const d = new Date(c.completed_date);
      return d >= lastWeekStart && d <= lastWeekEnd;
    })
    .reduce((sum, c) => sum + (c.calories_burned || 0), 0);

  const elapsedDaysThisWeek =
    Math.floor((Math.min(today.getTime(), thisWeekEnd.getTime()) - thisWeekStart.getTime()) / (1000 * 60 * 60 * 24)) +
    1;
  const avgThisWeek = caloriesValue && mode !== "all" ? caloriesThisWeek / Math.max(1, elapsedDaysThisWeek) : 0;
  const avgLastWeek = lastWeekCalories / 7;
  const isBehindLastWeek = caloriesThisWeek < lastWeekCalories;
  const caloriesMomentum =
    mode === "all"
      ? null
      : avgThisWeek >= avgLastWeek
      ? "Good work — you’ve averaged more calories than last week so far."
      : "You’re behind last week’s total — crush the next workout.";

  // Theme colours
  const COLORS = {
    workouts: "#ff7f32", // neon orange
    calories: "#ff4fa3", // hot pink
    streak: "#32ff7f", // electric green
    trailOrange: "rgba(255,127,50,0.15)",
    trailPink: "rgba(255,79,163,0.15)",
    trailGreen: "rgba(50,255,127,0.15)",
  };

  const daysWithWorkout = weekDays.map((d) => {
    const dayName = getDayName(d);
    return (data?.workouts || []).some(
      (w: any) => (w.day_name || "").toLowerCase() === dayName.toLowerCase()
    );
  });


  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* page-level pulse keyframes */}
        <style>{`
          @keyframes bxkrPulse {
            0% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.12)); }
            50% { filter: drop-shadow(0 0 10px rgba(255,255,255,0.22)); }
            100% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.12)); }
          }

        `}</style>
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
        {/* Header: profile + sign-out (no pill) */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt=""
                className="rounded-circle"
                style={{ width: 36, height: 36, objectFit: "cover" }}
              />
            )}
            <div className="fw-semibold">{session?.user?.name || "Athlete"}</div>
          </div>
          <div>
            {status === "authenticated" ? (
              <button className="btn btn-link text-light p-0" onClick={() => signOut()}>
                Sign out
              </button>
            ) : (
              <button
                className="btn btn-primary"
                style={{ backgroundColor: "#ff7f32", borderRadius: "24px", fontWeight: 600 }}
                onClick={() => signIn("google")}
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* Greeting + micro motivation */}
        <div className="mb-2">
          <h2 className="mb-1" style={{ fontWeight: 700, fontSize: "1.6rem" }}>
            {greeting}, {session?.user?.name || "Athlete"}
          </h2>
          <div className="small" style={{ opacity: 0.8 }}>
            {remaining > 0
              ? `You’re ${remaining} session${remaining === 1 ? "" : "s"} away from your weekly goal.`
              : "Consistency beats intensity."}
          </div>
        </div>

        {/* Mode pills: Week | Month | All Time */}
        <div className="d-flex justify-content-center gap-2 mb-3">
          {(["week", "month", "all"] as const).map((m) => (
            <button
              key={m}
              className={`btn btn-sm ${mode === m ? "btn-primary" : "btn-outline-light"}`}
              style={{
                borderRadius: "24px",
                backgroundColor: mode === m ? "#ff7f32" : "transparent",
                border: mode === m ? "none" : "1px solid #ff7f32",
                fontWeight: 600,
                color: "#fff",
              }}
              onClick={() => setMode(m)}
            >
              {m === "week" ? "Week" : m === "month" ? "Month" : "All Time"}
            </button>
          ))}
        </div>

        {/* Weekly strip (calendar) */}
        <div className="d-flex justify-content-between text-center mb-3">
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

        {/* Nutrition reminder for the selected day (below calendar) */}
        {status === "authenticated" && noNutritionForSelected && (
          <div className="mb-3">
            <CoachBanner
              message={`Don’t forget to log your nutrition for ${selectedDayName}.`}
              dateKey={selectedDateKey}
            />
          </div>
        )}

        {/* Stat visuals: Workouts | Calories | Streak */}
        <div className="row row-cols-3 gx-2 gx-sm-3 mb-4 text-center">
          {/* Workouts */}
          <div className="col mb-3">
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "16px",
                padding: "16px",
                backdropFilter: "blur(10px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
            >
              <div className="bxkr-ring" style={ringWrapGlow(COLORS.workouts)}>
                <CircularProgressbar
                  value={workoutsPct}
                  strokeWidth={12}
                  styles={buildStyles({
                    pathColor: COLORS.workouts,
                    trailColor: COLORS.trailOrange,
                    strokeLinecap: "butt",
                    pathTransitionDuration: 0.8,
                  })}
                />
              </div>
              <div className="mt-2" style={{ color: COLORS.workouts, fontWeight: 700 }}>
                Workouts
              </div>
              <div className="small" style={{ opacity: 0.8 }}>{modeLabel}</div>

              {/* Weekly micro-goal only for Week */}
              {mode === "week" && (
                remaining > 0 ? (
                  <div className="small" style={{ opacity: 0.9 }}>
                    You’re {remaining} session{remaining === 1 ? "" : "s"} away from your weekly goal.
                  </div>
                ) : (
                  <div className="small" style={{ opacity: 0.9 }}>
                    Weekly goal hit. Keep the streak alive!
                  </div>
                )
              )}
            </div>
          </div>

          {/* Calories */}
          <div className="col mb-3">
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "16px",
                padding: "16px",
                backdropFilter: "blur(10px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
            >
              <div className="bxkr-ring" style={ringWrapGlow(COLORS.calories)}>
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
              <div className="mt-2" style={{ color: COLORS.calories, fontWeight: 700 }}>
                Calories
              </div>
              <div className="small" style={{ opacity: 0.8 }}>{modeLabelCalories}</div>

              {/* Only show momentum if actually behind last week */}
              {mode !== "all" && isBehindLastWeek && (
                <div className="small mt-1" style={{ opacity: 0.9 }}>
                  You’re behind last week’s total — push a bit today.
                </div>
              )}
            </div>
          </div>

          {/* Streak */}
          <div className="col mb-3">
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "16px",
                padding: "16px",
                backdropFilter: "blur(10px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
            >
              <div className="bxkr-ring" style={ringWrapGlow(COLORS.streak)}>
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
              <div className="mt-2" style={{ color: COLORS.streak, fontWeight: 700 }}>
                Streak
              </div>
              <div className="small" style={{ opacity: 0.9 }}>
                {streakDays} {streakDays === 1 ? "day" : "days"}
              </div>
            </div>
          </div>
        </div>

        {/* Selected day's workouts */}
        {selectedWorkouts.length > 0 &&
          selectedWorkouts.map((w: any) => (
            <div
              key={w.id}
              className="mb-3"
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "16px",
                padding: "16px",
                backdropFilter: "blur(10px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
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

        {/* Loaders and errors */}
        {error && <div className="alert alert-danger">Failed to load workouts</div>}
        {isLoading && <div className="alert alert-secondary">Loading…</div>}
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}


