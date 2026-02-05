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

function fridayOfWeek(d: Date) {
  const s = startOfAlignedWeek(d);
  const f = new Date(s);
  f.setDate(s.getDate() + 4);
  f.setHours(0, 0, 0, 0);
  return f;
}

function round2(n: number | undefined | null): number {
  const v = typeof n === "number" ? n : 0;
  return Number(v.toFixed(2));
}

type SimpleWorkoutRef = { id: string; name?: string };

type CompletedWorkout = {
  workout_id: string;
  date: string;
  calories?: number;
  duration?: number;
  weightUsed?: string;
};

type PropsDay = {
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
  checkinSummary?: { weight: number; body_fat_pct: number; weightChange?: number; bfChange?: number };
  workoutIds?: string[];
  hasRecurringToday?: boolean;
  recurringDone?: boolean;
  recurringWorkouts?: SimpleWorkoutRef[];
  optionalWorkouts?: SimpleWorkoutRef[];
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

  const { data: weeklyOverview } = useSWR(
    weekStartKey ? `/api/weekly/overview?week=${weekStartKey}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const { data: profile } = useSWR(
    mounted && session?.user?.email ? `/api/profile?email=${encodeURIComponent(session.user.email)}` : null,
    fetcher
  );

  const { data: onboarding } = useSWR(
    mounted && session?.user?.email ? "/api/onboarding/status" : null,
    fetcher
  );

  const [weekStatus, setWeekStatus] = useState<Record<string, PropsDay>>({});

  const deriveDayBooleans = (o: PropsDay) => {
    const isFriday = Boolean(o.isFriday ?? new Date(o.dateKey + "T00:00:00").getDay() === 5);
    const hasWorkout = Boolean(o.hasWorkout) || Boolean(o.hasRecurringToday) || Boolean(o.recurringWorkouts?.length) || Boolean(o.workoutIds?.length) || Boolean(o.workoutSummary);
    const hasSummary = Boolean(o.workoutSummary && (o.workoutSummary.calories || o.workoutSummary.duration || o.workoutSummary.weightUsed));
    const workoutDone = Boolean(o.workoutDone) || Boolean(o.recurringDone) || hasSummary;
    const nutritionLogged = Boolean(o.nutritionLogged);
    const habitAllDone = Boolean(o.habitAllDone) || (o.habitSummary ? o.habitSummary.completed >= o.habitSummary.total && o.habitSummary.total > 0 : false);
    const checkinComplete = Boolean(o.checkinComplete) || Boolean(o.checkinSummary);
    const allDone = (!hasWorkout || workoutDone) && nutritionLogged && habitAllDone && (!isFriday || checkinComplete);
    return { isFriday, hasWorkout, workoutDone, nutritionLogged, habitAllDone, checkinComplete, allDone };
  };

  useEffect(() => {
    if (!weeklyOverview?.days?.length) return;
    const statuses: Record<string, PropsDay> = {};
    for (const o of weeklyOverview.days as PropsDay[]) {
      const b = deriveDayBooleans(o);
      statuses[o.dateKey] = { ...o, ...b };
    }
    setWeekStatus(statuses);
  }, [weeklyOverview]);

  const selectedDayData = useMemo(() => {
    if (!weeklyOverview?.days) return undefined;
    return (weeklyOverview.days as PropsDay[]).find((d) => d.dateKey === selectedDateKey);
  }, [weeklyOverview, selectedDateKey]);

  // ------------------- Day completions -------------------
  const completionsKey = useMemo(() => {
    if (!mounted) return null;
    const params = new URLSearchParams();
    params.set("from", selectedDateKey);
    params.set("to", selectedDateKey);
    if (session?.user?.email) params.set("user_email", session.user.email);
    return `/api/completions?${params.toString()}`;
  }, [mounted, selectedDateKey, session?.user?.email]);

  const { data: dayCompletions } = useSWR<{ results?: Completion[]; items?: Completion[]; completions?: Completion[]; data?: Completion[] }>(
    completionsKey,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const dayCompletionList: Completion[] = useMemo(() => {
    const src = dayCompletions?.results || dayCompletions?.items || dayCompletions?.completions || dayCompletions?.data || [];
    return Array.isArray(src) ? src : [];
  }, [dayCompletions]);

  // ------------------- Map to CompletedWorkout -------------------
  const completedWorkoutsForCard: CompletedWorkout[] = useMemo(() => {
    if (!dayCompletionList || !dayCompletionList.length) return [];

    return dayCompletionList
      .map((c) => {
        let dateStr: string;
        if (typeof c.completed_date === "string") dateStr = c.completed_date;
        else if (c.completed_date?.toDate instanceof Function) dateStr = c.completed_date.toDate().toISOString();
        else dateStr = new Date().toISOString();

        const workoutId = c.workout_id || c.gym_workout_id || c.recurring_workout_id || c.recurring_id || c.assigned_workout_id || c.plan_workout_id || c.rx_id;
        if (!workoutId) return null;

        return {
          workout_id: workoutId,
          date: dateStr,
          calories: c.calories_burned ?? undefined,
          duration: c.duration ?? c.duration_minutes ?? undefined,
          weightUsed: typeof c.weight_completed_with === "number" ? `${Math.round(c.weight_completed_with)} kg` : undefined,
        };
      })
      .filter((v): v is CompletedWorkout => v !== null);
  }, [dayCompletionList]);

  // ------------------- Hrefs -------------------
  const selectedStatus = weekStatus[selectedDateKey] || ({} as PropsDay);
  const hasWorkoutToday = Boolean(selectedStatus.hasWorkout);
  const workoutIds = selectedStatus.workoutIds || [];
  const hasWorkoutId = Array.isArray(workoutIds) && workoutIds.length > 0 && typeof workoutIds[0] === "string";

  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHrefBase = `/habit?date=${selectedDateKey}`;
  const selectedFridayYMD = formatYMD(fridayOfWeek(selectedDay));
  const checkinHref = `/checkin?date=${encodeURIComponent(selectedFridayYMD)}`;

  const isPremium = Boolean(
    (profile?.subscription_status === "active" || profile?.subscription_status === "trialing") ||
    profile?.membership_status === "gym_member"
  );

  const weekday = selectedDay.getDay();
  const isWedOrFri = weekday === 3 || weekday === 5;
  const workoutLocked = !isPremium && isWedOrFri;
  const habitsLocked = !isPremium;

  const bxkrHref = hasWorkoutToday && hasWorkoutId ? `/workout/${encodeURIComponent(workoutIds[0])}` : "#";
  const workoutHref = workoutLocked ? "#" : bxkrHref;
  const habitHref = habitsLocked ? "#" : habitHrefBase;

  const firstRecurring = selectedDayData?.recurringWorkouts?.[0];
  const firstOptional = selectedDayData?.optionalWorkouts?.[0];

  const recurringHref = selectedDayData?.hasRecurringToday && firstRecurring
    ? `/gymworkout/${encodeURIComponent(firstRecurring.id)}`
    : "#";

  const optionalWorkoutHref = firstOptional ? `/workout/${encodeURIComponent(firstOptional.id)}` : "#";

  const hrefs = {
    nutrition: `${nutritionHref}`,
    workout: workoutHref,
    habit: habitHref,
    checkin: `${checkinHref}`,
    freestyle: "/workouts/freestyle",
    recurring: recurringHref,
    optionalWorkout: optionalWorkoutHref,
  };

  // ------------------- JSX -------------------
  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="mobile-web-app-capable" content="yes" />
      </Head>

      <main className="container py-2" style={{ paddingBottom: "70px", color: "#fff" }}>
        {/* Header */}
        <div className="d-flex justify-content-between mb-2 align-items-center">
          <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt=""
                className="rounded-circle"
                style={{ width: 36, height: 36, objectFit: "cover" }}
              />
            )}
            <div
              style={{
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.95rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "70vw",
              }}
              aria-label="Greeting"
            >
              {mounted ? timeGreeting : ""}
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
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
        </div>

        {/* Notifications */}
        <section style={{ marginBottom: 10 }}>
          <NotificationsBanner />
        </section>

        {/* Weekly Circles */}
        {weeklyOverview?.days && mounted && <WeeklyCircles weeklyProgressPercent={0} weeklyWorkoutsCompleted={0} dayStreak={0} />}

        {/* Daily Tasks */}
        {mounted && selectedDayData && (
          <DailyTasksCard
            dayLabel={`${selectedDay.toLocaleDateString(undefined, { weekday: "long" })}, ${selectedDay.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
            nutritionSummary={selectedDayData.nutritionSummary}
            nutritionLogged={Boolean(selectedStatus.nutritionLogged)}
            workoutSummary={selectedDayData.workoutSummary}
            hasWorkout={Boolean(selectedStatus.hasWorkout)}
            workoutDone={Boolean(selectedStatus.workoutDone)}
            hasRecurringToday={Boolean(selectedDayData.hasRecurringToday)}
            recurringDone={Boolean(selectedDayData.recurringDone)}
            recurringWorkouts={selectedDayData.recurringWorkouts || []}
            optionalWorkouts={selectedDayData.optionalWorkouts || []}
            completedWorkouts={completedWorkoutsForCard}
            hrefs={hrefs}
            habitSummary={selectedDayData.habitSummary}
            habitAllDone={Boolean(selectedStatus.habitAllDone)}
            checkinSummary={selectedDayData.checkinSummary as any}
            checkinComplete={Boolean(selectedStatus.checkinComplete)}
          />
        )}

      </main>

      {mounted && onboarding?.complete === true && <AddToHomeScreen />}
      <BottomNav />
    </>
  );
}