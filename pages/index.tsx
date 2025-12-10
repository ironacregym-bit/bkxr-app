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

// ---------- Types
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

// ---------- Helpers
function getWeek(): Date[] {
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

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Home() {
  const { data: session, status } = useSession();

  const weekDays = useMemo(() => getWeek(), []);
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  const selectedDateKey = formatYMD(selectedDay);
  const selectedDayName = selectedDay.toLocaleDateString(undefined, { weekday: "long" });

  // ---------- WEEKLY OVERVIEW (SOLE CALENDAR SOURCE)
  const { data: weeklyOverview, isLoading: overviewLoading } = useSWR(
    session?.user?.email
      ? `/api/weekly/overview?week=${selectedDateKey}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // ---------- Calendar state (authoritative)
  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus> | null>(null);

  useEffect(() => {
    if (!weeklyOverview?.days?.length) return;

    const statuses: Record<string, DayStatus> = {};

    for (const o of weeklyOverview.days as any[]) {
      const allDone =
        (o.hasWorkout ? o.workoutDone : true) &&
        o.nutritionLogged &&
        o.habitAllDone &&
        (!o.isFriday || o.checkinComplete);

      statuses[o.dateKey] = {
        dateKey: o.dateKey,
        hasWorkout: !!o.hasWorkout,
        workoutDone: !!o.workoutDone,
        nutritionLogged: !!o.nutritionLogged,
        habitAllDone: !!o.habitAllDone,
        isFriday: !!o.isFriday,
        checkinComplete: !!o.checkinComplete,
        allDone,
      };
    }

    setWeekStatus(statuses);
  }, [weeklyOverview]);

  // ---------- Selected-day detail (banners only)
  const { data: nutritionForSelected } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${selectedDateKey}` : null,
    fetcher
  );
  const nutritionLogged = (nutritionForSelected?.entries?.length || 0) > 0;

  const { data: habitForSelected } = useSWR(
    session?.user?.email ? `/api/habits/logs?date=${selectedDateKey}` : null,
    fetcher
  );
  const habitEntry = habitForSelected?.entry;
  const habitAllDone =
    !!habitEntry &&
    habitEntry["2l_water"] &&
    habitEntry.assigned_workouts_completed &&
    habitEntry.macros_filled &&
    habitEntry.step_count &&
    habitEntry.time_outside;

  const isFridaySelected = selectedDay.getDay() === 5;
  const { data: checkinForWeek } = useSWR(
    session?.user?.email && isFridaySelected
      ? `/api/checkins/weekly?week=${selectedDateKey}`
      : null,
    fetcher
  );
  const checkinComplete = !!checkinForWeek?.entry;

  // ---------- FORCE calendar refresh when tasks complete
  useEffect(() => {
    if (!session?.user?.email) return;
    fetch(`/api/weekly/overview?week=${selectedDateKey}`).catch(() => {});
  }, [nutritionLogged, habitAllDone, checkinComplete]);

  // ---------- UI
  const greeting =
    today.getHours() < 12
      ? "Good Morning"
      : today.getHours() < 18
      ? "Good Afternoon"
      : "Good Evening";

  const ringGreenStrong = "#64c37a";
  const ringNeutral = "rgba(255,255,255,0.3)";

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3" style={{ paddingBottom: 70, color: "#fff" }}>
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="fw-semibold">{session?.user?.name || "Athlete"}</div>
          {status === "authenticated" ? (
            <button className="btn btn-link text-light p-0" onClick={() => signOut()}>
              Sign out
            </button>
          ) : (
            <button className="btn btn-link text-light p-0" onClick={() => signIn("google")}>
              Sign in
            </button>
          )}
        </div>

        <h2 style={{ fontWeight: 700 }}>
          {greeting}, {session?.user?.name || "Athlete"}
        </h2>

        <ChallengeBanner
          title="New Challenge"
          message="2 Weeks of Energy"
          href="/challenge"
          iconLeft="fas fa-crown"
          accentColor="#ffcc00"
        />

        {/* Calendar */}
        <div className="d-flex justify-content-between text-center my-3">
          {weekDays.map((d, i) => {
            const dk = formatYMD(d);
            const status = weekStatus?.[dk];
            const isSelected = isSameDay(d, selectedDay);

            return (
              <div key={i} style={{ width: 44 }} onClick={() => setSelectedDay(d)}>
                <div style={{ fontSize: 12 }}>{dayLabels[i]}</div>

                <div
                  className={`bxkr-day-pill ${status?.allDone ? "completed" : ""}`}
                  style={{
                    borderColor: status?.allDone ? ringGreenStrong : ringNeutral,
                    boxShadow: status?.allDone ? `0 0 8px ${ringGreenStrong}` : "none",
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {!nutritionLogged && (
          <BxkrBanner
            title="Nutrition"
            message="Log today’s meals."
            href={`/nutrition?date=${selectedDateKey}`}
            iconLeft="fas fa-utensils"
            accentColor="#4fa3a5"
          />
        )}

        {!habitAllDone && (
          <BxkrBanner
            title="Daily Habit"
            message={`Complete your habits for ${selectedDayName}.`}
            href={`/habit?date=${selectedDateKey}`}
            iconLeft="fas fa-check-circle"
            accentColor="#9b6fa3"
          />
        )}

        {isFridaySelected && !checkinComplete && (
          <BxkrBanner
            title="Weekly Check-in"
            message="Reflect on your week."
            href="/checkin"
            iconLeft="fas fa-clipboard-list"
            accentColor="#c9a34e"
          />
        )}
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
