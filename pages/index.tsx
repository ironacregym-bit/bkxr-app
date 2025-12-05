
import Head from "next/head";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import BxkrBanner from "../components/BxkrBanner";

export const getServerSideProps: GetServerSideProps = async (context: GetServerSidePropsContext) => {
  const session = await getSession(context);
  if (!session) {
    return { redirect: { destination: "/landing", permanent: false } };
  }
  return { props: {} };
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// ✅ Helpers
function getWeek(): Date[] {
  const today = new Date();
  const day = today.getDay();
  const diffToMon = (day + 6) % 7; // Monday start
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatYMD(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n.toISOString().slice(0, 10);
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

function endOfAlignedWeek(d: Date) {
  const s = startOfAlignedWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts?._seconds != null) return ts._seconds * 1000;
  if (ts?.seconds != null) return ts.seconds * 1000;
  const v = new Date(ts).getTime();
  return Number.isFinite(v) ? v : 0;
}

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Home() {
  const { data: session, status } = useSession();

  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);
  const { data: completionData } = useSWR(
    session?.user?.email ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}&range=all` : null,
    fetcher
  );
  const allCompletions = completionData?.history || [];

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      fetch("/api/users/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.user.email,
          name: session.user.name || "",
          image: session.user.image || "",
        }),
      }).catch(() => {});
    }
  }, [status, session?.user?.email]);

  const weekDays = getWeek();
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  const greeting = today.getHours() < 12 ? "Good Morning" : today.getHours() < 18 ? "Good Afternoon" : "Good Evening";
  const selectedDayName = selectedDay.toLocaleDateString(undefined, { weekday: "long" });

  const selectedWorkouts = (data?.workouts || []).filter(
    (w: any) => (w.day_name || "").toLowerCase() === selectedDayName.toLowerCase()
  );

  const thisWeekStart = startOfAlignedWeek(today);
  const thisWeekEnd = endOfAlignedWeek(today);
  const weeklyCompletedCount = useMemo(() => {
    return allCompletions.filter((c: any) => {
      const m = toMillis(c.completed_date || c.completed_at || c.started_at);
      return m >= thisWeekStart.getTime() && m <= thisWeekEnd.getTime();
    }).length;
  }, [allCompletions, thisWeekStart, thisWeekEnd]);
  const sessionsAway = Math.max(0, 3 - weeklyCompletedCount);

  const selectedDateKey = formatYMD(selectedDay);

  // Habit data
  const { data: habitForSelected } = useSWR(
    session?.user?.email ? `/api/habits/logs?date=${selectedDateKey}` : null,
    fetcher
  );
  const habitEntry = habitForSelected?.entry || null;
  const habitAllDone =
    !!habitEntry &&
    habitEntry["2l_water"] &&
    habitEntry.assigned_workouts_completed &&
    habitEntry.macros_filled &&
    habitEntry.step_count &&
    habitEntry.time_outside;

  const { data: checkinForWeek } = useSWR(
    session?.user?.email && selectedDay.getDay() === 5
      ? `/api/checkins/weekly?week=${formatYMD(selectedDay)}`
      : null,
    fetcher
  );
  const checkinComplete = !!checkinForWeek?.entry;

  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHref = `/habit?date=${selectedDateKey}`;
  const workoutHref = selectedWorkouts[0]?.id ? `/workout/${selectedWorkouts[0].id}` : habitHref;
  const checkinHref = `/checkin`;

  // Accent colors
  const accentMicro = "#d97a3a";
  const accentNutrition = "#4fa3a5";
  const accentWorkout = "#5b7c99";
  const accentHabit = "#9b6fa3";
  const accentCheckin = "#c9a34e";

  return (
    <>
      <Head>
        <title>BXKR</title>
        <style>{`
          .bxkr-day {
            width: 40px;
            height: 40px;
            line-height: 40px;
            border-radius: 999px;
            margin: 0 auto;
            text-align: center;
            color: #fff;
            border: 2px solid rgba(255,255,255,0.3);
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .bxkr-day.active {
            border-color: #d97a3a;
            box-shadow: 0 0 8px #d97a3a;
            font-weight: 700;
          }
        `}</style>
      </Head>

      <main style={{ paddingBottom: "70px", background: "linear-gradient(135deg,#1a1a1a,#2e1a0f)", color: "#fff" }}>
        {/* Greeting */}
        <h2 style={{ fontWeight: 700 }}>{greeting}, {session?.user?.name || "Athlete"}</h2>

        {/* Momentum */}
        <BxkrBanner
          title="Momentum"
          message={`You’re ${sessionsAway} sessions away from your weekly goal.`}
          href={workoutHref}
          iconLeft="fas fa-bolt"
          accentColor={accentMicro}
          buttonText="Start"
        />

        {/* Calendar */}
        <div className="d-flex justify-content-between text-center mb-3" style={{ gap: 8 }}>
          {weekDays.map((d, i) => {
            const isSelected = isSameDay(d, selectedDay);
            return (
              <div key={i} style={{ width: 44 }} onClick={() => setSelectedDay(d)}>
                <div style={{ fontSize: "0.8rem", color: "#fff", opacity: 0.85 }}>{dayLabels[i]}</div>
                <div className={`bxkr-day ${isSelected ? "active" : ""}`}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* Nutrition */}
        <BxkrBanner
          title="Nutrition"
          message="Log today’s meals and macros."
          href={nutritionHref}
          iconLeft="fas fa-utensils"
          accentColor={accentNutrition}
          buttonText="Start"
        />

        {/* Workout */}
        {selectedWorkouts.length > 0 && (
          <BxkrBanner
            title="Workout"
            message={habitAllDone ? "Workout done!" : `Start your ${selectedDayName} session.`}
            href={workoutHref}
            iconLeft="fas fa-dumbbell"
            accentColor={accentWorkout}
            buttonText="Start"
          />
        )}

        {/* Daily Habit */}
        {!habitAllDone && (
          <BxkrBanner
            title="Daily habit"
            message={`Fill in your daily habit for ${selectedDayName}.`}
            href={habitHref}
            iconLeft="fas fa-check-circle"
            accentColor={accentHabit}
            buttonText="Fill"
          />
        )}

        {/* Weekly Check-in */}
        {selectedDay.getDay() === 5 && (
          <BxkrBanner
            title="Weekly check‑in"
            message={checkinComplete ? "Check‑in submitted." : "Complete your weekly check‑in."}
            href={checkinHref}
            iconLeft="fas fa-clipboard-list"
            accentColor={accentCheckin}
            buttonText={checkinComplete ? "Review" : "Check in"}
          />
        )}

        {error && <div className="alert alert-danger">Failed to load workouts</div>}
        {isLoading && <div className="alert alert-secondary">Loading…</div>}
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
