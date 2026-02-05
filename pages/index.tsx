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

  // NEW (from /api/weekly/overview)
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
  const weekStartKey = useMemo(
    () => (mounted ? formatYMD(startOfAlignedWeek(new Date())) : ""),
    [mounted]
  );

  const { data: weeklyOverview, isLoading: overviewLoading } = useSWR(
    weekStartKey ? `/api/weekly/overview?week=${weekStartKey}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const profileKey =
    mounted && session?.user?.email
      ? `/api/profile?email=${encodeURIComponent(session.user.email)}`
      : null;
  const { data: profile } = useSWR<UserAccess>(profileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const onboardingKey =
    mounted && session?.user?.email ? "/api/onboarding/status" : null;
  const { data: onboarding } = useSWR<OnboardingStatus>(onboardingKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});
  const [weekLoading, setWeekLoading] = useState(false);

  // ----- UPDATED: make recurring behave like single-workout days -----
  const deriveDayBooleans = (o: any) => {
    const isFriday = Boolean(o.isFriday ?? new Date(o.dateKey + "T00:00:00").getDay() === 5);

    // Has workout if planned OR recurring OR summaries/ids exist
    const hasWorkout =
      Boolean(o.hasWorkout) ||
      Boolean(o.hasRecurringToday) ||
      Boolean(o.recurringWorkouts?.length) ||
      Boolean(o.workoutIds?.length) ||
      Boolean(o.workoutSummary);

    // Done if explicit OR recurringDone OR can be inferred via summary
    const hasSummary =
      Boolean(o.workoutSummary && (o.workoutSummary.calories || o.workoutSummary.duration || o.workoutSummary.weightUsed));

    const workoutDone =
      Boolean(o.workoutDone) ||
      Boolean(o.recurringDone) ||
      hasSummary;

    const nutritionLogged = Boolean(o.nutritionLogged);
    const habitAllDone =
      Boolean(o.habitAllDone) ||
      (o.habitSummary ? o.habitSummary.completed >= o.habitSummary.total && o.habitSummary.total > 0 : false);
    const checkinComplete = Boolean(o.checkinComplete) || Boolean(o.checkinSummary);

    const allDone =
      (!hasWorkout || workoutDone) &&
      nutritionLogged &&
      habitAllDone &&
      (!isFriday || checkinComplete);

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
    return {
      ...s,
      body_fat_pct,
      bodyFat: (s as any).bodyFat ?? body_fat_pct,
    };
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

  const recurringHref = selectedDayData?.hasRecurringToday && firstRecurring
    ? `/gymworkout/${encodeURIComponent(firstRecurring.id)}`
    : "#";

  const optionalWorkoutHref = firstOptional
    ? `/workout/${encodeURIComponent(firstOptional.id)}`
    : "#";

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

  // Completions (whole day range)
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

  // Canonical day completion list
  const dayCompletionList: Completion[] = useMemo(() => {
    const src =
      dayCompletions?.results ||
      dayCompletions?.items ||
      dayCompletions?.completions ||
      dayCompletions?.data ||
      [];
    return Array.isArray(src) ? (src as Completion[]) : [];
  }, [dayCompletions]);

  // Day summary (freestyle)
  const daySummaryKey = useMemo(() => {
    if (!mounted) return null;
    const params = new URLSearchParams();
    params.set("summary", "day");
    params.set("date", selectedDateKey);
    return `/api/completions?${params.toString()}`;
  }, [mounted, selectedDateKey]);

  const { data: daySummary } = useSWR<DaySummaryRes>(daySummaryKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const { freestyleLogged, freestyleSummary } = useMemo(() => {
    const s = daySummary?.freestyle?.summary;
    if (daySummary?.freestyle?.logged && s) {
      return {
        freestyleLogged: true,
        freestyleSummary: {
          activity_type: s.activity_type || "Freestyle",
          duration: typeof s.duration === "number" ? s.duration : undefined,
          calories_burned: typeof s.calories_burned === "number" ? s.calories_burned : undefined,
          weight_completed_with:
            typeof s.weight_completed_with === "number" ? s.weight_completed_with : undefined,
        },
      };
    }

    const arr: Completion[] = dayCompletionList;
    const sameDay = (v: any) => {
      try {
        const dt =
          v?.toDate?.() instanceof Date ? v.toDate() :
          v ? new Date(v) : null;
        if (!dt || isNaN(dt.getTime())) return false;
        return formatYMD(dt) === selectedDateKey;
      } catch {
        return false;
      }
    };

    const freestyle = arr.filter((c) => c?.is_freestyle === true && sameDay(c.completed_date));
    if (!freestyle.length) {
      return { freestyleLogged: false, freestyleSummary: undefined as any };
    }

    const totalCalories = freestyle.reduce((sum, c) => sum + (Number(c.calories_burned) || 0), 0);
    const totalDuration = freestyle.reduce(
      (sum, c) => sum + (Number((c as any).duration) || Number(c.duration_minutes) || 0),
      0
    );
    const lastActivity = freestyle[freestyle.length - 1]?.activity_type || undefined;

    return {
      freestyleLogged: true,
      freestyleSummary: {
        activity_type: typeof lastActivity === "string" ? lastActivity : "Freestyle",
        duration: totalDuration || undefined,
        calories_burned: totalCalories || undefined,
      },
    };
  }, [daySummary, dayCompletionList, selectedDateKey]);

  // ---------- Optional BXKR completion (unchanged) ----------
  const { optionalDone, optionalSummary } = useMemo(() => {
    const ids = (selectedDayData?.optionalWorkouts || []).map((w) => String(w.id));
    if (!ids.length) return { optionalDone: false, optionalSummary: undefined as undefined };

    const matches = dayCompletionList.filter((c) => ids.includes(String(c.workout_id || "")));
    if (!matches.length) return { optionalDone: false, optionalSummary: undefined as undefined };

    const calories = matches.reduce((sum, c) => sum + (Number(c.calories_burned) || 0), 0);
    const duration = matches.reduce(
      (sum, c) => sum + (Number((c as any).duration) || Number(c.duration_minutes) || 0),
      0
    );
    const last = matches[matches.length - 1];
    const weightUsed =
      typeof last?.weight_completed_with === "number" ? `${Math.round(last.weight_completed_with)} kg` : undefined;

    return {
      optionalDone: true,
      optionalSummary: {
        calories,
        duration,
        weightUsed,
      } as { calories: number; duration: number; weightUsed?: string },
    };
  }, [selectedDayData?.optionalWorkouts, dayCompletionList]);

  // ---------- NEW: Recurring completion via completions (same concept as optional) ----------
  const { recurringDoneFromCompletions, recurringSummary } = useMemo(() => {
    const ids = (selectedDayData?.recurringWorkouts || []).map((w) => String(w.id));
    if (!ids.length) return { recurringDoneFromCompletions: false, recurringSummary: undefined as undefined };

    const matches = dayCompletionList.filter((c) => ids.includes(String(c.workout_id || "")));
    if (!matches.length) return { recurringDoneFromCompletions: false, recurringSummary: undefined as undefined };

    const calories = matches.reduce((sum, c) => sum + (Number(c.calories_burned) || 0), 0);
    const duration = matches.reduce(
      (sum, c) => sum + (Number((c as any).duration) || Number(c.duration_minutes) || 0),
      0
    );
    const last = matches[matches.length - 1];
    const weightUsed =
      typeof last?.weight_completed_with === "number" ? `${Math.round(last.weight_completed_with)} kg` : undefined;

    return {
      recurringDoneFromCompletions: true,
      recurringSummary: {
        calories,
        duration,
        weightUsed,
      } as { calories: number; duration: number; weightUsed?: string },
    };
  }, [selectedDayData?.recurringWorkouts, dayCompletionList]);

  // Use recurring summary when it's a recurring day; otherwise use the planned workout summary
  const workoutSummaryForCard =
    selectedDayData?.hasRecurringToday
      ? (recurringSummary || selectedDayData?.workoutSummary)
      : selectedDayData?.workoutSummary;

  // Resolve recurringDone using either API flag or completions
  const recurringDoneResolved = Boolean(selectedDayData?.recurringDone || recurringDoneFromCompletions);

  // Hrefs
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
              <img
                src={session.user.image}
                alt=""
                className="rounded-circle"
                style={{ width: 36, height: 36, objectFit: "cover" }}
              />
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

              const ringColor = st.allDone ? "#64c37a" : isSelected ? "#ff8a2a" : "rgba(255,255,255,0.3)";
              const boxShadow = isSelected ? `0 0 8px ${ringColor}` : st.allDone ? `0 0 3px ${ringColor}` : "none";

              return (
                <div key={i} style={{ width: 44, cursor: "pointer" }} onClick={() => setSelectedDay(d)}>
                  <div style={{ fontSize: "0.8rem", color: "#fff", opacity: 0.85, marginBottom: 4, fontWeight: 500 }}>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                  </div>
                  <div
                    className={`bxkr-day-pill ${st.allDone ? "completed" : ""}`}
                    style={{ boxShadow, fontWeight: isSelected ? 600 : 500, borderColor: st.allDone ? undefined : ringColor }}
                  >
                    <span
                      className={`bxkr-day-content ${
                        st.allDone ? (isSelected ? "state-num" : "state-flame") : "state-num"
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {st.allDone && !isSelected ? (
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
            dayLabel={`${selectedDay.toLocaleDateString(undefined, {
              weekday: "long",
            })}, ${selectedDay.toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}`}
            nutritionSummary={roundedNutrition}
            nutritionLogged={Boolean(selectedStatus.nutritionLogged)}
            workoutSummary={workoutSummaryForCard}        {/* <-- use recurring summary on recurring days */}
            hasWorkout={Boolean(selectedStatus.hasWorkout)}
            workoutDone={Boolean(selectedStatus.workoutDone)}  {/* used only for non-recurring row */}
            hasRecurringToday={Boolean(selectedDayData.hasRecurringToday)}
            recurringDone={recurringDoneResolved}         {/* <-- boolean resolved via completions */}
            recurringWorkouts={selectedDayData.recurringWorkouts || []}
            optionalWorkouts={selectedDayData.optionalWorkouts || []}
            optionalDone={optionalDone}
            optionalSummary={optionalSummary}
            hrefs={hrefs}
            habitSummary={selectedDayData.habitSummary}
            habitAllDone={Boolean(selectedStatus.habitAllDone)}
            checkinSummary={checkinSummaryNormalized as any}
            checkinComplete={Boolean(selectedStatus.checkinComplete)}
            freestyleLogged={freestyleLogged}
            freestyleSummary={freestyleSummary}
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
      
      {mounted && onboarding?.complete === true && (
        <AddToHomeScreen />
      )}
      <BottomNav />
    </>
  );
}
