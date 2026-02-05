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

// ------------------- Date helpers -------------------
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
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
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

// ------------------- Types -------------------
type SimpleWorkoutRef = { id: string; name?: string };

type CompletedWorkout = {
  workout_id: string;
  date: string; // ISO string
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
  gym_workout_id?: string;
  recurring_workout_id?: string;
  recurring_id?: string;
  assigned_workout_id?: string;
  plan_workout_id?: string;
  rx_id?: string;
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
  planned?: { workout_id: string | null; done: boolean };
  freestyle?: { logged: boolean; summary?: { activity_type?: string | null; duration?: number | null; calories_burned?: number | null; weight_completed_with?: number | null } | null };
};

// ------------------- Home Component -------------------
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

  const { data: weeklyOverview, isLoading: overviewLoading } = useSWR(
    weekStartKey ? `/api/weekly/overview?week=${weekStartKey}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const profileKey = mounted && session?.user?.email ? `/api/profile?email=${encodeURIComponent(session.user.email)}` : null;
  const { data: profile } = useSWR<UserAccess>(profileKey, fetcher, { revalidateOnFocus: false, dedupingInterval: 60_000 });

  const onboardingKey = mounted && session?.user?.email ? "/api/onboarding/status" : null;
  const { data: onboarding } = useSWR<OnboardingStatus>(onboardingKey, fetcher, { revalidateOnFocus: false, dedupingInterval: 60_000 });

  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});
  const [weekLoading, setWeekLoading] = useState(false);

  const deriveDayBooleans = (o: any) => {
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
    setWeekLoading(true);
    const statuses: Record<string, DayStatus> = {};
    for (const o of weeklyOverview.days as PropsDay[]) {
      const b = deriveDayBooleans(o);
      statuses[o.dateKey] = { ...b, dateKey: o.dateKey, workoutIds: Array.isArray(o.workoutIds) ? o.workoutIds : [] };
    }
    setWeekStatus(statuses);
    setWeekLoading(false);
  }, [weeklyOverview]);

  // ------------------- Completions -------------------
  const completionsKey = useMemo(() => {
    if (!mounted) return null;
    const params = new URLSearchParams();
    params.set("from", selectedDateKey);
    params.set("to", selectedDateKey);
    if (session?.user?.email) params.set("user_email", session.user.email);
    return `/api/completions?${params.toString()}`;
  }, [mounted, selectedDateKey, session?.user?.email]);

  const { data: dayCompletions } = useSWR<{ results?: Completion[] }>(completionsKey, fetcher, { revalidateOnFocus: false, dedupingInterval: 30_000 });
  const dayCompletionList: Completion[] = useMemo(() => dayCompletions?.results || [], [dayCompletions]);

  // ------------------- Map Completions -> CompletedWorkout -------------------
  const completedWorkoutsForCard: CompletedWorkout[] = useMemo(() => {
    if (!dayCompletionList || !dayCompletionList.length) return [];
    return dayCompletionList
      .map((c) => {
        const date =
          typeof c.completed_date === "string"
            ? c.completed_date
            : c.completed_date?.toDate?.()
            ? c.completed_date.toDate()!.toISOString()
            : undefined;
        if (!c.workout_id || !date) return null;
        return {
          workout_id: c.workout_id,
          date,
          calories: c.calories_burned ?? undefined,
          duration: c.duration ?? c.duration_minutes ?? undefined,
          weightUsed: typeof c.weight_completed_with === "number" ? `${Math.round(c.weight_completed_with)} kg` : undefined,
        };
      })
      .filter((v): v is CompletedWorkout => v !== null);
  }, [dayCompletionList]);

  // ------------------- Selected Day -------------------
  const selectedDayData: PropsDay | undefined = useMemo(() => {
    if (!weeklyOverview?.days) return undefined;
    return (weeklyOverview.days as PropsDay[]).find((d) => d.dateKey === selectedDateKey);
  }, [weeklyOverview, selectedDateKey]);

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

  const recurringHref = selectedDayData?.hasRecurringToday && firstRecurring ? `/gymworkout/${encodeURIComponent(firstRecurring.id)}` : "#";
  const optionalWorkoutHref = firstOptional ? `/workout/${encodeURIComponent(firstOptional.id)}` : "#";

  const roundedNutrition = selectedDayData?.nutritionSummary
    ? { calories: round2(selectedDayData.nutritionSummary.calories), protein: round2(selectedDayData.nutritionSummary.protein) }
    : undefined;

  const hrefs = { nutrition: nutritionHref, workout: workoutHref, habit: habitHref, checkin: checkinHref, freestyle: "/workouts/freestyle", recurring: recurringHref, optionalWorkout: optionalWorkoutHref };

  // ------------------- Greeting -------------------
  const showLoadingBar = status === "loading" || !mounted || weekLoading || overviewLoading;

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

  // ------------------- Render -------------------
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
            {session?.user?.image && <img src={session.user.image} alt="" className="rounded-circle" style={{ width: 36, height: 36, objectFit: "cover" }} />}
            {(status === "loading" || !mounted || weekLoading || overviewLoading) && <div className="inline-spinner" />}
            <div style={{ color: "#fff", fontWeight: 600, fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70vw" }} aria-label="Greeting">
              {mounted ? timeGreeting : ""}
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            {status === "authenticated" ? (
              <button className="btn btn-link text-light p-0" onClick={() => signOut()}>Sign out</button>
            ) : (
              <button className="btn btn-link text-light p-0" onClick={() => signIn("google")} style={{ background: "transparent", border: "none", textDecoration: "underline" }}>Sign in</button>
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
              weeklyProgressPercent={0} // Compute weeklyProgressPercent if needed
              weeklyWorkoutsCompleted={0} // Compute weeklyWorkoutsCompleted if needed
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
              if (!st) return <div key={i} style={{ width: 44 }}><div style={{ fontSize: "0.8rem", opacity: 0.6, fontWeight: 500 }}>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</div><div className="bxkr-day-pill" style={{ opacity: 0.5 }}><span style={{ fontWeight: 500 }}>{d.getDate()}</span></div></div>;
              const ringColor = st.allDone ? "#64c37a" : isSelected ? "#ff8a2a" : "rgba(255,255,255,0.3)";
              const boxShadow = isSelected ? `0 0 8px ${ringColor}` : st.allDone ? `0 0 3px ${ringColor}` : "none";
              return (
                <div key={i} style={{ width: 44, cursor: "pointer" }} onClick={() => setSelectedDay(d)}>
                  <div style={{ fontSize: "0.8rem", color: "#fff", opacity: 0.85, marginBottom: 4, fontWeight: 500 }}>
                    {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}
                  </div>
                  <div className={`bxkr-day-pill ${st.allDone ? "completed" : ""}`} style={{ boxShadow, fontWeight: isSelected ? 600 : 500, borderColor: st.allDone ? undefined : ringColor }}>
                    <span className={`bxkr-day-content ${st.allDone ? (isSelected ? "state-num" : "state-flame") : "state-num"}`} style={{ fontWeight: 500 }}>
                      {st.allDone && !isSelected ? <i className="fas fa-fire" style={{ color: "#64c37a", textShadow: `0 0 8
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
            dayLabel={`${selectedDay.toLocaleDateString(undefined, { weekday: "long" })}, ${selectedDay.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
            nutritionSummary={roundedNutrition}
            nutritionLogged={Boolean(selectedStatus.nutritionLogged)}
            workoutSummary={selectedDayData.workoutSummary}
            hasWorkout={Boolean(selectedStatus.hasWorkout)}
            workoutDone={Boolean(selectedStatus.workoutDone)}
            recurringWorkouts={selectedDayData.recurringWorkouts || []}
            recurringDone={Boolean(selectedDayData.recurringDone)}
            optionalWorkouts={selectedDayData.optionalWorkouts || []}
            completedWorkouts={completedWorkoutsForCard}
            hrefs={hrefs}
            habitSummary={selectedDayData.habitSummary}
            habitAllDone={Boolean(selectedStatus.habitAllDone)}
            checkinSummary={selectedDayData.checkinSummary as any}
            checkinComplete={Boolean(selectedStatus.checkinComplete)}
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

              {Array.isArray(onboarding.missing) && onboarding.missing.length > 0 && (
                <>
                  <div className="small text-dim mb-2">Missing:</div>
                  <ul className="small" style={{ lineHeight: 1.6, marginBottom: 0 }}>
                    {onboarding.missing.map((k) => (
                      <li key={k}>{k.replaceAll("_", " ")}</li>
                    ))}
                  </ul>
                </>
              )}

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