
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

export default function Home() {
  const { data: session, status } = useSession();
  const weekDays = useMemo(() => getWeek(), []);
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  const greeting =
    today.getHours() < 12 ? "Good Morning" : today.getHours() < 18 ? "Good Afternoon" : "Good Evening";
  const selectedDateKey = formatYMD(selectedDay);
  const weekStartKey = useMemo(() => formatYMD(startOfAlignedWeek(new Date())), []);

  const { data: weeklyOverview } = useSWR(`/api/weekly/overview?week=${weekStartKey}`, fetcher);

  const [weekStatus, setWeekStatus] = useState<Record<string, any>>({});
  useEffect(() => {
    if (!weeklyOverview?.days) return;
    const statuses: Record<string, any> = {};
    for (const o of weeklyOverview.days) {
      const allDone =
        (!o.hasWorkout || o.workoutDone) &&
        o.nutritionLogged &&
        o.habitAllDone &&
        (!o.isFriday || o.checkinComplete);
      statuses[o.dateKey] = { ...o, allDone };
    }
    setWeekStatus(statuses);
  }, [weeklyOverview]);

  const dayStreak = useMemo(() => {
    let streak = 0;
    for (const d of weekDays) {
      const st = weekStatus[formatYMD(d)];
      if (!st) break;
      if (st.allDone) streak++;
      else streak = 0;
      if (isSameDay(d, selectedDay)) break;
    }
    return streak;
  }, [weekDays, weekStatus, selectedDay]);

  const workoutStreak = useMemo(() => {
    let streak = 0;
    for (const d of weekDays) {
      const st = weekStatus[formatYMD(d)];
      if (!st) break;
      if (st.hasWorkout) {
        if (st.workoutDone) streak++;
        else streak = 0;
      }
      if (isSameDay(d, selectedDay)) break;
    }
    return streak;
  }, [weekDays, weekStatus, selectedDay]);

  const derivedWeeklyTotals = weeklyOverview?.weeklyTotals || {
    totalWorkoutsCompleted: 0,
    totalWorkoutTime: 0,
    totalCaloriesBurned: 0,
  };

  // Carousel logic
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const goToSlide = (idx: number) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
    setSlideIndex(idx);
  };

  return (
    <>
      <Head>
        <title>BXKR</title>
      </Head>
      <main className="container py-3" style={{ paddingBottom: "70px", color: "#fff" }}>
        {/* Greeting */}
        <h2 style={{ fontWeight: 700 }}>{greeting}, {session?.user?.name || "Athlete"}</h2>

        {/* Weekly Progress */}
        {weeklyOverview && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>Weekly Progress</div>
            <div style={{ background: "#333", borderRadius: 8, overflow: "hidden", height: 12 }}>
              <div
                style={{
                  width: `${(weeklyOverview.completedTasks / weeklyOverview.totalTasks) * 100}%`,
                  background: "#64c37a",
                  height: "100%"
                }}
              />
            </div>
            <div style={{ fontSize: "0.85rem" }}>
              {weeklyOverview.completedTasks} / {weeklyOverview.totalTasks} tasks completed
            </div>
          </div>
        )}

        {/* Carousel */}
        <div className="bxkr-carousel" ref={carouselRef}>
          {/* Slide 1: Share */}
          <section className="bxkr-slide">
            <ChallengeBanner
              title="Share Your Progress"
              message=""
              href="#"
              iconLeft="fas fa-share-alt"
              accentColor="#ffb347" // softened orange
              extraContent={<button className="bxkr-btn" disabled>Coming Soon</button>}
              style={{ margin: 0 }}
            />
          </section>

          {/* Slide 2: Streaks */}
          <section className="bxkr-slide">
            <ChallengeBanner
              title="Streaks"
              message={
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                  <div style={{ textAlign: "center", flex: 1 }}>
                    <strong>Day</strong><br />{dayStreak}
                  </div>
                  <div style={{ textAlign: "center", flex: 1 }}>
                    <strong>Workout</strong><br />{workoutStreak}
                  </div>
                </div>
              }
              href="#"
              iconLeft="fas fa-fire"
              accentColor="#64c37a"
              showButton={false}
              style={{ margin: 0 }}
            />
          </section>

          {/* Slide 3: Weekly Snapshot */}
          <section className="bxkr-slide">
            <ChallengeBanner
              title="Weekly Snapshot"
              message={
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                  <div style={{ textAlign: "center", flex: 1 }}>
                    <strong>Workouts</strong><br />{derivedWeeklyTotals.totalWorkoutsCompleted}
                  </div>
                  <div style={{ textAlign: "center", flex: 1 }}>
                    <strong>Time</strong><br />{derivedWeeklyTotals.totalWorkoutTime}m
                  </div>
                  <div style={{ textAlign: "center", flex: 1 }}>
                    <strong>Calories</strong><br />{derivedWeeklyTotals.totalCaloriesBurned} kcal
                  </div>
                </div>
              }
              href="#"
              iconLeft="fas fa-chart-line"
              accentColor="#5b7c99"
              showButton={false}
              style={{ margin: 0 }}
            />
          </section>
        </div>

        {/* Carousel dots */}
        <div className="bxkr-carousel-dots">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              className={`bxkr-carousel-dot ${slideIndex === i ? "active" : ""}`}
              onClick={() => goToSlide(i)}
            />
          ))}
        </div>

        {/* Calendar */}
        {/* ... keep your existing calendar and DailyTasksCard logic here ... */}
      </main>
      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
