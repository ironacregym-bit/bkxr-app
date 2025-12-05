
import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import CoachBanner from "../components/CoachBanner";
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";

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

// Helpers
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
const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
function ringWrapGlow(color: string): React.CSSProperties {
  return {
    filter: `drop-shadow(0 0 6px ${color}55)`,
    animation: "bxkrPulse 3.2s ease-in-out infinite",
  };
}

export default function Home() {
  const { data: session, status } = useSession();
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);
  const { data: completionData } = useSWR(
    session?.user?.email
      ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}&range=all`
      : null,
    fetcher
  );
  const allCompletions = (completionData?.history || []) as any[];

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
  const getDayName = (date: Date) => date.toLocaleDateString(undefined, { weekday: "long" });
  const selectedDayName = getDayName(selectedDay);

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

  function formatYMD(d: Date) {
    const n = new Date(d);
    n.setHours(0, 0, 0, 0);
    return n.toISOString().slice(0, 10);
  }
  const selectedDateKey = useMemo(() => formatYMD(selectedDay), [selectedDay]);

  const { data: nutritionForSelected } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${selectedDateKey}` : null,
    fetcher
  );
  const nutritionLogged = (nutritionForSelected?.entries?.length || 0) > 0;

  const { data: habitForSelected } = useSWR(
    session?.user?.email ? `/api/habits/logs?date=${selectedDateKey}` : null,
    fetcher
  );
  const habitComplete = (habitForSelected?.entries?.length || 0) > 0;

  const isFridaySelected = selectedDay.getDay() === 5;
  const { data: checkinForWeek } = useSWR(
    session?.user?.email && isFridaySelected ? `/api/checkins/weekly?week=${formatYMD(selectedDay)}` : null,
    fetcher
  );
  const checkinComplete = !!checkinForWeek?.entry;

  const hasWorkoutToday = selectedWorkouts.length > 0;
  const workoutIdsToday = selectedWorkouts.map((w: any) => w.id);
  const workoutDoneToday = useMemo(() => {
    if (!hasWorkoutToday) return false;
    return allCompletions.some((c: any) => {
      const completedAt = toMillis(c.completed_date || c.completed_at || c.started_at);
      const completedDate = new Date(completedAt);
      return workoutIdsToday.includes(c.workout_id) && isSameDay(completedDate, selectedDay);
    });
  }, [allCompletions, hasWorkoutToday, workoutIdsToday, selectedDay]);

  const dayTasks = [
    {
      key: "workout",
      title: "Complete today’s workout",
      description: hasWorkoutToday ? `Start your programmed session for ${selectedDayName}.` : `No workout scheduled for ${selectedDayName}.`,
      complete: hasWorkoutToday ? workoutDoneToday : true,
      show: hasWorkoutToday,
      href: hasWorkoutToday && selectedWorkouts[0]?.id ? `/workout/${selectedWorkouts[0].id}` : undefined,
    },
    {
      key: "habit",
      title: "Daily habit",
      description: `Fill in your daily habit for ${selectedDayName}.`,
      complete: habitComplete,
      show: true,
      href: `/habit?date=${selectedDateKey}`,
    },
    {
      key: "checkin",
      title: "Weekly check‑in",
      description: `Complete your weekly check‑in.`,
      complete: isFridaySelected ? checkinComplete : true,
      show: isFridaySelected,
      href: "/checkin",
    },
  ];
  const allTasksDone = dayTasks.filter((t) => t.show).every((t) => t.complete);

  const ringCompleteColor = "#2ecc71";
  const ringOutstandingColor = "#ff7f32";
  const daysWithWorkout = weekDays.map((d) => {
    const dayName = getDayName(d);
    return (data?.workouts || []).some((w: any) => (w.day_name || "").toLowerCase() === dayName.toLowerCase());
  });

  const btnClass = "bxkr-btn";

  return (
    <>
      <Head>
        <title>BXKR</title>
        <style>{`
          @keyframes bxkrPulse {
            0% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.10)); }
            50% { filter: drop-shadow(0 0 10px rgba(255,255,255,0.18)); }
            100% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.10)); }
          }
          .${btnClass} {
            background: linear-gradient(135deg, #cf6a33 0%, #e07a3a 100%);
            color: #0e0e0e !important;
            border-radius: 999px;
            font-weight: 700;
            padding: 8px 16px;
          }
          .bxkr-pill {
            background: rgba(255,255,255,0.06);
            border-radius: 28px;
            padding: 16px;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 22px rgba(0,0,0,0.38);
          }
          .bxkr-calendar {
            background: rgba(255,255,255,0.06);
            border-radius: 28px;
            padding: 10px 12px;
          }
          .bxkr-day {
            width: 40px;
            height: 40px;
            line-height: 40px;
            border-radius: 999px;
            margin: 0 auto;
            text-align: center;
            color: #fff;
          }
        `}</style>
      </Head>

      <main className="container py-3" style={{ paddingBottom: "70px", background: "linear-gradient(135deg,#1a1a1a,#2e1a0f)", color: "#fff", borderRadius: "12px" }}>
        {/* Header */}
        <div className="d-flex justify-content-between mb-3">
          <div className="d-flex gap-2">
            {session?.user?.image && <img src={session.user.image} alt="" className="rounded-circle" style={{ width: 36, height: 36 }} />}
            <div>{session?.user?.name || "Athlete"}</div>
          </div>
          {status === "authenticated" ? (
            <button className="btn btn-link text-light p-0" onClick={() => signOut()}>Sign out</button>
          ) : (
            <button className={btnClass} onClick={() => signIn("google")}>Sign in</button>
          )}
        </div>

        <h2 className="mb-2">{greeting}, {session?.user?.name || "Athlete"}</h2>

        {/* Micro-task */}
        <div className="bxkr-pill mb-3">
          <div className="d-flex justify-content-between">
            <div>You’re {sessionsAway} sessions away from your weekly goal</div>
            <div className="small">Target: 3/week</div>
          </div>
          <div className="small mt-2">Completed this week: {weeklyCompletedCount}</div>
        </div>

        {/* Calendar */}
        <div className="bxkr-calendar mb-3">
          <div className="d-flex justify-content-between" style={{ gap: 8 }}>
            {weekDays.map((d, i) => {
              const isSelected = isSameDay(d, selectedDay);
              const ringColor = isSelected ? (allTasksDone ? ringCompleteColor : ringOutstandingColor) : undefined;
              return (
                <div key={i} style={{ width: 44 }} onClick={() => setSelectedDay(d)}>
                  <div style={{ fontSize: "0.8rem", color: "#fff" }}>{dayLabels[i]}</div>
                  <div className="bxkr-day" style={{
                    backgroundColor: isSelected ? "#ff7f32" : "transparent",
                    ...(ringColor ? { boxShadow: `0 0 0 2px ${ringColor}`, ...ringWrapGlow(ringColor) } : {})
                  }}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CoachBanner pill */}
        <div className="bxkr-pill mb-3">
          <CoachBanner message="Nutrition — Log today’s meals and macros." dateKey={selectedDateKey} />
        </div>

        {/* Tasks */}
        {dayTasks.filter(t => t.show).map(t => (
          <div key={t.key} className="bxkr-pill mb-3">
            <div className="d-flex justify-content-between">
              <div>{t.title}</div>
              <span>{t.complete ? "Completed" : "Outstanding"}</span>
            </div>
            <div className="mt-2">{t.description}</div>
            {t.href && <Link href={t.href} className={`${btnClass} btn btn-sm mt-3`}>Go</Link>}
          </div>
        ))}

        {/* Workouts */}
        {selectedWorkouts.map(w => (
          <div key={w.id} className="bxkr-pill mb-3">
            <div>{selectedDayName}</div>
            <h6>{w.workout_name}</h6>
            <p>{w.notes || "Workout details"}</p>
            <Link href={`/workout/${w.id}`} className={`${btnClass} btn btn-sm mt-2`}>Start Workout</Link>
          </div>
        ))}

        {error && <div className="alert alert-danger">Failed to load workouts</div>}
        {isLoading && <div className="alert alert-secondary">Loading…</div>}
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
