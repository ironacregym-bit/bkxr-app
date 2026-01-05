
import Head from "next/head";
import useSWR from "swr";
import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import DailyTasksCard from "../components/DailyTasksCard";
// WeeklyCircles (your current path)
import WeeklyCircles from "../components/dashboard/WeeklyCircles";

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

/**
 * 🔄 API day payload from /api/weekly/overview.
 */
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

export default function Home() {
  const { data: session, status } = useSession();

  const weekDays = useMemo(() => getWeek(), []);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const selectedDateKey = formatYMD(selectedDay);
  const weekStartKey = useMemo(() => formatYMD(startOfAlignedWeek(new Date())), []);

  const { data: weeklyOverview, isLoading: overviewLoading } = useSWR(
    `/api/weekly/overview?week=${weekStartKey}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

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

  // Derived weekly totals
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

  // ✅ Normalise check-in summary for downstream components (restore missing block)
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
      // legacy alias for components still reading `bodyFat`
      bodyFat: (s as any).bodyFat ?? body_fat_pct,
    };
  }, [selectedDayData]);

  const selectedStatus = weekStatus[selectedDateKey] || ({} as DayStatus);
  const hasWorkoutToday = Boolean(selectedStatus.hasWorkout);
  const workoutIds = selectedStatus.workoutIds || [];
  const hasWorkoutId = Array.isArray(workoutIds) && workoutIds.length > 0 && typeof workoutIds[0] === "string";
  const workoutHref = hasWorkoutToday && hasWorkoutId ? `/workout/${workoutIds[0]}` : "#";
  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHref = `/habit?date=${selectedDateKey}`;
  const checkinHref = `/checkin`;

  // Contextual metrics
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

  // ===== ONE notification (or fallback coach cue) =====
  const { data: feed } = useSWR("/api/notifications/feed?limit=1", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const primaryNotification = Array.isArray(feed?.items) ? feed.items[0] : null;

  // Compute a coach cue if no notification exists
  const coachCue = useMemo(() => {
    const w = weeklyWorkoutsCompleted;
    const p = weeklyProgressPercent;
    const streak = dayStreak;
    const todayIsFriday =
      new Date(selectedDateKey + "T00:00:00").getDay() === 5 ||
      selectedStatus.isFriday;

    if (w === 0) return "Get your first workout of the week in — a quick boxer’s conditioning will do.";
    if (w === 1) return "Strong start. Hit workout 2/3 today to lock in momentum.";
    if (w === 2) return "You’re close. Nail workout 3/3 and finish the week on a high.";
    if (todayIsFriday && !selectedStatus.checkinComplete) return "It’s Friday — complete your check‑in to keep your accountability tight.";
    if (p < 50) return "Keep the pace — small actions compound. Log nutrition and habits today.";
    if (streak >= 2) return `Protect the streak — ${streak} days in a row. One more keeps it alive.`;
    return "Own today — one meaningful action moves you forward.";
  }, [weeklyWorkoutsCompleted, weeklyProgressPercent, dayStreak, selectedDateKey, selectedStatus.isFriday, selectedStatus.checkinComplete]);

  // Optionally emit a coach cue into notifications when none exists (keeps collection logic unified)
  const emittedCoachCueRef = useRef(false);
  useEffect(() => {
    if (emittedCoachCueRef.current) return;
    if (primaryNotification) return; // already have something
    emittedCoachCueRef.current = true;
    (async () => {
      try {
        await fetch("/api/notify/emit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "coach_cue",
            context: { message: coachCue },
            force: false,
          }),
        }).catch(() => {});
      } catch {
        // noop — if rules aren’t set yet, this gracefully does nothing
      }
    })();
  }, [primaryNotification, coachCue]);

  // Contextual pressure greeting (replaces generic greeting)
  const contextualGreeting = useMemo(() => {
    const w = weeklyWorkoutsCompleted;
    const nextWorkout = Math.min(w + 1, 3);
    const todayIsFriday =
      new Date(selectedDateKey + "T00:00:00").getDay() === 5 ||
      selectedStatus.isFriday;

    if (todayIsFriday && !selectedStatus.checkinComplete) {
      return `Friday pressure: complete your check‑in to lock the week.`;
    }
    if (w < 3) {
      return `Secure your week: ${w}/3 workouts done. Hit ${nextWorkout}/3 today to keep your ${dayStreak}‑day streak.`;
    }
    if (weeklyProgressPercent < 100) {
      return `Finish strong: ${weeklyProgressPercent}% of weekly tasks done — close the gap today.`;
    }
    return `Maintain excellence: keep routines tight and prepare the next week.`;
  }, [weeklyWorkoutsCompleted, weeklyProgressPercent, dayStreak, selectedDateKey, selectedStatus.isFriday, selectedStatus.checkinComplete]);

  // Visible weekly reward (UI-only; no schema changes)
  const coinsEarned = useMemo(() => {
    // Simple pilot formula: 5 coins per completed task
    const { completedTasks } = derivedWeeklyTotals;
    return completedTasks * 5;
  }, [derivedWeeklyTotals]);

  const accentMicro = "#ff8a2a";

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Modern PWA capability meta */}
        <meta name="mobile-web-app-capable" content="yes" />
      </Head>

      <main className="container py-2" style={{ paddingBottom: "70px", color: "#fff" }}>
        {/* Header */}
        <div className="d-flex justify-content-between mb-2 align-items-center">
          <div className="d-flex align-items-center gap-2">
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt=""
                className="rounded-circle"
                style={{ width: 36, height: 36, objectFit: "cover" }}
              />
            )}
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

        {/* Contextual pressure + weekly reward */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 10,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          {/* Pressure line */}
          <div
            className="bxkr-glass-row"
            style={{
              padding: "10px 14px",
              marginBottom: 0,
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              cursor: "default",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              <i className="fas fa-bolt" style={{ color: "#ff8a2a" }} aria-hidden="true" />
              <span>{contextualGreeting}</span>
            </span>
          </div>

          {/* Coins */}
          <div
            className="bxkr-glass-row"
            style={{
              padding: "10px 14px",
              marginBottom: 0,
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              cursor: "default",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
            aria-label="Weekly reward"
            title="Pilot rewards — coins are for future partner perks"
          >
            <i className="fas fa-coins" style={{ color: "#ffd54f" }} aria-hidden="true" />
            <span style={{ fontWeight: 700 }}>{coinsEarned} BXKR coins</span>
          </div>
        </div>

        {/* ===== Single notification (or coach cue) ===== */}
        <section style={{ marginBottom: 10 }}>
          {primaryNotification ? (
            // Gradient pill with coach avatar
            <a
              href={primaryNotification.href || "#"}
              className="text-decoration-none"
              aria-label={`${primaryNotification.title}: ${primaryNotification.message}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "linear-gradient(135deg, #ff7f32, #ff9a3a)",
                borderRadius: 20,
                padding: "12px 16px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
                color: "#fff",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid rgba(255,255,255,0.4)",
                  marginRight: 12,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                {/* Replace with your coach image asset in /public */}
                <img src="/coach.jpg" alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {primaryNotification.title}
                </div>
                <div style={{ fontSize: 13, opacity: 0.95 }}>{primaryNotification.message}</div>
              </div>
              <i className="fas fa-chevron-right" aria-hidden="true" style={{ marginLeft: 12, color: "#fff" }} />
            </a>
          ) : (
            // Coach cue glass row (no gradient)
            <div
              className="bxkr-glass-row"
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
              }}
              aria-label="Coach cue"
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                <i className="fas fa-dumbbell" style={{ color: "#ff8a2a" }} aria-hidden="true" />
                <span>{coachCue}</span>
              </span>
            </div>
          )}
        </section>

        {/* ===== Weekly Circles (three separate futuristic cards with slight separators) ===== */}
        {weeklyOverview?.days && (
          <div style={{ marginBottom: 12 }}>
            <WeeklyCircles
              weeklyProgressPercent={weeklyProgressPercent}
              weeklyWorkoutsCompleted={weeklyWorkoutsCompleted}
              dayStreak={dayStreak}
            />
          </div>
        )}

        {/* Calendar */}
        <div className="d-flex justify-content-between text-center mb-3" style={{ gap: 8 }}>
          {weekDays.map((d, i) => {
            const isSelected = isSameDay(d, selectedDay);
            const dk = formatYMD(d);
            const st = weekStatus[dk];

            if (!st) {
              return (
                <div key={i} style={{ width: 44 }}>
                  <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                  </div>
                  <div className="bxkr-day-pill" style={{ opacity: 0.5 }}>
                    {d.getDate()}
                  </div>
                </div>
              );
            }

            const accentMicro = "#ff8a2a";
            const ringColor = st.allDone ? "#64c37a" : isSelected ? accentMicro : "rgba(255,255,255,0.3)";
            const boxShadow = isSelected ? `0 0 8px ${ringColor}` : st.allDone ? `0 0 3px ${ringColor}` : "none";

            return (
              <div key={i} style={{ width: 44, cursor: "pointer" }} onClick={() => setSelectedDay(d)}>
                <div style={{ fontSize: "0.8rem", color: "#fff", opacity: 0.85, marginBottom: 4 }}>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                </div>
                <div
                  className={`bxkr-day-pill ${st.allDone ? "completed" : ""}`}
                  style={{ boxShadow, fontWeight: isSelected ? 600 : 400, borderColor: st.allDone ? undefined : ringColor }}
                >
                  <span
                    className={`bxkr-day-content ${
                      st.allDone ? (isSelected ? "state-num" : "state-flame") : "state-num"
                    }`}
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

        {/* Daily Tasks Card */}
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
            // 👇 pass the normalised summary so components can read body_fat_pct or bodyFat
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

        {/* Workout loading fallback */}
        {hasWorkoutToday && !hasWorkoutId && (
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
