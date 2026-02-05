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

// --- Utilities (date helpers) ---
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
function round2(n: number | undefined | null): number {
  return typeof n === "number" ? Number(n.toFixed(2)) : 0;
}

// --- Types ---
type SimpleWorkoutRef = { id: string; name?: string };

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
  checkinSummary?: { weight: number; bodyFat?: number; weightChange?: number; bfChange?: number };
  hasRecurringToday?: boolean;
  recurringDone?: boolean;
  recurringWorkouts?: SimpleWorkoutRef[];
  optionalWorkouts?: SimpleWorkoutRef[];
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

type Completion = {
  id?: string;
  workout_id?: string;
  is_freestyle?: boolean;
  activity_type?: string | null;
  duration_minutes?: number | null;
  duration?: number | null;
  calories_burned?: number | null;
  weight_completed_with?: number | null;
  completed_date?: string | { toDate?: () => Date };
  gym_workout_id?: string;
  recurring_workout_id?: string;
  recurring_id?: string;
  assigned_workout_id?: string;
  plan_workout_id?: string;
  rx_id?: string;
};

// --- Component ---
export default function Home() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});
  const [weekLoading, setWeekLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  const timeGreeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";
  }, []);

  const weekDays = useMemo(() => (mounted ? getWeek() : []), [mounted]);
  const selectedDateKey = formatYMD(selectedDay);
  const weekStartKey = useMemo(() => (mounted ? formatYMD(startOfAlignedWeek(new Date())) : ""), [mounted]);

  // --- Fetch weekly overview ---
  const { data: weeklyOverview } = useSWR(
    weekStartKey ? `/api/weekly/overview?week=${weekStartKey}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // --- Completions ---
  const completionsKey = useMemo(() => {
    if (!mounted || !session?.user?.email) return null;
    const params = new URLSearchParams();
    params.set("from", selectedDateKey);
    params.set("to", selectedDateKey);
    params.set("user_email", session.user.email);
    return `/api/completions?${params.toString()}`;
  }, [mounted, selectedDateKey, session?.user?.email]);

  const { data: dayCompletions } = useSWR<{ results?: Completion[]; items?: Completion[]; completions?: Completion[]; data?: Completion[] }>(
    completionsKey,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const dayCompletionList: Completion[] = useMemo(() => {
    const src =
      dayCompletions?.results ||
      dayCompletions?.items ||
      dayCompletions?.completions ||
      dayCompletions?.data ||
      [];
    return Array.isArray(src) ? src : [];
  }, [dayCompletions]);

  // --- Selected day data ---
  const selectedDayData: ApiDay | undefined = useMemo(() => {
    if (!weeklyOverview?.days) return undefined;
    return (weeklyOverview.days as ApiDay[]).find((d) => d.dateKey === selectedDateKey);
  }, [weeklyOverview, selectedDateKey]);

  const selectedStatus = weekStatus[selectedDateKey] || ({} as DayStatus);

  // --- Hrefs ---
  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHref = `/habit?date=${selectedDateKey}`;
  const checkinHref = `/checkin?date=${encodeURIComponent(formatYMD(fridayOfWeek(selectedDay)))}`;

  const firstRecurring = selectedDayData?.recurringWorkouts?.[0];
  const firstOptional = selectedDayData?.optionalWorkouts?.[0];

  const hrefs = {
    nutrition: nutritionHref,
    workout: selectedDayData?.workoutIds?.[0] ? `/workout/${encodeURIComponent(selectedDayData.workoutIds[0])}` : "#",
    habit: habitHref,
    checkin: checkinHref,
    freestyle: "/workouts/freestyle",
    recurring: selectedDayData?.hasRecurringToday && firstRecurring ? `/gymworkout/${encodeURIComponent(firstRecurring.id)}` : "#",
    optionalWorkout: firstOptional ? `/workout/${encodeURIComponent(firstOptional.id)}` : "#",
  };

  // --- Normalize check-in ---
  const checkinSummaryNormalized = selectedDayData?.checkinSummary
    ? {
        ...selectedDayData.checkinSummary,
        bodyFat: selectedDayData.checkinSummary.bodyFat ?? selectedDayData.checkinSummary.bodyFat,
      }
    : undefined;

  // --- Workout summary ---
  const workoutSummaryForCard = selectedDayData?.workoutSummary;

  return (
    <>
      <Head>
        <title>BXKR</title>
      </Head>

      <main className="container py-2" style={{ paddingBottom: "70px", color: "#fff" }}>
        {/* Notifications */}
        <NotificationsBanner />

        {/* Weekly Circles */}
        {weeklyOverview?.days && mounted && (
          <WeeklyCircles weeklyProgressPercent={0} weeklyWorkoutsCompleted={0} dayStreak={0} />
        )}

        {/* Daily Tasks Card */}
        {mounted && selectedDayData && (
          <DailyTasksCard
            dayLabel={`${selectedDay.toLocaleDateString(undefined, { weekday: "long" })}, ${selectedDay.toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}`}
            nutritionSummary={selectedDayData.nutritionSummary}
            nutritionLogged={Boolean(selectedStatus.nutritionLogged)}
            workoutSummary={workoutSummaryForCard}
            hasWorkout={Boolean(selectedStatus.hasWorkout)}
            workoutDone={Boolean(selectedStatus.workoutDone)}
            hasRecurringToday={Boolean(selectedDayData.hasRecurringToday)}
            recurringDone={Boolean(selectedDayData.recurringDone)}
            recurringWorkouts={selectedDayData.recurringWorkouts || []}
            optionalWorkouts={selectedDayData.optionalWorkouts || []}
            completedWorkouts={dayCompletionList}
            hrefs={hrefs}
            habitSummary={selectedDayData.habitSummary}
            habitAllDone={Boolean(selectedStatus.habitAllDone)}
            checkinSummary={checkinSummaryNormalized as any}
            checkinComplete={Boolean(selectedStatus.checkinComplete)}
            freestyleLogged={false}
          />
        )}
      </main>

      {mounted && <AddToHomeScreen />}
      <BottomNav />
    </>
  );
}