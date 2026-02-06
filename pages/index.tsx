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
function endOfAlignedWeek(d: Date) {
  const s = startOfAlignedWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
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
  checkinSummary?: { weight: number; body_fat_pct: number; weightChange?: number; bfChange?: number };
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

type UserAccess = {
  subscription_status?: string | null;
  membership_status?: string | null;
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
  date_completed?: string | { toDate?: () => Date };
};

type OnboardingStatus = {
  complete: boolean;
  missing: string[];
  outstanding: { id: string; key: string; title: string; description: string; targetPath: string }[];
  profile?: any;
};

type DaySummaryRes = {
  date?: string;
  user_email?: string;
  planned?: {
    workout_id: string | null;
    done: boolean;
  };
  freestyle?: {
    logged: boolean;
    summary?: {
      activity_type?: string | null;
      duration?: number | null;
      calories_burned?: number | null;
      weight_completed_with?: number | null;
    } | null;
  };
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
  const weekStart = useMemo(() => (mounted ? startOfAlignedWeek(new Date()) : null), [mounted]);
  const weekEnd = useMemo(() => (mounted ? endOfAlignedWeek(new Date()) : null), [mounted]);
  const weekStartKey = useMemo(() => (weekStart ? formatYMD(weekStart) : ""), [weekStart]);
  const weekEndKey = useMemo(() => (weekEnd ? formatYMD(weekEnd) : ""), [weekEnd]);

  const { data: weeklyOverview, isLoading: overviewLoading } = useSWR(
    weekStartKey ? `/api/weekly/overview?week=${weekStartKey}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const profileKey =
    mounted && session?.user?.email ? `/api/profile?email=${encodeURIComponent(session.user.email)}` : null;
  const { data: profile } = useSWR<UserAccess>(profileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const onboardingKey = mounted && session?.user?.email ? "/api/onboarding/status" : null;
  const { data: onboarding } = useSWR<OnboardingStatus>(onboardingKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});
  const [weekLoading, setWeekLoading] = useState(false);

  const deriveDayBooleans = (o: any) => {
    const isFriday = Boolean(o.isFriday ?? new Date(o.dateKey + "T00:00:00").getDay() === 5);
    const hasWorkout =
      Boolean(o.hasWorkout) ||
      Boolean(o.hasRecurringToday) ||
      Boolean(o.recurringWorkouts?.length) ||
      Boolean(o.workoutIds?.length) ||
      Boolean(o.workoutSummary);

    const hasSummary =
      Boolean(o.workoutSummary && (o.workoutSummary.calories || o.workoutSummary.duration || o.workoutSummary.weightUsed));

    const workoutDone = Boolean(o.workoutDone) || Boolean(o.recurringDone) || hasSummary;
    const nutritionLogged = Boolean(o.nutritionLogged);
    const habitAllDone =
      Boolean(o.habitAllDone) ||
      (o.habitSummary ? o.habitSummary.completed >= o.habitSummary.total && o.habitSummary.total > 0 : false);
    const checkinComplete = Boolean(o.checkinComplete) || Boolean(o.checkinSummary);

    const allDone =
      (!hasWorkout || workoutDone) && nutritionLogged && habitAllDone && (!isFriday || checkinComplete);

    return { isFriday, hasWorkout, workoutDone, nutritionLogged, habitAllDone, checkinComplete, allDone };
  };

  useEffect(() => {
    if (!weeklyOverview?.days?.length) return;
    setWeekLoading(true);
    const statuses: Record<string, DayStatus> = {};
    for (const o of weeklyOverview.days as ApiDay[]) {
      const b = deriveDayBooleans(o);
      statuses[o.dateKey] = {
        dateKey: o.dateKey,
        hasWorkout: b.hasWorkout,
        workoutDone: b.workoutDone,
        nutritionLogged: b.nutritionLogged,
        habitAllDone: b.habitAllDone,
        isFriday: b.isFriday,
        checkinComplete: b.checkinComplete,
        allDone: b.allDone,
        workoutIds: Array.isArray(o.workoutIds) ? o.workoutIds : [],
      };
    }
    setWeekStatus(statuses);
    setWeekLoading(false);
  }, [weeklyOverview]);

  const derivedWeeklyTotals = useMemo(() => {
    const days = (weeklyOverview?.days as any[]) || [];
    let totalTasks = 0;
    let completedTasks = 0;
    for (const o of days) {
      const { isFriday, hasWorkout, workoutDone, nutritionLogged, habitAllDone, checkinComplete } = deriveDayBooleans(o);
      totalTasks += 1 + 1 + (hasWorkout ? 1 : 0) + (isFriday ? 1 : 0);
      completedTasks +=
        (nutritionLogged ? 1 : 0) +
        (habitAllDone ? 1 : 0) +
        (hasWorkout && workoutDone ? 1 : 0) +
        (isFriday && checkinComplete ? 1 : 0);
    }
    return { totalTasks, completedTasks };
  }, [weeklyOverview]);

  const selectedDayData: ApiDay | undefined = useMemo(() => {
    if (!weeklyOverview?.days) return undefined;
    return (weeklyOverview.days as ApiDay[]).find((d) => d.dateKey === selectedDateKey);
  }, [weeklyOverview, selectedDateKey]);

  const checkinSummaryNormalized = useMemo(() => {
    const s = selectedDayData?.checkinSummary as
      | { weight?: number; body_fat_pct?: number; bodyFat?: number; weightChange?: number; bfChange?: number }
      | undefined;
    if (!s) return undefined;
    const body_fat_pct =
      typeof s.body_fat_pct === "number"
        ? s.body_fat_pct
        : typeof (s as any).bodyFat === "number"
        ? (s as any).bodyFat
        : 0;
    return { ...s, body_fat_pct, bodyFat: (s as any).bodyFat ?? body_fat_pct };
  }, [selectedDayData]);

  const selectedStatus = weekStatus[selectedDateKey] || ({} as DayStatus);

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

  const recurringHref =
    selectedDayData?.hasRecurringToday && firstRecurring ? `/gymworkout/${encodeURIComponent(firstRecurring.id)}` : "#";

  const optionalWorkoutHref = firstOptional ? `/workout/${encodeURIComponent(firstOptional.id)}` : "#";

  const roundedNutrition = selectedDayData?.nutritionSummary
    ? {
        calories: round2(selectedDayData.nutritionSummary.calories),
        protein: round2(selectedDayData.nutritionSummary.protein),
      }
    : undefined;

  const showLoadingBar = status === "loading" || !mounted;

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

  const weeklyProgressPercent = useMemo(() => {
    const { totalTasks, completedTasks } = derivedWeeklyTotals;
    if (!totalTasks) return 0;
    return Math.round((completedTasks / totalTasks) * 100);
  }, [derivedWeeklyTotals]);

  const weeklyWorkoutsCompleted = useMemo(() => {
    const completedFromTotals = Number(weeklyOverview?.weeklyTotals?.totalWorkoutsCompleted ?? 0);
    if (Number.isFinite(completedFromTotals)) return Math.max(0, Math.min(3, completedFromTotals));
    const days = (weeklyOverview?.days as ApiDay[]) || [];
    const count = days.reduce((acc, d) => acc + (d?.workoutDone ? 1 : 0), 0);
    return Math.max(0, Math.min(3, count));
  }, [weeklyOverview]);

  // ------- Weekly completions (Mon..Sun) for robust matching by workout_id -------
  const weekCompletionsKey = useMemo(() => {
    if (!mounted || !weekStartKey || !weekEndKey) return null;
    const params = new URLSearchParams();
    params.set("from", weekStartKey);
    params.set("to", weekEndKey);
    if (session?.user?.email) params.set("user_email", session.user.email);
    return `/api/completions?${params.toString()}`;
  }, [mounted, weekStartKey, weekEndKey, session?.user?.email]);

  const { data: weekCompletions } = useSWR<{
    results?: Completion[];
    items?: Completion[];
    completions?: Completion[];
    data?: Completion[];
  }>(weekCompletionsKey, fetcher, { revalidateOnFocus: false, dedupingInterval: 30_000 });

  type LatestRow = { calories?: number; duration?: number; weight?: number; at?: number };
  const { weekDoneIds, weekLatestById } = useMemo(() => {
    const list: Completion[] =
      (weekCompletions?.results as Completion[]) ||
      (weekCompletions?.items as Completion[]) ||
      (weekCompletions?.completions as Completion[]) ||
      (weekCompletions?.data as Completion[]) ||
      [];

    const weekDoneIds = new Set<string>();
    const weekLatestById = new Map<string, LatestRow>();

    const toDate = (v: any): Date | null => {
      try {
        if (!v) return null;
        if (typeof v?.toDate === "function") return v.toDate();
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      } catch {
        return null;
      }
    };

    for (const c of list) {
      const wid = String(c.workout_id || "").trim();
      if (!wid) continue;

      const dt =
        toDate((c as any).completed_date) ||
        toDate((c as any).date_completed);
      if (!dt) continue;

      weekDoneIds.add(wid);

      const calories = typeof c.calories_burned === "number" ? c.calories_burned : undefined;
      const duration =
        typeof c.duration === "number" ? c.duration :
        typeof c.duration_minutes === "number" ? c.duration_minutes : undefined;
      const weight = typeof c.weight_completed_with === "number" ? c.weight_completed_with : undefined;
      const at = dt.getTime();

      const prev = weekLatestById.get(wid);
      if (!prev || (at > (prev.at || 0))) {
        weekLatestById.set(wid, { calories, duration, weight, at });
      }
    }

    return { weekDoneIds, weekLatestById };
  }, [weekCompletions]);

  // ---------- Resolve optional & recurring states for the selected day ----------
  const recurringIds: string[] = (selectedDayData?.recurringWorkouts || []).map((w) => String(w.id));
  const optionalIds: string[] = (selectedDayData?.optionalWorkouts || []).map((w) => String(w.id));

  // Recurring is week-level done by workout_id
  const recurringDoneFromWeek = useMemo(() => {
    if (!recurringIds.length) return false;
    return recurringIds.some((id) => weekDoneIds.has(id));
  }, [recurringIds, weekDoneIds]);

  // BXKR OPTIONAL: CHANGE → also week-level (used to be day-bound)
  const optionalDoneFromWeek = useMemo(() => {
    if (!optionalIds.length) return false;
    return optionalIds.some((id) => weekDoneIds.has(id));
  }, [optionalIds, weekDoneIds]);

  // Card summaries:
  // - Recurring day → use the most recent of recurring IDs within the week
  // - Optional on recurring day → use the most recent of optional IDs within the week (CHANGED)
  const recurringSummaryForCard = useMemo(() => {
    if (!selectedDayData?.hasRecurringToday || !recurringIds.length) return undefined;
    let latest: LatestRow | undefined;
    for (const id of recurringIds) {
      const row = weekLatestById.get(id);
      if (row && (!latest || (row.at || 0) > (latest.at || 0))) latest = row;
    }
    return latest
      ? {
          calories: round2(latest.calories ?? 0),
          duration: round2(latest.duration ?? 0),
          weightUsed: typeof latest.weight === "number" ? `${Math.round(latest.weight)} kg` : undefined,
        }
      : undefined;
  }, [selectedDayData?.hasRecurringToday, recurringIds, weekLatestById]);

  const optionalSummaryForCard = useMemo(() => {
    if (!selectedDayData?.hasRecurringToday || !optionalIds.length) return undefined;
    let latest: LatestRow | undefined;
    for (const id of optionalIds) {
      const row = weekLatestById.get(id);
      if (row && (!latest || (row.at || 0) > (latest.at || 0))) latest = row;
    }
    return latest
      ? {
          calories: round2(latest.calories ?? 0),
          duration: round2(latest.duration ?? 0),
          weightUsed: typeof latest.weight === "number" ? `${Math.round(latest.weight)} kg` : undefined,
        }
      : undefined;
  }, [selectedDayData?.hasRecurringToday, optionalIds, weekLatestById]);

  // The main card "workoutSummary" still shows the mandatory (recurring on recurring days; otherwise programmed)
  const workoutSummaryForCard = useMemo(() => {
    return selectedDayData?.hasRecurringToday
      ? recurringSummaryForCard
      : selectedDayData?.workoutSummary;
  }, [selectedDayData?.hasRecurringToday, recurringSummaryForCard, selectedDayData?.workoutSummary]);

  // Recurring boolean for the card
  const recurringDoneResolved = Boolean(selectedDayData?.recurringDone) || recurringDoneFromWeek;

  // Optional boolean for the card (CHANGED: week-level)
  const optionalDoneResolved = optionalDoneFromWeek;

  // Workout "done" for the selected day → use recurring rule on recurring day, else planned/overview
  const workoutDoneResolved = useMemo(() => {
    if (Boolean(selectedDayData?.hasRecurringToday)) {
      return recurringDoneResolved;
    }
    // No recurring ⇒ planned day (keep as overview boolean)
    return Boolean(selectedStatus.workoutDone);
  }, [selectedDayData?.hasRecurringToday, recurringDoneResolved, selectedStatus.workoutDone]);

  // All-done for the selected day (UI override for the selected pill)
  const allDoneResolved = useMemo(() => {
    const isFriday = new Date(selectedDateKey + "T00:00:00").getDay() === 5;
    const nutritionLogged = Boolean(selectedStatus.nutritionLogged);
    const habitsDone = Boolean(selectedStatus.habitAllDone);
    const checkInDone = isFriday ? Boolean(selectedStatus.checkinComplete) : true;
    return (!Boolean(selectedStatus.hasWorkout) || workoutDoneResolved) && nutritionLogged && habitsDone && checkInDone;
  }, [
    selectedStatus.hasWorkout,
    workoutDoneResolved,
    selectedStatus.nutritionLogged,
    selectedStatus.habitAllDone,
    selectedStatus.checkinComplete,
    selectedDateKey,
  ]);

  const hrefs = {
    nutrition: `${nutritionHref}`,
    workout: workoutHref,
    habit: habitHref,
    checkin: `${checkinHref}`,
    freestyle: "/workouts/freestyle",
    recurring: recurringHref,
    optionalWorkout: optionalWorkoutHref,
  };

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
              <img src={session.user.image} alt="" className="rounded-circle" style={{ width: 36, height: 36, objectFit: "cover" }} />
            )}
            {(status === "loading" || !mounted || weekLoading || overviewLoading) && <div className="inline-spinner" />}
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
        {weeklyOverview?.days && mounted && (
          <div style={{ marginBottom: 12 }}>
            <WeeklyCircles
              weeklyProgressPercent={weeklyProgressPercent}
              weeklyWorkoutsCompleted={weeklyWorkoutsCompleted}
              dayStreak={dayStreak}
            />
          </div>
        )}

        {/* Calendar */}
        {mounted && (
          <div className="d-flex justify-content-between text-center mb-3" style={{ gap: 8 }}>
            {weekDays.map((d, i) => {
              const isSelected = isSameDay(d, selectedDay);
              const dk = formatYMD(d);
              const st = weekStatus[dk];

              if (!st) {
                return (
                  <div key={i} style={{ width: 44 }}>
                    <div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 500 }}>
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                    </div>
                    <div className="bxkr-day-pill" style={{ opacity: 0.5 }}>
                      <span style={{ fontWeight: 500 }}>{d.getDate()}</span>
                    </div>
                  </div>
                );
              }

              // Override only for the selected day
              const stAllDone = isSelected ? allDoneResolved : st.allDone;
              const ringColor = stAllDone ? "#64c37a" : isSelected ? "#ff8a2a" : "rgba(255,255,255,0.3)";
              const boxShadow = isSelected ? `0 0 8px ${ringColor}` : stAllDone ? `0 0 3px ${ringColor}` : "none";

              return (
                <div key={i} style={{ width: 44, cursor: "pointer" }} onClick={() => setSelectedDay(d)}>
                  <div style={{ fontSize: "0.8rem", color: "#fff", opacity: 0.85, marginBottom: 4, fontWeight: 500 }}>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                  </div>
                  <div
                    className={`bxkr-day-pill ${stAllDone ? "completed" : ""}`}
                    style={{ boxShadow, fontWeight: isSelected ? 600 : 500, borderColor: stAllDone ? undefined : ringColor }}
                  >
                    <span
                      className={`bxkr-day-content ${stAllDone ? (isSelected ? "state-num" : "state-flame") : "state-num"}`}
                      style={{ fontWeight: 500 }}
                    >
                      {stAllDone && !isSelected ? (
                        <i
                          className="fas fa-fire"
                          style={{
                            color: "#64c37a",
                            textShadow: `0 0 8px #64c37a`,
                            fontSize: "1rem",
                            lineHeight: 1,
                          }}
                        />
                      ) : (
                        d.getDate()
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Daily Tasks */}
        {mounted && selectedDayData && (
          <DailyTasksCard
            dayLabel={`${selectedDay.toLocaleDateString(undefined, { weekday: "long" })}, ${selectedDay.toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}`}
            nutritionSummary={roundedNutrition}
            nutritionLogged={Boolean(selectedStatus.nutritionLogged)}
            workoutSummary={workoutSummaryForCard}
            hasWorkout={Boolean(selectedStatus.hasWorkout)}
            workoutDone={workoutDoneResolved}
            hasRecurringToday={Boolean(selectedDayData.hasRecurringToday)}
            recurringDone={recurringDoneResolved}
            recurringWorkouts={selectedDayData.recurringWorkouts || []}
            optionalWorkouts={selectedDayData.optionalWorkouts || []}
            optionalDone={optionalDoneResolved}
            optionalSummary={optionalSummaryForCard}
            hrefs={hrefs}
            habitSummary={selectedDayData.habitSummary}
            habitAllDone={Boolean(selectedStatus.habitAllDone)}
            checkinSummary={checkinSummaryNormalized as any}
            checkinComplete={Boolean(selectedStatus.checkinComplete)}
            freestyleLogged={false}
            freestyleSummary={undefined}
          />
        )}

        {mounted && hasWorkoutToday && !hasWorkoutId && (
          <div className="text-center" style={{ opacity: 0.8, fontSize: "0.9rem", marginTop: 8 }}>
            Loading workout details… <span className="inline-spinner" />
          </div>
        )}

        {/* Onboarding blocking modal */}
        {mounted && onboarding && onboarding.complete === false && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(6px)",
              zIndex: 3000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              className="futuristic-card"
              style={{
                width: "min(520px, 92vw)",
                padding: 20,
                borderRadius: 16,
                color: "#fff",
                textAlign: "left",
              }}
            >
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="fas fa-user-check" style={{ color: "#ff8a2a" }} />
                <h2 id="onboarding-title" className="h5 m-0" style={{ fontWeight: 800 }}>
                  Let’s finish your setup
                </h2>
              </div>

              <p style={{ opacity: 0.9 }}>
                To unlock your personalised BXKR experience, please complete onboarding.
              </p>

              {Array.isArray(onboarding.missing) && onboarding.missing.length > 0 ? (
                <>
                  <div className="small text-dim mb-2">Missing:</div>
                  <ul className="small" style={{ lineHeight: 1.6, marginBottom: 0 }}>
                    {onboarding.missing.map((k) => (
                      <li key={k}>{k.replaceAll("_", " ")}</li>
                    ))}
                  </ul>
                </>
              ) : null}

              <div className="mt-3 d-flex gap-2">
                <a
                  href="/onboarding"
                  className="btn btn-bxkr"
                  style={{ borderRadius: 24 }}
                  aria-label="Continue onboarding"
                >
                  Continue onboarding
                </a>
                <a
                  href="/landing"
                  className="btn btn-outline-light"
                  style={{ borderRadius: 24 }}
                  aria-label="Learn more about BXKR"
                >
                  Learn more
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      {mounted && onboarding?.complete === true && <AddToHomeScreen />}
      <BottomNav />
    </>
  );
}
