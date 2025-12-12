
import Head from "next/head";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
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

type ApiDay = {
  dateKey: string;
  nutritionSummary?: { calories: number; protein: number };
  workoutSummary?: { calories: number; duration: number; weightUsed?: string };
  habitSummary?: { completed: number; total: number };
  checkinSummary?: { weight: number; bodyFat: number; weightChange?: number; bfChange?: number };
  hasWorkout?: boolean;
  workoutDone?: boolean;
  nutritionLogged?: boolean;
  habitAllDone?: boolean;
  isFriday?: boolean;
  checkinComplete?: boolean;
};

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

  const weekStartKey = useMemo(() => {
    const s = startOfAlignedWeek(new Date());
    return formatYMD(s);
  }, []);

  const { data: weeklyOverview, isLoading: overviewLoading } = useSWR(
    `/api/weekly/overview?week=${weekStartKey}`,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60_000 }
  );

  const [weekStatus, setWeekStatus] = useState<Record<string, DayStatus>>({});
  const [weekLoading, setWeekLoading] = useState<boolean>(false);

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

    return {
      isFriday,
      hasWorkout,
      workoutDone,
      nutritionLogged,
      habitAllDone,
      checkinComplete,
      allDone
    };
  };

  useEffect(() => {
    if (!weeklyOverview?.days?.length) return;

    setWeekLoading(true);
    const statuses: Record<string, DayStatus> = {};

    for (const o of weeklyOverview.days as any[]) {
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

  const dayStreak = useMemo(() => {
    let streak = 0;
    for (const d of weekDays) {
      const dk = formatYMD(d);
      const st = weekStatus[dk];
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
      const dk = formatYMD(d);
      const st = weekStatus[dk];
      if (!st) break;
      if (st.hasWorkout) {
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

      const dayTaskCount = 1 + 1 + (hasWorkout ? 1 : 0) + (isFriday ? 1 : 0);
      totalTasks += dayTaskCount;

      const dayCompleteCount =
        (nutritionLogged ? 1 : 0) +
        (habitAllDone ? 1 : 0) +
        (hasWorkout && workoutDone ? 1 : 0) +
        (isFriday && checkinComplete ? 1 : 0);
      completedTasks += dayCompleteCount;
    }

    return { totalTasks, completedTasks };
  }, [weeklyOverview]);

  const selectedStatus = weekStatus[selectedDateKey] || {};
  const hasWorkoutToday = Boolean(selectedStatus.hasWorkout);
  const workoutDoneToday = Boolean(selectedStatus.workoutDone);
  const nutritionLogged = Boolean(selectedStatus.nutritionLogged);
  const habitAllDone = Boolean(selectedStatus.habitAllDone);
  const checkinComplete = Boolean(selectedStatus.checkinComplete);

  const selectedDayData: ApiDay | undefined = useMemo(() => {
    if (!weeklyOverview?.days) return undefined;
    return (weeklyOverview.days as ApiDay[]).find((d) => d.dateKey === selectedDateKey);
  }, [weeklyOverview, selectedDateKey]);

  const workoutIds = selectedStatus.workoutIds || [];
  const hasWorkoutId = Array.isArray(workoutIds) && workoutIds.length > 0 && typeof workoutIds[0] === "string";
  const workoutHref = hasWorkoutToday && hasWorkoutId ? `/workout/${workoutIds[0]}` : "#";

  const nutritionHref = `/nutrition?date=${selectedDateKey}`;
  const habitHref = `/habit?date=${selectedDateKey}`;
  const checkinHref = `/checkin`;

  const ringGreenStrong = "#64c37a";
  const ringGreenMuted = "#4ea96a";
  const accentMicro = "#d97a3a";
  const accentWorkout = "#5b7c99";
  const accentCheckin = "#c9a34e";

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
            <button className="btn btn-link text-light p-0" onClick={() => signIn("google")} style={{ background: "transparent", border: "none", textDecoration: "underline" }}>
              Sign in
            </button>
          )}
        </div>

        {/* Greeting */}
        <h2 className="mb-3" style={{ fontWeight: 700, fontSize: "1.6rem" }}>
          {greeting}, {session?.user?.name || "Athlete"}
        </h2>

        {/* Weekly Progress */}
        {weeklyOverview?.days && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Weekly Progress</div>
            <div style={{ background: "#333", borderRadius: 8, overflow: "hidden", height: 12 }}>
              <div
                style={{
                  width:
                    derivedWeeklyTotals.totalTasks > 0
                      ? `${(derivedWeeklyTotals.completedTasks / derivedWeeklyTotals.totalTasks) * 100}%`
                      : "0%",
                  background: ringGreenStrong,
                  height: "100%"
                }}
              />
            </div>
            <div style={{ fontSize: "0.85rem", marginTop: 4 }}>
              {derivedWeeklyTotals.completedTasks} / {derivedWeeklyTotals.totalTasks} tasks completed
            </div>
          </div>
        )}


        {/* Scrollable ChallengeBanner-style section (slightly wider, content across) */}
        <div style={{ display: "flex", overflowX: "auto", gap: 12, marginBottom: 16 }}>
          {/* Banner 1: Share Your Progress (disabled button) */}
          <ChallengeBanner
            title="Share Your Progress"
            message={
              <span style={{ whiteSpace: "nowrap" }}>
              </span>
            }
            href="#"
            iconLeft="fas fa-share-alt"
            accentColor="#ffcc00"
            // Replace the default button with a disabled pill
            extraContent={
              <button className="bxkr-btn" disabled style={{ marginLeft: 6 }}>Coming Soon</button>
            }
            // Slightly wider banner (like your original)
            style={{ minWidth: 260, maxWidth: 280 }}
          />
        
          {/* Banner 2: Streaks (no button) */}
          <ChallengeBanner
            title="Streaks"
            message={
              <span style={{ whiteSpace: "nowrap" }}>
                <strong>Day Streak:</strong> {dayStreak} days &nbsp;|&nbsp; 
                <strong>Workout Streak:</strong> {workoutStreak} days
              </span>
            }
            href="#"                    // keeps consistent layout; click does nothing
            iconLeft="fas fa-fire"
            accentColor="#64c37a"
            showButton={false}          // ⬅ removes Start button
            style={{ minWidth: 260, maxWidth: 280 }}
          />
        
          {/* Banner 3: Weekly Snapshot (no button) */}
          {weeklyOverview?.weeklyTotals && (
            <ChallengeBanner
              title="Weekly Snapshot"
              message={
                <div style={{ fontSize: "0.85rem", lineHeight: 1.35 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span><strong>Workouts Completed</strong></span>
                    <span>{weeklyOverview.weeklyTotals.totalWorkoutsCompleted}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span><strong>Time Worked Out</strong></span>
                    <span>{weeklyOverview.weeklyTotals.totalWorkoutTime} mins</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span><strong>Calories Burned</strong></span>
                    <span>{weeklyOverview.weeklyTotals.totalCaloriesBurned} kcal</span>
                  </div>
                </div>
              }
              href="#"
              iconLeft="fas fa-chart-line"
              accentColor="#5b7c99"
              showButton={false}         // ⬅ removes Start button
              style={{ minWidth: 260, maxWidth: 280 }}
          />
          )}
        </div>


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
                  <span
                    className={`bxkr-day-content ${
                      status.allDone ? (isSelected ? "state-num" : "state-flame") : "state-num"
                    }`}
                  >
                    {status.allDone && !isSelected ? (
                      <i
                        className="fas fa-fire"
                        style={{
                          color: ringGreenStrong,
                          textShadow: `0 0 8px ${ringGreenStrong}`,
                          fontSize: "1rem",
                          lineHeight: 1
                        }}
                      />
                    ) : (
                      d.getDate()
                    )}
                  </span>
                </div>
                <div className="bxkr-dots">
                  {status.hasWorkout && (
                    <span
                      className="bxkr-dot"
                      style={{ color: accentWorkout, backgroundColor: accentWorkout }}
                    />
                  )}
                  {status.isFriday && !status.checkinComplete && (
                    <span className="bxkr-dot" style={{ color: accentCheckin, backgroundColor: accentCheckin }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Daily Tasks Card */}
        {selectedDayData && (
          <DailyTasksCard
            dayLabel={`${selectedDay.toLocaleDateString(undefined, { weekday: "long" })}, ${selectedDay.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
            nutritionSummary={selectedDayData.nutritionSummary}
            nutritionLogged={nutritionLogged}
            workoutSummary={selectedDayData.workoutSummary}
            hasWorkout={hasWorkoutToday}
            workoutDone={workoutDoneToday}
            habitSummary={selectedDayData.habitSummary}
            habitAllDone={habitAllDone}
            checkinSummary={selectedDayData.checkinSummary}
            checkinComplete={checkinComplete}
            hrefs={{ nutrition: nutritionHref, workout: workoutHref, habit: habitHref, checkin: checkinHref }}
          />
        )}

        {hasWorkoutToday && !hasWorkoutId && (
          <div className="text-center" style={{ opacity: 0.8, fontSize: "0.9rem", marginTop: 8 }}>
            Loading workout details… <span className="inline-spinner" />
          </div>
        )}
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
