
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

  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHref = `/habit?date=${selectedDateKey}`;
  const workoutHref = selectedWorkouts[0]?.id ? `/workout/${selectedWorkouts[0].id}` : habitHref;
  const checkinHref = `/checkin`;

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
          accentColor="#d97a3a"
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
          accentColor="#4fa3a5"
          buttonText="Start"
        />

        {/* Workout */}
        {selectedWorkouts.length > 0 && (
          <BxkrBanner
            title="Workout"
            message={habitAllDone ? "Workout done!" : `Start your ${selectedDayName} session.`}
            href={workoutHref}
            iconLeft="fas fa-dumbbell"
            accentColor="#5b7c99"
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
            accentColor="#9b6fa3"
            buttonText="Fill"
          />
        )}
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
