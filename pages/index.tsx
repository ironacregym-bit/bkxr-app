
import Head from "next/head";
import useSWR, { mutate } from "swr";
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
function startOfAlignedWeek(d: Date) {
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s;
}

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Home() {
  const { data: session, status } = useSession();

  const weekDays = useMemo(() => getWeek(), []);
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  const hour = today.getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const selectedDateKey = formatYMD(selectedDay);

  // Compute week start key for API
  const weekStartKey = useMemo(() => {
    const s = startOfAlignedWeek(new Date());
    s.setHours(0, 0, 0, 0);
    return s.toISOString().slice(0, 10);
  }, []);

  // Fetch weekly overview
  const { data: weeklyOverview, isLoading: overviewLoading } = useSWR(
    session?.user?.email ? `/api/weekly/overview?week=${weekStartKey}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60_000 }
  );

  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});
  const [weekLoading, setWeekLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!weeklyOverview?.days?.length) return;

    setWeekLoading(true);
    const statuses: Record<string, DayStatus> = {};

    for (const o of weeklyOverview.days as any[]) {
      const allDone =
        (!o.hasWorkout || o.workoutDone) &&
        o.nutritionLogged &&
        o.habitAllDone &&
        (!o.isFriday || o.checkinComplete);

      statuses[o.dateKey] = {
        dateKey: o.dateKey,
        hasWorkout: o.hasWorkout,
        workoutDone: o.workoutDone,
        nutritionLogged: o.nutritionLogged,
        habitAllDone: o.habitAllDone,
        isFriday: o.isFriday,
        checkinComplete: o.checkinComplete,
        allDone,
      };
    }

    setWeekStatus(statuses);
    setWeekLoading(false);
  }, [weeklyOverview]);

  const selectedStatus = weekStatus[selectedDateKey] || {};
  const hasWorkoutToday = selectedStatus.hasWorkout;
  const workoutDoneToday = selectedStatus.workoutDone;
  const nutritionLogged = selectedStatus.nutritionLogged;
  const habitAllDone = selectedStatus.habitAllDone;
  const checkinComplete = selectedStatus.checkinComplete;
  const isFridaySelected = selectedStatus.isFriday;

  // Hrefs
  const workoutHref = hasWorkoutToday ? `/workout/${selectedDateKey}` : `/habit?date=${selectedDateKey}`;
  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHref = `/habit?date=${selectedDateKey}`;
  const checkinHref = `/checkin`;

  const iconMicro = "fas fa-bolt";
  const iconNutrition = "fas fa-utensils";
  const iconWorkout = "fas fa-dumbbell";
  const iconHabit = "fas fa-check-circle";
  const iconCheckin = "fas fa-clipboard-list";

  const accentMicro = "#d97a3a";
  const accentNutrition = "#4fa3a5";
  const accentWorkout = "#5b7c99";
  const accentHabit = "#9b6fa3";
  const accentCheckin = "#c9a34e";
  const ringGreenStrong = "#64c37a";
  const ringGreenMuted = "#4ea96a";

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3" style={{ paddingBottom: "70px", color: "#fff", borderRadius: 12 }}>
        {/* Header */}
        <div className="d-flex justify-content-between mb-3 align-items-center">
          <div className="d-flex align-items-center gap-2">
            {session?.user?.image && (
              <img src={session.user.image} alt="" className="rounded-circle" style={{ width: 36, height: 36, objectFit: "cover" }} />
            )}
            <div className="fw-semibold">{session?.user?.name || "Athlete"}</div>
            {(weekLoading || overviewLoading) && <div className="inline-spinner" />}
          </div>
          {status === "authenticated" ? (
            <button className="btn btn-link text-light p-0" onClick={() => signOut()}>Sign out</button>
          ) : (
            <button className="btn btn-link text-light p-0" onClick={() => signIn("google")} style={{ background: "transparent", border: "none", textDecoration: "underline" }}>Sign in</button>
          )}
        </div>

        {/* Greeting */}
        <h2 className="mb-3" style={{ fontWeight: 700, fontSize: "1.6rem" }}>
          {greeting}, {session?.user?.name || "Athlete"}
        </h2>

        {/* Challenge Banner */}
        <ChallengeBanner
          title="New Challenge"
          message="2 Weeks of Energy"
          href="/challenge"
          iconLeft="fas fa-crown"
          accentColor="#ffcc00"
        />

        {/* Calendar */}
        <div className="d-flex justify-content-between text-center mb-3" style={{ gap: 8 }}>
          {weekDays.map((d, i) => {
            const isSelected = isSameDay(d, selectedDay);
            const dk = formatYMD(d);
            const status = weekStatus[dk];

            if (!status) {
              return (
                <div key={i} style={{ width: 44 }}>
                  <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>{dayLabels[i]}</div>
                  <div className="bxkr-day-pill" style={{ opacity: 0.5 }}>{d.getDate()}</div>
                </div>
              );
            }

            const ringColor = status.allDone
              ? (isSelected ? ringGreenStrong : ringGreenMuted)
              : (isSelected ? accentMicro : "rgba(255,255,255,0.3)");

            const boxShadow = isSelected
              ? `0 0 8px ${ringColor}`
              : (status.allDone ? `0 0 3px ${ringColor}` : "none");

            return (
              <div key={i} style={{ width: 44, cursor: "pointer" }} onClick={() => setSelectedDay(d)}>
                <div style={{ fontSize: "0.8rem", color: "#fff", opacity: 0.85, marginBottom: 4 }}>{dayLabels[i]}</div>
                <div
                  className={`bxkr-day-pill ${status.allDone ? "completed" : ""}`}
                  style={{ boxShadow, fontWeight: isSelected ? 600 : 400, borderColor: status.allDone ? undefined : ringColor }}
                >
                  {d.getDate()}
                </div>
                <div className="bxkr-dots">
                  {status.hasWorkout && !status.workoutDone && (
                    <span className="bxkr-dot" style={{ color: accentWorkout, backgroundColor: accentWorkout }} />
                  )}
                  {status.isFriday && !status.checkinComplete && (
                    <span className="bxkr-dot" style={{ color: accentCheckin, backgroundColor: accentCheckin }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Banners */}
        {!nutritionLogged && (
          <BxkrBanner title="Nutrition" message="Log today’s meals and macros." href={nutritionHref} iconLeft={iconNutrition} accentColor={accentNutrition} buttonText="Start" />
        )}
        {hasWorkoutToday && !workoutDoneToday && (
          <BxkrBanner title="Workout" message={`Start your programmed session for ${selectedDay.toLocaleDateString(undefined, { weekday: "long" })}.`} href={workoutHref} iconLeft={iconWorkout} accentColor={accentWorkout} buttonText="Start" />
        )}
        {!habitAllDone && (
          <BxkrBanner title="Daily habit" message={`Fill in your daily habit for ${selectedDay.toLocaleDateString(undefined, { weekday: "long" })}.`} href={habitHref} iconLeft={iconHabit} accentColor={accentHabit} buttonText="Fill" />
        )}
        {isFridaySelected && !checkinComplete && (
          <BxkrBanner title="Weekly check‑in" message="Complete your weekly check‑in." href={checkinHref} iconLeft={iconCheckin} accentColor={accentCheckin} buttonText="Check in" />
        )}

        {overviewLoading && <div className="alert alert-secondary">Loading…</div>}
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
