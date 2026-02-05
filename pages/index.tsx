// pages/index.tsx
import Head from "next/head";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import { getSession } from "next-auth/react";
import type { GetServerSideProps } from "next";
import DailyTasksCard from "../components/DailyTasksCard";
import WeeklyCircles from "../components/dashboard/WeeklyCircles";
import NotificationsBanner from "../components/NotificationsBanner";
import dayjs from "dayjs";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  if (!session) {
    const callbackUrl = encodeURIComponent(context.resolvedUrl || "/");
    return {
      redirect: { destination: `/register?callbackUrl=${callbackUrl}`, permanent: false },
    };
  }
  return { props: {} };
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

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
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfAlignedWeek(d: Date) {
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s;
}

function fridayOfWeek(d: Date) {
  const s = startOfAlignedWeek(d);
  const f = new Date(s);
  f.setDate(s.getDate() + 4);
  f.setHours(0, 0, 0, 0);
  return f;
}

function round2(n: number | undefined | null) {
  const v = typeof n === "number" ? n : 0;
  return Number(v.toFixed(2));
}

// ------------------- Types -------------------
type SimpleWorkoutRef = { id: string; name?: string };

type CompletedWorkout = {
  workout_id: string;
  date: string; // ISO string
  calories?: number;
  duration?: number;
  weightUsed?: string;
};

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
  checkinSummary?: { weight: number; bodyFat?: number; body_fat_pct?: number; weightChange?: number; bfChange?: number };
  workoutIds?: string[];
  hasRecurringToday?: boolean;
  recurringDone?: boolean;
  recurringWorkouts?: SimpleWorkoutRef[];
  optionalWorkouts?: SimpleWorkoutRef[];
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

type Completion = {
  workout_id?: string;
  completed_date?: string | { toDate?: () => Date };
  calories_burned?: number;
  duration?: number;
  duration_minutes?: number;
  weight_completed_with?: number;
  is_freestyle?: boolean;
  activity_type?: string | null;
  // alternative IDs
  gym_workout_id?: string;
  recurring_workout_id?: string;
  recurring_id?: string;
  assigned_workout_id?: string;
  plan_workout_id?: string;
  rx_id?: string;
};

// ------------------- Main Component -------------------
export default function Home() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const [timeGreeting, setTimeGreeting] = useState<string>("");
  useEffect(() => {
    const h = new Date().getHours();
    setTimeGreeting(h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening");
  }, []);

  const weekDays = useMemo(() => (mounted ? getWeek() : []), [mounted]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const selectedDateKey = formatYMD(selectedDay);

  const weekStartKey = useMemo(() => (mounted ? formatYMD(startOfAlignedWeek(new Date())) : ""), [mounted]);
  const { data: weeklyOverview } = useSWR(weekStartKey ? `/api/weekly/overview?week=${weekStartKey}` : null, fetcher);

  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});

  const deriveDayBooleans = (o: ApiDay) => {
    const isFriday = o.isFriday ?? new Date(o.dateKey + "T00:00:00").getDay() === 5;
    const hasWorkout = Boolean(o.hasWorkout || o.hasRecurringToday || o.recurringWorkouts?.length || o.workoutIds?.length || o.workoutSummary);
    const hasSummary = Boolean(o.workoutSummary && (o.workoutSummary.calories || o.workoutSummary.duration || o.workoutSummary.weightUsed));
    const workoutDone = Boolean(o.workoutDone || o.recurringDone || hasSummary);
    const nutritionLogged = Boolean(o.nutritionLogged);
    const habitAllDone = Boolean(o.habitAllDone || (o.habitSummary?.completed >= o.habitSummary.total && o.habitSummary.total > 0));
    const checkinComplete = Boolean(o.checkinComplete || o.checkinSummary);
    const allDone = (!hasWorkout || workoutDone) && nutritionLogged && habitAllDone && (!isFriday || checkinComplete);
    return { isFriday, hasWorkout, workoutDone, nutritionLogged, habitAllDone, checkinComplete, allDone };
  };

  useEffect(() => {
    if (!weeklyOverview?.days?.length) return;
    const statuses: Record<string, DayStatus> = {};
    for (const o of weeklyOverview.days as ApiDay[]) {
      const b = deriveDayBooleans(o);
      statuses[o.dateKey] = { dateKey: o.dateKey, ...b, workoutIds: o.workoutIds || [] };
    }
    setWeekStatus(statuses);
  }, [weeklyOverview]);

  // ------------------- Fetch completions -------------------
  const completionsKey = useMemo(() => {
    if (!mounted) return null;
    const params = new URLSearchParams();
    params.set("from", selectedDateKey);
    params.set("to", selectedDateKey);
    if (session?.user?.email) params.set("user_email", session.user.email);
    return `/api/completions?${params.toString()}`;
  }, [mounted, selectedDateKey, session?.user?.email]);

  const { data: dayCompletions } = useSWR<{ results?: Completion[] }>(completionsKey, fetcher);

  const dayCompletionList: Completion[] = useMemo(() => {
    return dayCompletions?.results || [];
  }, [dayCompletions]);

  // ------------------- Map Completions -> CompletedWorkout -------------------
  const completedWorkoutsForCard: CompletedWorkout[] = useMemo(() => {
    return dayCompletionList
      .map((c) => {
        if (!c.workout_id) return null;
        const date = typeof c.completed_date === "string" ? c.completed_date : c.completed_date?.toDate?.()?.toISOString();
        if (!date) return null;
        return {
          workout_id: c.workout_id,
          date,
          calories: c.calories_burned,
          duration: c.duration ?? c.duration_minutes,
          weightUsed: typeof c.weight_completed_with === "number" ? `${c.weight_completed_with} kg` : undefined,
        };
      })
      .filter((x): x is CompletedWorkout => x !== null);
  }, [dayCompletionList]);

  // ------------------- Calendar / selected day -------------------
  const selectedStatus = weekStatus[selectedDateKey] || ({} as DayStatus);
  const hasWorkoutToday = Boolean(selectedStatus.hasWorkout);
  const workoutIds = selectedStatus.workoutIds || [];
  const hasWorkoutId = Array.isArray(workoutIds) && workoutIds.length > 0 && typeof workoutIds[0] === "string";

  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHref = `/habit?date=${selectedDateKey}`;
  const checkinHref = `/checkin?date=${encodeURIComponent(formatYMD(fridayOfWeek(selectedDay)))}`;
  const workoutHref = hasWorkoutToday && hasWorkoutId ? `/workout/${encodeURIComponent(workoutIds[0])}` : "#";

  const hrefs = {
    nutrition: nutritionHref,
    workout: workoutHref,
    habit: habitHref,
    checkin: checkinHref,
    freestyle: "/workouts/freestyle",
    recurring: "#",
    optionalWorkout: "#",
  };

  // ------------------- Render -------------------
  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-2" style={{ paddingBottom: "70px", color: "#fff" }}>
        {/* Header */}
        <div className="d-flex justify-content-between mb-2 align-items-center">
          <div className="d-flex align-items-center gap-2">
            {session?.user?.image && (
              <img src={session.user.image} alt="" className="rounded-circle" style={{ width: 36, height: 36 }} />
            )}
            <div>{timeGreeting}</div>
          </div>
          <div>
            {status === "authenticated" ? (
              <button onClick={() => signOut()}>Sign out</button>
            ) : (
              <button onClick={() => signIn("google")}>Sign in</button>
            )}
          </div>
        </div>

        {/* Notifications */}
        <NotificationsBanner />

        {/* Weekly Circles */}
        {weeklyOverview?.days && (
          <WeeklyCircles
            weeklyProgressPercent={0}
            weeklyWorkoutsCompleted={0}
            dayStreak={0}
          />
        )}

        {/* Calendar */}
        <div className="d-flex justify-content-between text-center mb-3">
          {weekDays.map((d, i) => {
            const isSelected = isSameDay(d, selectedDay);
            const dk = formatYMD(d);
            const st = weekStatus[dk];
            return (
              <div key={i} style={{ width: 44, cursor: "pointer" }} onClick={() => setSelectedDay(d)}>
                <div>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</div>
                <div>{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* Daily Tasks */}
        {mounted && (
          <DailyTasksCard
            dayLabel={`${selectedDay.toLocaleDateString(undefined, { weekday: "long" })}, ${selectedDay.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
            nutritionSummary={undefined}
            nutritionLogged={Boolean(selectedStatus.nutritionLogged)}
            workoutSummary={undefined}
            hasWorkout={Boolean(selectedStatus.hasWorkout)}
            workoutDone={Boolean(selectedStatus.workoutDone)}
            recurringWorkouts={[]}
            optionalWorkouts={[]}
            completedWorkouts={completedWorkoutsForCard}
            hrefs={hrefs}
            habitSummary={undefined}
            habitAllDone={Boolean(selectedStatus.habitAllDone)}
            checkinSummary={undefined}
            checkinComplete={Boolean(selectedStatus.checkinComplete)}
          />
        )}

        {mounted && hasWorkoutToday && !hasWorkoutId && <div>Loading workout details…</div>}
      </main>

      <AddToHomeScreen />
      <BottomNav />
    </>
  );
}