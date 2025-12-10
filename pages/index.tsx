import Head from "next/head";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import BxkrBanner from "../components/BxkrBanner";
import ChallengeBanner from "../components/ChallengeBanner";

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

/* ================= TYPES ================= */
type WorkoutLite = {
  id: string;
  workout_name?: string;
  notes?: string;
  day_name?: string;
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
};

/* ================= HELPERS ================= */
function getWeek() {
  const today = new Date();
  const day = today.getDay();
  const diffToMon = (day + 6) % 7;
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

function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts?._seconds) return ts._seconds * 1000;
  const v = new Date(ts).getTime();
  return Number.isFinite(v) ? v : 0;
}

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Home() {
  const { data: session, status } = useSession();
  const weekDays = useMemo(() => getWeek(), []);
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  /* ================= DATA ================= */
  const { data: workoutsData } = useSWR("/api/workouts", fetcher);
  const { data: completionData } = useSWR(
    session?.user?.email
      ? `/api/completions/history?email=${session.user.email}&range=all`
      : null,
    fetcher
  );

  const allCompletions = completionData?.history || [];

  const selectedDateKey = formatYMD(selectedDay);
  const selectedDayName = selectedDay.toLocaleDateString(undefined, {
    weekday: "long",
  });

  const selectedWorkouts: WorkoutLite[] = (workoutsData?.workouts || []).filter(
    (w: WorkoutLite) =>
      (w.day_name || "").toLowerCase() ===
      selectedDayName.toLowerCase()
  );

  const { data: weeklyOverview } = useSWR(
    session?.user?.email
      ? `/api/weekly/overview?week=${selectedDateKey}`
      : null,
    fetcher
  );

  /* ================= WEEK STATUS LOGIC (FIXED) ================= */
  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});

  useEffect(() => {
    if (!workoutsData?.workouts || !weeklyOverview?.days) return;

    const statuses: Record<string, DayStatus> = {};
    const workouts = workoutsData.workouts as WorkoutLite[];

    for (const d of weekDays) {
      const dk = formatYMD(d);
      const dn = d.toLocaleDateString(undefined, { weekday: "long" });

      const dayWorkouts = workouts.filter(
        (w) => (w.day_name || "").toLowerCase() === dn.toLowerCase()
      );

      const hasWorkout = dayWorkouts.length > 0;
      const workoutIds = dayWorkouts.map((w) => w.id);

      const workoutDone = hasWorkout
        ? allCompletions.some((c: any) => {
            const m = toMillis(c.completed_date || c.completed_at);
            return (
              workoutIds.includes(c.workout_id) &&
              isSameDay(new Date(m), d)
            );
          })
        : true;

      const overview = weeklyOverview.days.find(
        (x: any) => x.dateKey === dk
      );

      const nutritionLogged = !!overview?.nutritionLogged;
      const habitAllDone = !!overview?.habitAllDone;
      const isFriday = d.getDay() === 5;
      const checkinComplete = isFriday
        ? !!overview?.checkinComplete
        : true;

      const allDone =
        nutritionLogged &&
        habitAllDone &&
        workoutDone &&
        checkinComplete;

      statuses[dk] = {
        dateKey: dk,
        hasWorkout,
        workoutDone,
        nutritionLogged,
        habitAllDone,
        isFriday,
        checkinComplete,
        allDone,
      };
    }

    setWeekStatus(statuses);
  }, [weekDays, workoutsData, weeklyOverview, allCompletions]);

  /* ================= UI ================= */
  const hour = today.getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const iconWorkout = "fas fa-dumbbell";
  const iconNutrition = "fas fa-utensils";
  const iconHabit = "fas fa-check-circle";
  const iconCheckin = "fas fa-clipboard-list";

  return (
    <>
      <Head>
        <title>BXKR</title>
      </Head>

      <main className="container py-3" style={{ paddingBottom: 70 }}>
        {/* Header */}
        <div className="d-flex justify-content-between mb-3 align-items-center">
          <div className="fw-semibold">
            {greeting}, {session?.user?.name || "Athlete"}
          </div>
          {status === "authenticated" ? (
            <button
              className="btn btn-link text-light p-0"
              onClick={() => signOut()}
            >
              Sign out
            </button>
          ) : (
            <button
              className="btn btn-link text-light p-0"
              onClick={() => signIn("google")}
            >
              Sign in
            </button>
          )}
        </div>

        <ChallengeBanner
          title="New Challenge"
          message="2 Weeks of Energy"
          href="/challenge"
          iconLeft="fas fa-crown"
          accentColor="#ffcc00"
        />

        {/* Calendar */}
        <div className="d-flex justify-content-between text-center mb-3">
          {weekDays.map((d, i) => {
            const dk = formatYMD(d);
            const s = weekStatus[dk];
            return (
              <div
                key={i}
                onClick={() => setSelectedDay(d)}
                style={{ cursor: "pointer", width: 44 }}
              >
                <div>{dayLabels[i]}</div>
                <div
                  className={`bxkr-day-pill ${
                    s?.allDone ? "completed" : ""
                  }`}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Banners */}
        {!weekStatus[selectedDateKey]?.nutritionLogged && (
          <BxkrBanner
            title="Nutrition"
            message="Log today’s meals."
            href={`/nutrition?date=${selectedDateKey}`}
            iconLeft={iconNutrition}
            accentColor="#4fa3a5"
            buttonText="Start"
          />
        )}

        {weekStatus[selectedDateKey]?.hasWorkout &&
          !weekStatus[selectedDateKey]?.workoutDone && (
            <BxkrBanner
              title="Workout"
              message="Start your programmed session."
              href={`/workout/${selectedWorkouts[0]?.id}`}
              iconLeft={iconWorkout}
              accentColor="#5b7c99"
              buttonText="Start"
            />
          )}

        {!weekStatus[selectedDateKey]?.habitAllDone && (
          <BxkrBanner
            title="Daily habit"
            message="Complete today’s habits."
            href={`/habit?date=${selectedDateKey}`}
            iconLeft={iconHabit}
            accentColor="#9b6fa3"
            buttonText="Fill"
          />
        )}

        {weekStatus[selectedDateKey]?.isFriday &&
          !weekStatus[selectedDateKey]?.checkinComplete && (
            <BxkrBanner
              title="Weekly check-in"
              message="Complete your weekly check-in."
              href="/checkin"
              iconLeft={iconCheckin}
              accentColor="#c9a34e"
              buttonText="Check in"
            />
          )}
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
