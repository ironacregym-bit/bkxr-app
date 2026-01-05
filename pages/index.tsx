
// pages/index.tsx
import Head from "next/head";
import useSWR from "swr";
import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import DailyTasksCard from "../components/DailyTasksCard";
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

type FeedItem = {
  id: string;
  title: string;
  message: string;
  href?: string | null;
  created_at?: string | null;
  read_at?: string | null;
  delivered_channels?: string[];
  source_key?: string;
  source_event?: string | null;
  meta?: any;
};

export default function Home() {
  const { data: session, status } = useSession();

  // Basic time-of-day text used within urgency copy
  const timeGreeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";
  })();

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

  // Weekly totals
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

  // Urgency greeting (white text next to profile)
  const urgencyGreeting = useMemo(() => {
    const w = weeklyWorkoutsCompleted;
    const nextWorkout = Math.min(w + 1, 3);
    const today = new Date(selectedDateKey + "T00:00:00").getDay();
    const isFriday = today === 5 || selectedStatus.isFriday;

    if (isFriday && !selectedStatus.checkinComplete) {
      return `${timeGreeting} — Friday pressure: complete your check‑in to lock the week.`;
    }
    if (w < 3) {
      return `${timeGreeting} — secure your week: ${w}/3 workouts done. Hit ${nextWorkout}/3 today to keep your ${dayStreak}‑day streak.`;
    }
    if (weeklyProgressPercent < 100) {
      return `${timeGreeting} — finish strong: ${weeklyProgressPercent}% done. Close the gap today.`;
    }
    return `${timeGreeting} — maintain excellence and prep the next week.`;
  }, [timeGreeting, weeklyWorkoutsCompleted, weeklyProgressPercent, dayStreak, selectedDateKey, selectedStatus.isFriday, selectedStatus.checkinComplete]);

  // Coins (UI-only for now)
  const coinsEarned = useMemo(() => {
    // Pilot: 5 coins per completed task. Adjust later and persist server-side.
    const { completedTasks } = derivedWeeklyTotals;
    return completedTasks * 5;
  }, [derivedWeeklyTotals]);

  // Notifications feed (cycle if multiple)
  const { data: feed } = useSWR("/api/notifications/feed?limit=5", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const items: FeedItem[] = Array.isArray(feed?.items) ? (feed.items as FeedItem[]) : [];
  const [notifIndex, setNotifIndex] = useState<number>(0);
  useEffect(() => {
    if (!items.length) setNotifIndex(0);
    else setNotifIndex((i) => Math.min(i, items.length - 1));
  }, [items.length]);

  const goPrev = () => setNotifIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
  const goNext = () => setNotifIndex((i) => (i >= items.length - 1 ? 0 : i + 1));

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
        {/* Header — profile + urgency greeting (left), coins + sign out (right) */}
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
            {(weekLoading || overviewLoading) && <div className="inline-spinner" />}
            {/* Urgency-based white greeting next to profile */}
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
              aria-label="Urgent greeting"
            >
              {urgencyGreeting}
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Coins pill */}
            <div
              className="bxkr-glass-row"
              style={{
                padding: "6px 10px",
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
                gap: 6,
                fontSize: "0.9rem",
              }}
              aria-label="Weekly reward coins"
              title="Coins will be persisted to your profile in a future update"
            >
              <i className="fas fa-coins" style={{ color: "#ffd54f" }} aria-hidden="true" />
              <span style={{ fontWeight: 700 }}>{coinsEarned} BXKR</span>
            </div>

            {/* Sign in/out */}
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

        {/* ===== Notifications (coach-styled, cyclic if >1) ===== */}
        <section style={{ marginBottom: 10 }}>
          {items.length > 0 ? (
            <div
              className="bxkr-card"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                padding: 8,
                borderRadius: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #ff7f32, #ff9a3a)",
                  color: "#fff",
                }}
              >
                {/* Coach avatar */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "2px solid rgba(255,255,255,0.4)",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  <img
                    src="/coach.jpg"
                    alt="Coach"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>

                {/* Notification body */}
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {items[notifIndex]?.title}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.95 }}>
                    {items[notifIndex]?.message}
                  </div>
                </div>

                {/* CTA chevron */}
                {items[notifIndex]?.href && (
                  <a
                    href={items[notifIndex].href ?? "#"}
                    aria-label="Open"
                    style={{ color: "#fff" }}
                  >
                    <i className="fas fa-chevron-right" aria-hidden="true" />
                  </a>
                )}
              </div>

              {/* Controls: prev/next + dots */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 6,
                }}
              >
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-sm btn-bxkr-outline"
                    onClick={goPrev}
                    aria-label="Previous notification"
                    style={{ borderRadius: 999 }}
                  >
                    ←
                  </button>
                  <button
                    className="btn btn-sm btn-bxkr"
                    onClick={goNext}
                    aria-label="Next notification"
                    style={{
                      borderRadius: 999,
                      background: "linear-gradient(135deg, #ff7f32, #ff9a3a)",
                    }}
                  >
                    →
                  </button>
                </div>

                <div className="bxkr-carousel-dots">
                  {items.map((_: FeedItem, i: number) => (
                    <button
                      key={i}
                      type="button"
                      className={`bxkr-carousel-dot ${notifIndex === i ? "active" : ""}`}
                      aria-label={`Notification ${i + 1}`}
                      onClick={() => setNotifIndex(i)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
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

            const ringColor = st.allDone ? "#64c37a" : isSelected ? accentMicro : "rgba(255,255,255,0.3)";
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
            // 👇 normalised summary so components can read body_fat_pct or bodyFat
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
