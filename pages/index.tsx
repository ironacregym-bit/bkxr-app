
import Head from "next/head";
import useSWR from "swr";
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

// ---------- Types
type WorkoutLite = { id: string; workout_name?: string; notes?: string; day_name?: string; };
type DayStatus = {
  dateKey: string;
  hasWorkout: boolean;
  workoutDone: boolean;
  nutritionLogged: boolean;
  habitAllDone: boolean;
  isFriday: boolean;
  checkinComplete: boolean;
  allDone: boolean;
};

// ---------- Helpers
function getWeek(): Date[] {
  const today = new Date();
  const day = today.getDay();
  const diffToMon = (day + 6) % 7; // Monday start
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}
function formatYMD(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n.toISOString().slice(0, 10);
}
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
// Firestore-safe timestamp normalisation
function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts?._seconds != null) return ts._seconds * 1000;
  if (ts?.seconds != null) return ts.seconds * 1000;
  const v = new Date(ts).getTime();
  return Number.isFinite(v) ? v : 0;
}

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Home() {
  const { data: session, status } = useSession();

  // Programmed workouts for all time (used to decide hasWorkout per weekday)
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  // Completions (for weekly goal + “done today” detection)
  const { data: completionData } = useSWR(
    session?.user?.email
      ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}&range=all`
      : null,
    fetcher
  );
  const allCompletions = (completionData?.history || []) as any[];

  // Upsert user record (preserved)
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

  // Calendar state
  const weekDays = getWeek();
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  // Greeting
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const selectedDayName = selectedDay.toLocaleDateString(undefined, { weekday: "long" });

  // Workouts for selected day
  const selectedWorkouts: WorkoutLite[] = (data?.workouts || []).filter(
    (w: WorkoutLite) => (w.day_name || "").toLowerCase() === selectedDayName.toLowerCase()
  );

  // Weekly windows + goal
  const thisWeekStart = startOfAlignedWeek(today);
  const thisWeekEnd = endOfAlignedWeek(today);
  const weeklyCompletedCount = useMemo(() => {
    return allCompletions.filter((c: any) => {
      const m = toMillis(c.completed_date || c.completed_at || c.started_at);
      return m >= thisWeekStart.getTime() && m <= thisWeekEnd.getTime();
    }).length;
  }, [allCompletions, thisWeekStart, thisWeekEnd]);
  const sessionsAway = Math.max(0, 3 - weeklyCompletedCount);

  // Selected date key (YYYY-MM-DD)
  const selectedDateKey = formatYMD(selectedDay);

  // Selected-day statuses (for banners)
  const { data: nutritionForSelected } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${selectedDateKey}` : null,
    fetcher
  );
  const nutritionLogged = (nutritionForSelected?.entries?.length || 0) > 0;

  type HabitEntry = {
    id: string; user_email: string; date: any;
    "2l_water": boolean; assigned_workouts_completed: boolean;
    macros_filled: boolean; step_count: boolean; time_outside: boolean;
  };
  const { data: habitForSelected } = useSWR(
    session?.user?.email ? `/api/habits/logs?date=${selectedDateKey}` : null,
    fetcher
  );
  const habitEntry: HabitEntry | null = habitForSelected?.entry || null;
  const habitAllDone =
    !!habitEntry &&
    !!habitEntry["2l_water"] &&
    !!habitEntry.assigned_workouts_completed &&
    !!habitEntry.macros_filled &&
    !!habitEntry.step_count &&
    !!habitEntry.time_outside;

  const isFridaySelected = selectedDay.getDay() === 5;
  const { data: checkinForWeek } = useSWR(
    session?.user?.email && isFridaySelected ? `/api/checkins/weekly?week=${selectedDateKey}` : null,
    fetcher
  );
  const checkinComplete = !!checkinForWeek?.entry;

  // Workout completion for selected day
  const hasWorkoutToday = selectedWorkouts.length > 0;
  const workoutIdsToday = selectedWorkouts.map((w) => w.id);
  const workoutDoneToday = useMemo(() => {
    if (!hasWorkoutToday) return false;
    return allCompletions.some((c: any) => {
      const completedAt = toMillis(c.completed_date || c.completed_at || c.started_at);
      const completedDate = new Date(completedAt);
      return workoutIdsToday.includes(c.workout_id) && isSameDay(completedDate, selectedDay);
    });
  }, [allCompletions, hasWorkoutToday, workoutIdsToday, selectedDay]);

  // Outstanding tasks (selected day)
  const outstandingNutrition = !nutritionLogged;
  const outstandingWorkout = hasWorkoutToday && !workoutDoneToday;
  const outstandingHabit = !habitAllDone;
  const outstandingCheckin = isFridaySelected && !checkinComplete;
  const allTasksDoneSelectedDay =
    !(outstandingNutrition || outstandingWorkout || outstandingHabit || outstandingCheckin);

  // --------- NEW: compute per‑day status for the whole week (parallel)
  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});
  const [weekLoading, setWeekLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    async function buildWeekStatus() {
      if (!session?.user?.email) {
        setWeekStatus({});
        return;
      }
      setWeekLoading(true);
      const workouts = (data?.workouts || []) as WorkoutLite[];
      const statuses: Record<string, DayStatus> = {};

      // Precompute hasWorkout/workoutDone purely client-side (no network)
      const dayName = (d: Date) => d.toLocaleDateString(undefined, { weekday: "long" });
      for (const d of weekDays) {
        const dk = formatYMD(d);
        const dn = dayName(d);
        const dayWorkouts = workouts.filter(w => (w.day_name || "").toLowerCase() === dn.toLowerCase());
        const hasWorkout = dayWorkouts.length > 0;
        const ids = dayWorkouts.map(w => w.id);
        const workoutDone = allCompletions.some((c: any) => {
          const m = toMillis(c.completed_date || c.completed_at || c.started_at);
          if (!m) return false;
          const completedDate = new Date(m);
          return ids.includes(c.workout_id) && isSameDay(completedDate, d);
        });
        statuses[dk] = {
          dateKey: dk,
          hasWorkout,
          workoutDone,
          nutritionLogged: false,
          habitAllDone: false,
          isFriday: d.getDay() === 5,
          checkinComplete: false,
          allDone: false, // will be updated after network calls
        };
      }

      // Fetch nutrition + habits + (Friday) check-ins for all days in PARALLEL
      const perDayPromises = weekDays.map(async (d) => {
        const dk = formatYMD(d);
        const isFri = d.getDay() === 5;
        const nutritionP = fetch(`/api/nutrition/logs?date=${dk}`).then(r => r.json()).catch(() => null);
        const habitsP    = fetch(`/api/habits/logs?date=${dk}`).then(r => r.json()).catch(() => null);
        const checkinP   = isFri ? fetch(`/api/checkins/weekly?week=${dk}`).then(r => r.json()).catch(() => null) : Promise.resolve(null);

        const [nutrition, habits, checkin] = await Promise.allSettled([nutritionP, habitsP, checkinP]);
        const nutritionLogged = nutrition.status === "fulfilled" ? ((nutrition.value?.entries?.length || 0) > 0) : false;

        const e = habits.status === "fulfilled" ? habits.value?.entry || null : null;
        const habitAllDone =
          !!e && !!e["2l_water"] && !!e.assigned_workouts_completed &&
          !!e.macros_filled && !!e.step_count && !!e.time_outside;

        const checkinDone = isFri && checkin.status === "fulfilled" ? !!checkin.value?.entry : false;

        const s = statuses[dk];
        const anyOutstanding =
          !nutritionLogged ||
          (s.hasWorkout && !s.workoutDone) ||
          !habitAllDone ||
          (s.isFriday && !checkinDone);

        statuses[dk] = {
          ...s,
          nutritionLogged,
          habitAllDone,
          checkinComplete: checkinDone,
          allDone: !anyOutstanding,
        };
      });

      await Promise.all(perDayPromises);

      if (!cancelled) {
        setWeekStatus(statuses);
        setWeekLoading(false);
      }
    }
    buildWeekStatus();
    return () => { cancelled = true; };
  }, [session?.user?.email, data?.workouts, allCompletions, weekDays]);

  // Hrefs
  const workoutHref =
    hasWorkoutToday && selectedWorkouts[0]?.id ? `/workout/${selectedWorkouts[0].id}` : `/habit?date=${selectedDateKey}`;
  const microHref = workoutHref; // Momentum CTA
  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHref = `/habit?date=${selectedDateKey}`;
  const checkinHref = `/checkin`;

  // Icons
  const iconMicro = "fas fa-bolt";
  const iconNutrition = "fas fa-utensils";
  const iconWorkout = "fas fa-dumbbell";
  const iconHabit = "fas fa-check-circle";
  const iconCheckin = "fas fa-clipboard-list";

  // Muted theme colours
  const accentMicro = "#d97a3a";    // orange
  const accentNutrition = "#4fa3a5"; // teal
  const accentWorkout = "#5b7c99";   // steel blue
  const accentHabit = "#9b6fa3";     // violet
  const accentCheckin = "#c9a34e";   // amber
  const ringGreenStrong = "#64c37a"; // selected completed
  const ringGreenMuted  = "#4ea96a"; // non-selected completed

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{`
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
            font-weight: 500;
          }
          .bxkr-dots {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 4px;
            margin-top: 4px;
            height: 10px;
          }
          .bxkr-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            display: inline-block;
            box-shadow: 0 0 6px currentColor;
          }
          /* Fullscreen loading overlay while week status builds */
          .overlay {
            position: fixed; inset: 0; z-index: 999;
            display: ${weekLoading ? "flex" : "none"};
            align-items: center; justify-content: center;
            background: rgba(0,0,0,0.35);
            backdrop-filter: blur(3px);
          }
          .spinner {
            width: 34px; height: 34px; border-radius: 50%;
            border: 3px solid rgba(255,255,255,0.25);
            border-top-color: ${accentMicro};
            animation: spin .8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </Head>

      {/* Loading overlay */}
      <div className="overlay"><div className="spinner" /></div>

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
              style={{ background: "transparent", border: "none", textDecoration: "underline" }}
            >
              Sign in
            </button>
          )}
        </div>

        {/* Greeting */}
        <h2 className="mb-3" style={{ fontWeight: 700, fontSize: "1.6rem" }}>
          {greeting}, {session?.user?.name || "Athlete"}
        </h2>

        {/* Momentum (weekly goal) */}
        <BxkrBanner
          title="Momentum"
          message={`You’re ${sessionsAway} ${sessionsAway === 1 ? "session" : "sessions"} away from your weekly goal (target: 3/week).`}
          href={microHref}
          iconLeft={iconMicro}
          accentColor={accentMicro}
          buttonText="Start"
        />

        {/* Calendar strip */}
        <div className="d-flex justify-content-between text-center mb-3" style={{ gap: 8 }}>
          {weekDays.map((d, i) => {
            const isSelected = isSameDay(d, selectedDay);
            const dk = formatYMD(d);
            const status = weekStatus[dk];

            // Decide ring colour
            const ringColor = status?.allDone
              ? (isSelected ? ringGreenStrong : ringGreenMuted)
              : (isSelected ? accentMicro : "rgba(255,255,255,0.3)");

            const boxShadow = isSelected
              ? `0 0 8px ${ringColor}`
              : (status?.allDone ? `0 0 3px ${ringColor}` : "none");

            return (
              <div
                key={i}
                style={{ width: 44, cursor: "pointer" }}
                onClick={() => setSelectedDay(d)}
                aria-label={`Select ${dayLabels[i]} ${d.getDate()}`}
                title={`${dayLabels[i]} ${d.toLocaleDateString()}`}
              >
                <div style={{ fontSize: "0.8rem", color: "#fff", opacity: 0.85, marginBottom: 4 }}>
                  {dayLabels[i]}
                </div>
                <div className="bxkr-day" style={{ borderColor: ringColor, boxShadow, fontWeight: isSelected ? 700 : 500 }}>
                  {d.getDate()}
                </div>

                {/* Dots: outstanding signals */}
                <div className="bxkr-dots">
                  {status?.hasWorkout && !status?.workoutDone && (
                    <span
                      className="bxkr-dot"
                      style={{ color: accentWorkout, backgroundColor: accentWorkout }}
                      aria-label="Workout outstanding"
                      title="Workout outstanding"
                    />
                  )}
                  {status?.isFriday && !status?.checkinComplete && (
                    <span
                      className="bxkr-dot"
                      style={{ color: accentCheckin, backgroundColor: accentCheckin }}
                      aria-label="Weekly check‑in outstanding"
                      title="Weekly check‑in outstanding"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Nutrition — hide when completed (selected day) */}
        {!nutritionLogged && (
          <BxkrBanner
            title="Nutrition"
            message="Log today’s meals and macros."
            href={nutritionHref}
            iconLeft={iconNutrition}
            accentColor={accentNutrition}
            buttonText="Start"
          />
        )}

        {/* Workout — hide when completed (selected day) */}
        {hasWorkoutToday && !workoutDoneToday && (
          <BxkrBanner
            title="Workout"
            message={`Start your programmed session for ${selectedDayName}.`}
            href={workoutHref}
            iconLeft={iconWorkout}
            accentColor={accentWorkout}
            buttonText="Start"
          />
        )}

        {/* Daily Habit — only when not fully complete (selected day) */}
        {!habitAllDone && (
          <BxkrBanner
            title="Daily habit"
            message={`Fill in your daily habit for ${selectedDayName}.`}
            href={habitHref}
            iconLeft={iconHabit}
            accentColor={accentHabit}
            buttonText="Fill"
          />
        )}

        {/* Weekly check‑in — Fridays only; hide when completed (selected day) */}
        {isFridaySelected && !checkinComplete && (
          <BxkrBanner
            title="Weekly check‑in"
            message={"Complete your weekly check‑in."}
            href={checkinHref}
            iconLeft={iconCheckin}
            accentColor={accentCheckin}
            buttonText={"Check in"}
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
