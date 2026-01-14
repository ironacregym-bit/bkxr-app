
// pages/index.tsx
import Head from "next/head";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import DailyTasksCard from "../components/DailyTasksCard";
import WeeklyCircles from "../components/dashboard/WeeklyCircles";
import NotificationsBanner from "../components/NotificationsBanner";


export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  if (!session) {
    // Optional: preserve the intended destination so we can return after sign-in
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
  // en-CA gives YYYY-MM-DD
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
// NEW: compute the Friday for a given date (Mon-based week)
function fridayOfWeek(d: Date) {
  const s = startOfAlignedWeek(d);
  const f = new Date(s);
  f.setDate(s.getDate() + 4);
  f.setHours(0, 0, 0, 0);
  return f;
}

/** Day payload from /api/weekly/overview */
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

/** Minimal profile fields to determine Premium access */
type UserAccess = {
  subscription_status?: string | null;
  membership_status?: string | null;
};

/** Minimal completion shape for freestyle detection */
type Completion = {
  is_freestyle?: boolean;
  activity_type?: string | null;
  duration_minutes?: number | null;
  calories_burned?: number | null;
  completed_date?: string | { toDate?: () => Date };
};

export default function Home() {
  const { data: session, status } = useSession();

  // Mount guard to avoid SSR/CSR mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Greeting computed on client
  const [timeGreeting, setTimeGreeting] = useState<string>("");
  useEffect(() => {
    const h = new Date().getHours();
    setTimeGreeting(h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening");
  }, []);

  // Week and key derived after mount
  const weekDays = useMemo(() => (mounted ? getWeek() : []), [mounted]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const selectedDateKey = formatYMD(selectedDay);
  const weekStartKey = useMemo(
    () => (mounted ? formatYMD(startOfAlignedWeek(new Date())) : ""),
    [mounted]
  );

  // Weekly overview (key is null until mounted to avoid SSR mismatch)
  const { data: weeklyOverview, isLoading: overviewLoading } = useSWR(
    weekStartKey ? `/api/weekly/overview?week=${weekStartKey}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // Profile for Premium gating (API unchanged; just reading flags)
  const profileKey =
    mounted && session?.user?.email
      ? `/api/profile?email=${encodeURIComponent(session.user.email)}`
      : null;
  const { data: profile } = useSWR<UserAccess>(profileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});
  const [weekLoading, setWeekLoading] = useState(false);

  const deriveDayBooleans = (o: any) => {
    const isFriday = Boolean(o.isFriday ?? new Date(o.dateKey + "T00:00:00").getDay() === 5);
    const hasWorkout = Boolean(o.hasWorkout) || Boolean(o.workoutIds?.length) || Boolean(o.workoutSummary);
    const workoutDone =
      Boolean(o.workoutDone) ||
      Boolean(o.workoutSummary && (o.workoutSummary.calories || o.workoutSummary.duration || o.workoutSummary.weightUsed));
    const nutritionLogged = Boolean(o.nutritionLogged);
    const habitAllDone =
      Boolean(o.habitAllDone) ||
      (o.habitSummary ? o.habitSummary.completed >= o.habitSummary.total && o.habitSummary.total > 0 : false);
    const checkinComplete = Boolean(o.checkinComplete) || Boolean(o.checkinSummary);

    // NOTE: Freestyle is optional and does NOT contribute to 'allDone'
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

  // Weekly totals (freestyle still intentionally ignored)
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

  // Normalise check-in summary for downstream components
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

  // Base hrefs (before gating)
  const workoutHrefBase = hasWorkoutToday && hasWorkoutId ? `/workout/${workoutIds[0]}` : "#";
  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHrefBase = `/habit?date=${selectedDateKey}`;

  // NEW: deep-link check-in to the specific Friday for the selected day
  const selectedFridayYMD = formatYMD(fridayOfWeek(selectedDay));
  const checkinHref = `/checkin?date=${encodeURIComponent(selectedFridayYMD)}`;

  // Premium gating (logic only; no pills/padlocks here)
  const isPremium = Boolean(
    (profile?.subscription_status === "active" || profile?.subscription_status === "trialing") ||
    profile?.membership_status === "gym_member"
  );

  // Wed & Fri lock (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
  const weekday = selectedDay.getDay();
  const isWedOrFri = weekday === 3 || weekday === 5;

  const workoutLocked = !isPremium && isWedOrFri;
  const habitsLocked = !isPremium;

  // Apply locks to hrefs (UI-only; DailyTasksCard will show inline locks)
  const workoutHref = workoutLocked ? "#" : workoutHrefBase;
  const habitHref = habitsLocked ? "#" : habitHrefBase;

  // ---- Freestyle detection (optional task; does not affect streak/allDone) ----
  // We fetch completions for the selected day and derive freestyle info.
  const completionsKey = useMemo(() => {
    if (!mounted) return null;
    const params = new URLSearchParams();
    params.set("from", selectedDateKey);
    params.set("to", selectedDateKey);
    if (session?.user?.email) params.set("user_email", session.user.email);
    // FIXED: unified route path is /api/completions (not /api/completions/index)
    return `/api/completions?${params.toString()}`;
  }, [mounted, selectedDateKey, session?.user?.email]);

  const { data: dayCompletions } = useSWR<{ results?: Completion[]; items?: Completion[]; completions?: Completion[]; data?: Completion[] }>(
    completionsKey,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  // Extract freestyle entries for the selected day (if any)
  const { freestyleLogged, freestyleSummary } = useMemo(() => {
    const src =
      dayCompletions?.results ||
      dayCompletions?.items ||
      dayCompletions?.completions ||
      dayCompletions?.data ||
      [];
    const arr: Completion[] = Array.isArray(src) ? src : [];

    // Filter to is_freestyle === true and completed_date matching the day (defensive normalisation)
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
      return { freestyleLogged: false, freestyleSummary: undefined as undefined | { activity?: string; duration?: number; calories?: number } };
    }

    // Summarise: total duration & calories for the day; last activity label for flavour
    const totalCalories = freestyle.reduce((sum, c) => sum + (Number(c.calories_burned) || 0), 0);
    const totalDuration = freestyle.reduce((sum, c) => sum + (Number(c.duration_minutes) || 0), 0);
    const lastActivity = freestyle[freestyle.length - 1]?.activity_type || undefined;

    return {
      freestyleLogged: true,
      freestyleSummary: {
        activity: typeof lastActivity === "string" ? lastActivity : undefined,
        duration: totalDuration || undefined,
        calories: totalCalories || undefined,
      },
    };
  }, [dayCompletions, selectedDateKey]);

  // Header accents
  const accentMicro = "#ff8a2a";
  const showLoadingBar = status === "loading" || !mounted;

  // Top-level memos for WeeklyCircles (avoid conditional hooks)
  const dayStreak = useMemo(() => {
    // NOTE: streak logic intentionally ignores freestyle (optional)
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

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Modern PWA capability meta */}
        <meta name="mobile-web-app-capable" content="yes" />
      </Head>

      <main className="container py-2" style={{ paddingBottom: "70px", color: "#fff" }}>
        {/* Header — profile + greeting (left), sign out (right) */}
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
            {(showLoadingBar || weekLoading || overviewLoading) && <div className="inline-spinner" />}
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

        {/* ===== Notifications (coach-styled) ===== */}
        <section style={{ marginBottom: 10 }}>
          <NotificationsBanner />
        </section>

        {/* ===== Weekly Circles (three separate futuristic cards with slight separators) ===== */}
        {weeklyOverview?.days && mounted && (
          <div style={{ marginBottom: 12 }}>
            <WeeklyCircles
              weeklyProgressPercent={weeklyProgressPercent}
              weeklyWorkoutsCompleted={weeklyWorkoutsCompleted}
              dayStreak={dayStreak}
            />
          </div>
        )}

        {/* ===== Calendar (inline week pills) ===== */}
        {mounted && (
          <div className="d-flex justify-content-between text-center mb-3" style={{ gap: 8 }}>
            {weekDays.map((d, i) => {
              const isSelected = isSameDay(d, selectedDay);
              const dk = formatYMD(d);
              const st = weekStatus[dk];

              if (!st) {
                return (
                  <div key={i} style={{ width: 44 }}>
                    {/* Weekday label: fontWeight 500 */}
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
                  {/* Weekday label: fontWeight 500 */}
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

        {/* ===== Daily Tasks Card (selected day) ===== */}
        {mounted && selectedDayData && (
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
            // normalised summary so components can read body_fat_pct or bodyFat
            checkinSummary={checkinSummaryNormalized as any}
            checkinComplete={Boolean(selectedStatus.checkinComplete)}
            hrefs={{
              nutrition: nutritionHref,
              workout: workoutHref,
              habit: habitHref,
              checkin: checkinHref,              // <-- deep link to specific Friday
              freestyle: "/workouts/freestyle",  // optional task
            }}
            // Freestyle (optional) props
            freestyleLogged={freestyleLogged}
            freestyleSummary={freestyleSummary}
          />
        )}

        {/* Workout loading fallback */}
        {mounted && hasWorkoutToday && !hasWorkoutId && (
          <div
            className="text-center"
            style={{
              opacity: 0.8,
              fontSize: "0.9rem",
              marginTop: 8,
            }}
          >
            Loading workout details… <span className="inline-spinner" />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Add to Home Screen Prompt */}
      <AddToHomeScreen />
    </>
  );
}
