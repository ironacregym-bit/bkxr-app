import Head from "next/head";
import useSWR from "swr";
import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";

import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import ChallengeBanner from "../components/ChallengeBanner";
import DailyTasksCard from "../components/DailyTasksCard";

/* -------------------- SSR AUTH -------------------- */
export const getServerSideProps: GetServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const session = await getSession(context);
  if (!session) {
    return { redirect: { destination: "/landing", permanent: false } };
  }
  return { props: {} };
};

/* -------------------- HELPERS -------------------- */
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

const formatYMD = (d: Date) => d.toLocaleDateString("en-CA");

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfAlignedWeek = (d: Date) => {
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s;
};

/* -------------------- TYPES -------------------- */
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
  checkinSummary?: {
    weight: number;
    body_fat_pct: number;
    weightChange?: number;
    bfChange?: number;
  };
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

/* ==================== PAGE ==================== */
export default function Home() {
  const { data: session, status } = useSession();

  const weekDays = useMemo(() => getWeek(), []);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const greeting =
    new Date().getHours() < 12
      ? "Good Morning"
      : new Date().getHours() < 18
      ? "Good Afternoon"
      : "Good Evening";

  const selectedDateKey = formatYMD(selectedDay);
  const weekStartKey = useMemo(
    () => formatYMD(startOfAlignedWeek(new Date())),
    []
  );

  const { data: weeklyOverview, isLoading } = useSWR(
    `/api/weekly/overview?week=${weekStartKey}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  /* ---------- DERIVED DAY DATA (THIS WAS MISSING) ---------- */
  const selectedDayData: ApiDay | undefined = useMemo(() => {
    if (!weeklyOverview?.days) return undefined;
    return (weeklyOverview.days as ApiDay[]).find(
      (d) => d.dateKey === selectedDateKey
    );
  }, [weeklyOverview, selectedDateKey]);

  /* ---------- STATUS MAP ---------- */
  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});

  useEffect(() => {
    if (!weeklyOverview?.days) return;

    const statuses: Record<string, DayStatus> = {};

    for (const o of weeklyOverview.days as ApiDay[]) {
      const isFriday =
        o.isFriday ??
        new Date(o.dateKey + "T00:00:00").getDay() === 5;

      const hasWorkout =
        Boolean(o.hasWorkout) ||
        Boolean(o.workoutSummary) ||
        Boolean(o.workoutIds?.length);

      const workoutDone =
        Boolean(o.workoutDone) ||
        Boolean(o.workoutSummary);

      const nutritionLogged = Boolean(o.nutritionLogged);

      const habitAllDone =
        Boolean(o.habitAllDone) ||
        (o.habitSummary
          ? o.habitSummary.completed >= o.habitSummary.total
          : false);

      const checkinComplete =
        Boolean(o.checkinComplete) || Boolean(o.checkinSummary);

      const allDone =
        (!hasWorkout || workoutDone) &&
        nutritionLogged &&
        habitAllDone &&
        (!isFriday || checkinComplete);

      statuses[o.dateKey] = {
        dateKey: o.dateKey,
        hasWorkout,
        workoutDone,
        nutritionLogged,
        habitAllDone,
        isFriday,
        checkinComplete,
        allDone,
        workoutIds: o.workoutIds ?? [],
      };
    }

    setWeekStatus(statuses);
  }, [weeklyOverview]);

  const selectedStatus = weekStatus[selectedDateKey] || ({} as DayStatus);

  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHref = `/habit?date=${selectedDateKey}`;
  const checkinHref = `/checkin`;

  const workoutHref =
    selectedStatus.workoutIds?.length > 0
      ? `/workout/${selectedStatus.workoutIds[0]}`
      : "#";

  const checkinSummaryNormalized = useMemo(() => {
    const s = selectedDayData?.checkinSummary;
    if (!s) return undefined;
    return {
      ...s,
      bodyFat: s.body_fat_pct,
    };
  }, [selectedDayData]);

  const accent = "#ff8a2a";

  /* -------------------- RENDER -------------------- */
  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-2" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="d-flex align-items-center gap-2">
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt=""
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            )}
            {isLoading && <div className="inline-spinner" />}
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

        <h2 className="mb-3 fw-bold">{greeting}</h2>

        <ChallengeBanner
          title="Weekly Snapshot"
          message="Train. Log. Recover. Repeat."
          href="#"
          accentColor={accent}
          showButton={false}
        />

        {/* Calendar */}
        <div className="d-flex justify-content-between text-center my-3">
          {weekDays.map((d, i) => {
            const dk = formatYMD(d);
            const st = weekStatus[dk];
            const isSelected = isSameDay(d, selectedDay);

            return (
              <div
                key={i}
                style={{ width: 44, cursor: "pointer" }}
                onClick={() => setSelectedDay(d)}
              >
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                </div>
                <div
                  className="bxkr-day-pill"
                  style={{
                    borderColor: st?.allDone ? "#64c37a" : accent,
                    boxShadow: isSelected
                      ? `0 0 8px ${accent}`
                      : undefined,
                  }}
                >
                  {st?.allDone && !isSelected ? (
                    <i className="fas fa-fire text-success" />
                  ) : (
                    d.getDate()
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ✅ DAILY TASKS CARD (FIXED) */}
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
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}