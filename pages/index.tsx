
import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import BxkrBanner from "../components/BxkrBanner";

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

type WorkoutLite = {
  id: string;
  workout_name?: string;
  notes?: string;
  day_name?: string;
};

function getWeek(): Date[] {
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

function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts?._seconds != null) return ts._seconds * 1000;
  if (ts?.seconds != null) return ts.seconds * 1000;
  const v = new Date(ts).getTime();
  return Number.isFinite(v) ? v : 0;
}

export default function Home() {
  const { data: session, status } = useSession();

  // Programmed workouts
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  // Completions (for weekly goal + detecting today's workout completion)
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

  const selectedWorkouts: WorkoutLite[] = (data?.workouts || []).filter(
    (w: WorkoutLite) => (w.day_name || "").toLowerCase() === selectedDayName.toLowerCase()
  );

  // Windows
  const thisWeekStart = startOfAlignedWeek(today);
  const thisWeekEnd = endOfAlignedWeek(today);

  // Weekly goal (3 sessions/week)
  const weeklyCompletedCount = useMemo(() => {
    return allCompletions.filter((c: any) => {
      const m = toMillis(c.completed_date || c.completed_at || c.started_at);
      return m >= thisWeekStart.getTime() && m <= thisWeekEnd.getTime();
    }).length;
  }, [allCompletions, thisWeekStart, thisWeekEnd]);
  const sessionsAway = Math.max(0, 3 - weeklyCompletedCount);

  // Selected date key (YYYY-MM-DD)
  function formatYMD(d: Date) {
    const n = new Date(d);
    n.setHours(0, 0, 0, 0);
    return n.toISOString().slice(0, 10);
  }
  const selectedDateKey = useMemo(() => formatYMD(selectedDay), [selectedDay]);

  // Nutrition status
  const { data: nutritionForSelected } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${selectedDateKey}` : null,
    fetcher
  );
  const nutritionLogged = (nutritionForSelected?.entries?.length || 0) > 0;

  // Habit status
  const { data: habitForSelected } = useSWR(
    session?.user?.email ? `/api/habits/logs?date=${selectedDateKey}` : null,
    fetcher
  );
  const habitComplete = (habitForSelected?.entries?.length || 0) > 0;

  // Weekly check-in (Fridays only)
  const isFridaySelected = selectedDay.getDay() === 5;
  const { data: checkinForWeek } = useSWR(
    session?.user?.email && isFridaySelected ? `/api/checkins/weekly?week=${formatYMD(selectedDay)}` : null,
    fetcher
  );
  const checkinComplete = !!checkinForWeek?.entry;

  // Today's workout completion
  const hasWorkoutToday = selectedWorkouts.length > 0;
  const workoutIdsToday = selectedWorkouts.map((w: WorkoutLite) => w.id);
  const workoutDoneToday = useMemo(() => {
    if (!hasWorkoutToday) return false;
    return allCompletions.some((c: any) => {
      const completedAt = toMillis(c.completed_date || c.completed_at || c.started_at);
      const completedDate = new Date(completedAt);
      return workoutIdsToday.includes(c.workout_id) && isSameDay(completedDate, selectedDay);
    });
  }, [allCompletions, hasWorkoutToday, workoutIdsToday, selectedDay]);

  // CTA hrefs + icons (Font Awesome)
  const workoutHref =
    hasWorkoutToday && selectedWorkouts[0]?.id ? `/workout/${selectedWorkouts[0].id}` : `/habit?date=${selectedDateKey}`;
  const microHref = workoutHref; // sensible default: start workout if available, else habits
  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHref = `/habit?date=${selectedDateKey}`;
  const checkinHref = `/checkin`;

  const iconMicro = "fas fa-bolt";
  const iconNutrition = "fas fa-utensils";
  const iconWorkout = "fas fa-dumbbell";
  const iconHabit = "fas fa-check-circle";
  const iconCheckin = "fas fa-clipboard-list";
  const crownIcon = "fas fa-crown"; // button icon (as requested; can be changed later)

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{`
          /* Calendar day — minimal, clickable, white numbers, circular outline, neon on active */
          .bxkr-day {
            width: 40px;
            height: 40px;
            line-height: 40px;
            border-radius: 999px;
            margin: 0 auto;
            text-align: center;
            color: #fff;
            border: 2px solid rgba(255,255,255,0.3);
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .bxkr-day:hover { border-color: #ff7f32; }
          .bxkr-day.active {
            border-color: #ff7f32;
            box-shadow: 0 0 8px #ff7f32;
            font-weight: 700;
          }
        `}</style>
      </Head>

      <main
        className="container py-3"
        style={{
          paddingBottom: "70px",
          background: "linear-gradient(135deg,#1a1a1a,#2e1a0f)",
          color: "#fff",
          borderRadius: 12,
        }}
      >
        {/* Header */}
        <div className="d-flex justify-content-between mb-3">
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
          {status === "authenticated" ? (
            <button className="btn btn-link text-light p-0" onClick={() => signOut()}>Sign out</button>
          ) : (
            <button
              className="btn btn-link text-light p-0"
              onClick={() => signIn("google")}
              style={{
                background: "transparent",
                border: "none",
                textDecoration: "underline",
              }}
            >
              Sign in
            </button>
          )}
        </div>

        {/* Greeting */}
        <h2 className="mb-3" style={{ fontWeight: 700, fontSize: "1.6rem" }}>
          {greeting}, {session?.user?.name || "Athlete"}
        </h2>

        {/* Micro-task banner (BXKR banner) */}
        <BxkrBanner
          title="Momentum"
          message={`You’re ${sessionsAway} ${sessionsAway === 1 ? "session" : "sessions"} away from your weekly goal (target: 3/week).`}
          href={microHref}
          iconLeft={iconMicro}
          buttonText="Start"
          buttonIcon={crownIcon}
        />

        {/* Calendar strip (clean) */}
        <div className="d-flex justify-content-between text-center mb-3" style={{ gap: 8 }}>
          {weekDays.map((d, i) => {
            const isSelected = isSameDay(d, selectedDay);
            return (
              <div key={i} style={{ width: 44 }} onClick={() => setSelectedDay(d)}>
                <div style={{ fontSize: "0.8rem", color: "#fff", opacity: 0.85, marginBottom: 4 }}>
                  {dayLabels[i]}
                </div>
                <div className={`bxkr-day ${isSelected ? "active" : ""}`}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Nutrition banner (BXKR banner) */}
        <BxkrBanner
          title="Don’t forget!"
          message="Log today’s meals and macros."
          href={nutritionHref}
          iconLeft={iconNutrition}
          buttonText="Start"
          buttonIcon={crownIcon}
        />

        {/* Workout banner (BXKR banner) */}
        {hasWorkoutToday && (
          <BxkrBanner
            title="Workout"
            message={
              workoutDoneToday
                ? `Completed your ${selectedDayName} session.`
                : `Start your programmed session for ${selectedDayName}.`
            }
            href={workoutHref}
            iconLeft={iconWorkout}
            buttonText={workoutDoneToday ? "View" : "Start"}
            buttonIcon={crownIcon}
          />
        )}

        {/* Habit banner (BXKR banner) */}
        <BxkrBanner
          title="Daily habit"
          message={
            habitComplete
              ? `Habits done for ${selectedDayName}.`
              : `Fill in your daily habit for ${selectedDayName}.`
          }
          href={habitHref}
          iconLeft={iconHabit}
          buttonText={habitComplete ? "Review" : "Fill"}
          buttonIcon={crownIcon}
        />

        {/* Weekly check-in banner (BXKR banner, Fridays only) */}
        {isFridaySelected && (
          <BxkrBanner
            title="Weekly check‑in"
            message={checkinComplete ? "Check‑in submitted." : "Complete your weekly check‑in."}
            href={checkinHref}
            iconLeft={iconCheckin}
            buttonText={checkinComplete ? "Review" : "Check in"}
            buttonIcon={crownIcon}
          />
        )}

        {/* Loaders and errors */}
        {error && <div className="alert alert-danger">Failed to load workouts</div>}
        {isLoading && <div className="alert alert-secondary">Loading…</div>}
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
