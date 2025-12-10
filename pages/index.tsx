
import Head from "next/head";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import BxkrBanner from "../components/BxkrBanner";
import ChallengeBanner from "../components/ChallengeBanner";

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
type WorkoutLite = { id: string; workout_name?: string; notes?: string; day_name?: string };
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
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
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

  // Workouts for the current week
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
  });

  // Completions history (limit to current week to reduce reads)
  const { data: completionData } = useSWR(
    session?.user?.email
      ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}&range=all`
      : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60_000 }
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
  const weekDays = useMemo(() => getWeek(), []); // ✅ Memoized (prevents loop)
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

  // ---------- NEW: Weekly overview in one call (reduces 7+7+1 calls)
  const { data: weeklyOverview, isLoading: overviewLoading } = useSWR(
    session?.user?.email ? `/api/weekly/overview?week=${selectedDateKey}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60_000 }
  );

  // Week status + loader displayed in header
  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});
  const [weekLoading, setWeekLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!session?.user?.email || !data?.workouts) return;

    // Start loading while we compute/merge
    setWeekLoading(true);

    // Step 1: base status = hasWorkout + workoutDone (client-side only, no extra network)
    const workouts = (data?.workouts || []) as WorkoutLite[];
    const statuses: Record<string, DayStatus> = {};
    const dayName = (d: Date) => d.toLocaleDateString(undefined, { weekday: "long" });

    for (const d of weekDays) {
      const dk = formatYMD(d);
      const dn = dayName(d);
      const dayWorkouts = workouts.filter((w) => (w.day_name || "").toLowerCase() === dn.toLowerCase());
      const hasWorkout = dayWorkouts.length > 0;
      const ids = dayWorkouts.map((w) => w.id);
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
        allDone: false,
      };
    }

    // Step 2: merge weeklyOverview (nutrition/habits/check-in in one payload

    if (weeklyOverview?.days?.length) {
      for (const o of weeklyOverview.days as any[]) {
        const s = statuses[o.dateKey];
        if (!s) continue;
    
        const nutritionLogged = !!o.nutritionLogged;
        const habitAllDone = !!o.habitAllDone;
        const isFriday = !!o.isFriday;
        const checkinComplete = !!o.checkinComplete;
    
        // Build task list based on what is required every day
        const tasks: boolean[] = [];
    
        // Workout is required if scheduled
        if (s.hasWorkout) tasks.push(s.workoutDone);
    
        // Nutrition and habits are always required (per your note)
        tasks.push(nutritionLogged);
        tasks.push(habitAllDone);
    
        // Check-in only on Friday
        if (isFriday) tasks.push(checkinComplete);
    
        // All done only if every task is true
        const allDone = tasks.every(Boolean);
    
        statuses[o.dateKey] = {
          ...s,
          nutritionLogged,
          habitAllDone,
          isFriday,
          checkinComplete,
          allDone,
        };
      }
    }

 else {
      // Without overview yet, still allow dots for outstanding workouts
      for (const dk of Object.keys(statuses)) {
        const s = statuses[dk];
        const anyOutstanding =
          !s.nutritionLogged ||
          (s.hasWorkout && !s.workoutDone) ||
          !s.habitAllDone ||
          (s.isFriday && !s.checkinComplete);
        statuses[dk] = { ...s, allDone: !anyOutstanding };
      }
    }

    setWeekStatus(statuses);
    setWeekLoading(false);
  }, [session?.user?.email, data?.workouts, allCompletions, weeklyOverview, weekDays]);

  // Hrefs
  const workoutHref =
    hasWorkoutToday && selectedWorkouts[0]?.id ? `/workout/${selectedWorkouts[0].id}` : `/habit?date=${selectedDateKey}`;
  const microHref = workoutHref;
  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHref = `/habit?date=${selectedDateKey}`;
  const checkinHref = `/checkin`;

  // Icons (kept)
  const iconMicro = "fas fa-bolt";
  const iconNutrition = "fas fa-utensils";
  const iconWorkout = "fas fa-dumbbell";
  const iconHabit = "fas fa-check-circle";
  const iconCheckin = "fas fa-clipboard-list";

  // Muted theme colours (kept)
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
      </Head>

      <main
        className="container py-3"
        style={{
          paddingBottom: "70px",
          color: "#fff",
          borderRadius: 12,
        }}
      >
        {/* Header with inline loader */}
        <div className="d-flex justify-content-between mb-3 align-items-center">
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
            {(weekLoading || overviewLoading) && <div className="inline-spinner" />}
          </div>
          {status === "authenticated" ? (
            <button className="btn btn-link text-light p-0" onClick={() => signOut()}>
              Sign out
            </button>
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

        {/* Momentum */}
        <ChallengeBanner
          title="New Challenge"
          message="2 Weeks of Energy"
          href="/challenge"
          iconLeft="fas fa-crown"
          accentColor="#ffcc00"
        />


        {/* Calendar */}
        <div className="d-flex justify-content-between text-center mb-3" style={{ gap: 8 }}>
          {weekDays.map((d, i) => {
            const isSelected = isSameDay(d, selectedDay);
            const dk = formatYMD(d);
            const status = weekStatus[dk];

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
                {/* circle pill (global CSS defines size/shape) */}
                
                <div
                  className={`bxkr-day-pill ${status?.allDone ? "completed" : ""}`}
                  style={{
                    boxShadow,
                    fontWeight: isSelected ? 600 : 400,
                    borderColor: status?.allDone ? undefined : ringColor
                  }}
                >
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

        {/* Banners */}
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
        {isFridaySelected && !checkinComplete && (
          <BxkrBanner
            title="Weekly check‑in"
            message="Complete your weekly check‑in."
            href={checkinHref}
            iconLeft={iconCheckin}
            accentColor={accentCheckin}
            buttonText="Check in"
          />
        )}

        {error && <div className="alert alert-danger">Failed to load workouts</div>}
        {isLoading && <div className="alert alert-secondary">Loading…</div>}
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
