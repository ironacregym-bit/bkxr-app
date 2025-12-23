import Head from "next/head";
import useSWR from "swr";
import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import ChallengeBanner from "../components/ChallengeBanner";
import DailyTasksCard from "../components/DailyTasksCard";

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

/* ---------------- Date helpers ---------------- */

function getWeek(): Date[] {
  const today = new Date();
  const day = today.getDay();
  const diffToMon = (day + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMon);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}
function formatYMD(d: Date) {
  return d.toLocaleDateString("en-CA");
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

/* ---------------- Types ---------------- */

type ApiDay = {
  dateKey: string;
  hasWorkout?: boolean;
  workoutDone?: boolean;
  nutritionLogged?: boolean;
  habitAllDone?: boolean;
  isFriday?: boolean;
  checkinComplete?: boolean;
  nutritionSummary?: { calories: number; protein: number };
  workoutSummary?: { calories: number; duration: number; weightUsed?: string };
  habitSummary?: { completed: number; total: number };
  checkinSummary?: {
    weight: number;
    body_fat_pct: number;
    weightChange?: number;
    bfChange?: number;
  };
  workoutIds?: string[];
};

type DayStatus = {
  dateKey: string;
  hasWorkout: boolean;
  workoutDone: boolean;
  nutritionLogged: boolean;
  habitAllDone: boolean;
  isFriday: boolean;
  checkinComplete: boolean;
  allDone: boolean;
  workoutIds: string[];
};

/* ---------------- Home ---------------- */

export default function Home() {
  const { data: session, status } = useSession();
  const accent = "#ff8a2a";

  const weekDays = useMemo(() => getWeek(), []);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";
  })();

  const selectedDateKey = formatYMD(selectedDay);
  const weekStartKey = useMemo(
    () => formatYMD(startOfAlignedWeek(new Date())),
    []
  );

  const { data: weeklyOverview, isLoading } = useSWR(
    `/api/weekly/overview?week=${weekStartKey}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});

  const deriveDayBooleans = (o: any) => {
    const isFriday =
      Boolean(o.isFriday) ||
      new Date(o.dateKey + "T00:00:00").getDay() === 5;

    const hasWorkout =
      Boolean(o.hasWorkout) ||
      Boolean(o.workoutIds?.length) ||
      Boolean(o.workoutSummary);

    const workoutDone =
      Boolean(o.workoutDone) ||
      Boolean(o.workoutSummary);

    const nutritionLogged = Boolean(o.nutritionLogged);

    const habitAllDone =
      Boolean(o.habitAllDone) ||
      (o.habitSummary
        ? o.habitSummary.completed >= o.habitSummary.total &&
          o.habitSummary.total > 0
        : false);

    const checkinComplete =
      Boolean(o.checkinComplete) || Boolean(o.checkinSummary);

    const allDone =
      (!hasWorkout || workoutDone) &&
      nutritionLogged &&
      habitAllDone &&
      (!isFriday || checkinComplete);

    return {
      isFriday,
      hasWorkout,
      workoutDone,
      nutritionLogged,
      habitAllDone,
      checkinComplete,
      allDone,
    };
  };

  useEffect(() => {
    if (!weeklyOverview?.days) return;
    const next: Record<string, DayStatus> = {};
    for (const d of weeklyOverview.days as ApiDay[]) {
      const b = deriveDayBooleans(d);
      next[d.dateKey] = {
        dateKey: d.dateKey,
        ...b,
        workoutIds: Array.isArray(d.workoutIds) ? d.workoutIds : [],
      };
    }
    setWeekStatus(next);
  }, [weeklyOverview]);

  /* ---------------- Motivation logic ---------------- */

  const dayStreak = useMemo(() => {
    let streak = 0;
    for (const d of weekDays) {
      const st = weekStatus[formatYMD(d)];
      if (!st) break;
      if (d < selectedDay && st.allDone) streak++;
      else if (d < selectedDay && !st.allDone) streak = 0;
      if (isSameDay(d, selectedDay)) break;
    }
    return streak;
  }, [weekDays, weekStatus, selectedDay]);

  const derivedWeeklyTotals = useMemo(() => {
    const days = weeklyOverview?.days || [];
    let total = 0;
    let done = 0;
    for (const d of days) {
      const b = deriveDayBooleans(d);
      total += 1 + 1 + (b.hasWorkout ? 1 : 0) + (b.isFriday ? 1 : 0);
      done +=
        (b.nutritionLogged ? 1 : 0) +
        (b.habitAllDone ? 1 : 0) +
        (b.hasWorkout && b.workoutDone ? 1 : 0) +
        (b.isFriday && b.checkinComplete ? 1 : 0);
    }
    return { total, done };
  }, [weeklyOverview]);

  const compliance =
    derivedWeeklyTotals.total > 0
      ? Math.round((derivedWeeklyTotals.done / derivedWeeklyTotals.total) * 100)
      : 0;

  const selectedStatus = weekStatus[selectedDateKey] || ({} as DayStatus);

  const todayWin = selectedStatus.allDone
    ? "Day locked in. Momentum protected."
    : selectedStatus.hasWorkout && !selectedStatus.workoutDone
    ? "Complete your workout"
    : !selectedStatus.nutritionLogged
    ? "Log your nutrition"
    : !selectedStatus.habitAllDone
    ? "Complete daily habits"
    : "Finish today strong";

  /* ---------------- Render ---------------- */

  return (
    <>
      <Head>
        <title>BXKR</title>
      </Head>

      <main className="container py-2" style={{ paddingBottom: 70, color: "#fff" }}>
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="d-flex align-items-center gap-2">
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt=""
                className="rounded-circle"
                style={{ width: 36, height: 36 }}
              />
            )}
            {isLoading && <div className="inline-spinner" />}
          </div>
          {status === "authenticated" ? (
            <button
              className="btn btn-link text-light p-0"
              onClick={() => signOut()}
            >
              Sign out
            </button>
          ) : (
            <button
              className="btn btn-link text-light p-0"
              onClick={() => signIn("google")}
            >
              Sign in
            </button>
          )}
        </div>

        {/* Greeting */}
        <h2 style={{ fontWeight: 700 }}>{greeting}</h2>

        {/* 🔥 Motivation Card */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(255,138,42,.2), rgba(255,138,42,.08))",
            borderRadius: 12,
            padding: 14,
            marginBottom: 14,
            boxShadow: `0 0 16px rgba(255,138,42,.25)`,
          }}
        >
          <div style={{ fontWeight: 700 }}>
            🔥 {dayStreak} Day Consistency Run
          </div>
          <div style={{ fontSize: "0.9rem", marginTop: 4 }}>
            {todayWin}
          </div>
        </div>

        {/* Weekly Compliance */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>Weekly Compliance</div>
          <div
            style={{
              background: "#333",
              borderRadius: 8,
              overflow: "hidden",
              height: 10,
              marginTop: 6,
            }}
          >
            <div
              style={{
                width: `${compliance}%`,
                background: accent,
                height: "100%",
              }}
            />
          </div>
          <div style={{ fontSize: "0.85rem", marginTop: 4 }}>
            {compliance}% adherence this week
          </div>
        </div>

        {/* Snapshot */}
        <ChallengeBanner
          title="Weekly Snapshot"
          message={
            <div className="stats-row">
              <div className="stats-col">
                <strong>Workouts</strong>
                {weeklyOverview?.weeklyTotals?.totalWorkoutsCompleted ?? 0}
              </div>
              <div className="stats-col">
                <strong>Time</strong>
                {weeklyOverview?.weeklyTotals?.totalWorkoutTime ?? 0}m
              </div>
              <div className="stats-col">
                <strong>Calories</strong>
                {weeklyOverview?.weeklyTotals?.totalCaloriesBurned ?? 0}
              </div>
            </div>
          }
          showButton={false}
        />

        {/* Calendar + Tasks remain unchanged */}
      {selectedDayData && (
  <DailyTasksCard
    dayLabel={`${selectedDay.toLocaleDateString(undefined, {
      weekday: "long",
    })}, ${selectedDay.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    })}`}
    nutritionSummary={selectedDayData.nutritionSummary}
    nutritionLogged={Boolean(selectedStatus.nutritionLogged)}
    workoutSummary={selectedDayData.workoutSummary}
    hasWorkout={Boolean(selectedStatus.hasWorkout)}
    workoutDone={Boolean(selectedStatus.workoutDone)}
    habitSummary={selectedDayData.habitSummary}
    habitAllDone={Boolean(selectedStatus.habitAllDone)}
    checkinSummary={checkinSummaryNormalized as any}
    checkinComplete={Boolean(selectedStatus.checkinComplete)}
    hrefs={{
      nutrition: nutritionHref,
      workout: workoutHref,
      habit: habitHref,
      checkin: checkinHref,
    }}
  />
)}
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}