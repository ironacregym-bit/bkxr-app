
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
  checkinSummary?: { weight: number; bodyFat: number; weightChange?: number; bfChange?: number };
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

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";
  })();
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

  // ✅ FIXED STREAK LOGIC
  const dayStreak = useMemo(() => {
    let streak = 0;
    for (const d of weekDays) {
      const st = weekStatus[formatYMD(d)];
      if (!st) break;

      if (d < selectedDay && st.allDone) {
        streak++;
      } else if (d < selectedDay && !st.allDone) {
        streak = 0;
      }

      if (isSameDay(d, selectedDay)) break;
    }
    return streak;
  }, [weekDays, weekStatus, selectedDay]);

  const workoutStreak = useMemo(() => {
    let streak = 0;
    for (const d of weekDays) {
      const st = weekStatus[formatYMD(d)];
      if (!st) break;

      if (d < selectedDay && st.hasWorkout) {
        if (st.workoutDone) streak++;
        else streak = 0;
      }

      if (isSameDay(d, selectedDay)) break;
    }
    return streak;
  }, [weekDays, weekStatus, selectedDay]);

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

  const selectedStatus = weekStatus[selectedDateKey] || ({} as DayStatus);
  const hasWorkoutToday = Boolean(selectedStatus.hasWorkout);
  const workoutIds = selectedStatus.workoutIds || [];
  const hasWorkoutId = Array.isArray(workoutIds) && workoutIds.length > 0 && typeof workoutIds[0] === "string";
  const workoutHref = hasWorkoutToday && hasWorkoutId ? `/workout/${workoutIds[0]}` : "#";
  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHref = `/habit?date=${selectedDateKey}`;
  const checkinHref = `/checkin`;

  const accentMicro = "#ff8a2a"; // Neon Orange

  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const goToSlide = (idx: number) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
    setSlideIndex(idx);
  };
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
      if (idx !== slideIndex) setSlideIndex(idx);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [slideIndex]);

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
              <img src={session.user.image} alt="" className="rounded-circle" style={{ width: 36, height: 36, objectFit: "cover" }} />
            )}
            {(weekLoading || overviewLoading) && <div className="inline-spinner" />}
          </div>
          {status === "authenticated" ? (
            <button className="btn btn-link text-light p-0" onClick={() => signOut()}>Sign out</button>
          ) : (
            <button className="btn btn-link text-light p-0" onClick={() => signIn("google")} style={{ background: "transparent", border: "none", textDecoration: "underline" }}>
              Sign in
            </button>
          )}
        </div>

        {/* Greeting */}
        <h2 className="mb-3" style={{ fontWeight: 700, fontSize: "1.4rem" }}>
          {greeting}
        </h2>

        {/* Weekly Progress */}
        {weeklyOverview?.days && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Weekly Progress</div>
            <div style={{ background: "#333", borderRadius: 8, overflow: "hidden", height: 12 }}>
              <div
                style={{
                  width:
                    derivedWeeklyTotals.totalTasks > 0
                      ? `${(derivedWeeklyTotals.completedTasks / derivedWeeklyTotals.totalTasks) * 100}%`
                      : "0%",
                  background: accentMicro,
                  height: "100%",
                  transition: "width .4s ease"
                }}
              />
            </div>
            <div style={{ fontSize: "0.85rem", marginTop: 4 }}>
              {derivedWeeklyTotals.completedTasks} / {derivedWeeklyTotals.totalTasks} tasks completed
            </div>
          </div>
        )}

        {/* Carousel */}
        <div className="bxkr-carousel" ref={carouselRef} aria-label="Weekly banners carousel">
          {/* Slide 1 */}
          <section className="bxkr-slide">
            <ChallengeBanner
              title="Share Your Progress"
              message=""
              href="#"
              iconLeft="fas fa-share-alt"
              accentColor="#ff8a2a"
              background="linear-gradient(90deg, rgba(217,122,58,.38), rgba(255,179,71,.32))"
              extraContent={<button className="bxkr-btn" disabled>Coming soon</button>}
              style={{ margin: 0 }}
            />
          </section>

          {/* Slide 2 */}
          <section className="bxkr-slide">
            <ChallengeBanner
              title="Streaks"
              message={
                <div className="challenge-banner-message">
                  <div className="stats-row">
                    <div className="stats-col"><strong>Day</strong>{dayStreak}</div>
                    <div className="stats-col"><strong>Workout</strong>{workoutStreak}</div>
                    <div className="stats-col"><strong>—</strong></div>
                  </div>
                </div>
              }
              href="#"
              iconLeft="fas fa-fire"
              accentColor="#64c37a"
              background="linear-gradient(90deg, rgba(79,163,165,.28), rgba(100,195,122,.24))"
              showButton={false}
              style={{ margin: 0 }}
            />
          </section>

          {/* Slide 3 */}
          <section className="bxkr-slide">
            <ChallengeBanner
              title="Weekly Snapshot"
              message={
                <div className="challenge-banner-message">
                  <div className="stats-row">
                    <div className="stats-col"><strong>Workouts</strong>{weeklyOverview?.weeklyTotals?.totalWorkoutsCompleted ?? 0}</div>
                    <div className="stats-col"><strong>Time</strong>{(weeklyOverview?.weeklyTotals?.totalWorkoutTime ?? 0)}m</div>
                    <div className="stats-col"><strong>Calories</strong>{(weeklyOverview?.weeklyTotals?.totalCaloriesBurned ?? 0)} kcal</div>
                  </div>
                </div>
              }
              href="#"
              iconLeft="fas fa-chart-line"
              accentColor="#5b7c99"
              background="linear-gradient(90deg, rgba(91,124,153,.30), rgba(91,124,153,.18))"
              showButton={false}
              style={{ margin: 0 }}
            />
          </section>
        </div>

        {/* Carousel dots */}
        <div className="bxkr-carousel-dots" role="tablist" aria-label="Carousel pagination">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              className={`bxkr-carousel-dot ${slideIndex === i ? "active" : ""}`}
              aria-label={`Go to slide ${i + 1}`}
              aria-selected={slideIndex === i}
              onClick={() => goToSlide(i)}
            />
          ))}
        </div>

       
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
                    {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}
                  </div>
                  <div className="bxkr-day-pill" style={{ opacity: 0.5 }}>
                    {d.getDate()}
                  </div>
                </div>
              );
            }

            const ringColor = st.allDone ? "#64c37a" : (isSelected ? accentMicro : "rgba(255,255,255,0.3)");
            const boxShadow = isSelected ? `0 0 8px ${ringColor}` : (st.allDone ? `0 0 3px ${ringColor}` : "none");

            return (
              <div key={i} style={{ width: 44, cursor: "pointer" }} onClick={() => setSelectedDay(d)}>
                <div style={{ fontSize: "0.8rem", color: "#fff", opacity: 0.85, marginBottom: 4 }}>
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}
                </div>
                <div
                  className={`bxkr-day-pill ${st.allDone ? "completed" : ""}`}
                  style={{ boxShadow, fontWeight: isSelected ? 600 : 400, borderColor: st.allDone ? undefined : ringColor }}
                >
                  <span className={`bxkr-day-content ${st.allDone ? (isSelected ? "state-num" : "state-flame") : "state-num"}`}>
                    {st.allDone && !isSelected ? (
                      <i
                        className="fas fa-fire"
                        style={{
                          color: "#64c37a",
                          textShadow: `0 0 8px #64c37a`,
                          fontSize: "1rem",
                          lineHeight: 1
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
            checkinSummary={selectedDayData.checkinSummary}
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
