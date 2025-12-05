
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

// ---------- Date helpers
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
  if (ts?._seconds != null) {
    return ts._seconds * 1000 + Math.floor((ts._nanoseconds || 0) / 1e6);
  }
  if (ts?.seconds != null) {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
  }
  if (typeof ts === "string") {
    const v = new Date(ts).getTime();
    return Number.isFinite(v) ? v : 0;
  }
  const v = new Date(ts).getTime();
  return Number.isFinite(v) ? v : 0;
}

function ringWrapGlow(color: string): React.CSSProperties {
  return {
    filter: `drop-shadow(0 0 6px ${hexToRGBA(color, 0.25)})`,
    animation: "bxkrPulse 3.2s ease-in-out infinite",
  };
}
function hexToRGBA(hex: string, alpha = 1) {
  const m = hex.replace("#", "");
  const bigint = parseInt(m, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
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

  const hour = today.getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const getDayName = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "long" });
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
  function formatWeekKey(d: Date) {
    const s = startOfAlignedWeek(d);
    s.setHours(0, 0, 0, 0);
    return s.toISOString().slice(0, 10);
  }
  const weekKey = useMemo(() => formatWeekKey(selectedDay), [selectedDay]);
  const { data: checkinForWeek } = useSWR(
    session?.user?.email && isFridaySelected ? `/api/checkins/weekly?week=${weekKey}` : null,
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
      return (
        workoutIdsToday.includes(c.workout_id) &&
        isSameDay(completedDate, selectedDay)
      );
    });
  }, [allCompletions, hasWorkoutToday, workoutIdsToday, selectedDay]);

  const dayTasks = [
    {
      key: "workout",
      title: "Complete today’s workout",
      description: hasWorkoutToday
        ? `Start your programmed session for ${selectedDayName}.`
        : `No workout scheduled for ${selectedDayName}.`,
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
    return (data?.workouts || []).some(
      (w: any) => (w.day_name || "").toLowerCase() === dayName.toLowerCase()
    );
  });

  const btnClass = "bxkr-btn";

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{`
          @keyframes bxkrPulse {
            0% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.10)); }
            50% { filter: drop-shadow(0 0 10px rgba(255,255,255,0.18)); }
            100% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.10)); }
          }
          .${btnClass} {
            background: linear-gradient(135deg, #cf6a33 0%, #e07a3a 100%);
            color: #0e0e0e !important;
            border: none;
            border-radius: 999px;
            font-weight: 700;
            padding: 8px 16px;
            box-shadow: 0 6px 18px rgba(207, 106, 51, 0.28);
          }
          .bxkr-pill {
            background: rgba(255,255,255,0.06);
            border-radius: 28px;
            padding: 16px;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 22px rgba(0,0,0,0.38);
          }
          .bxkr-badge {
            display: inline-block;
            border-radius: 999px;
            font-weight: 800;
            padding: 6px 10px;
          }
          .bxkr-badge--ok { background: #2ecc71; color: #0e0e0e; }
          .bxkr-badge--warn { background: #ff7f32; color: #141414; }
          .bxkr-calendar {
            background: rgba(255,255,255,0.06);
            border-radius: 28px;
            padding: 10px 12px;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 22px rgba(0,0,0,0.38);
          }
          .bxkr-day {
            width: 40px;
            height: 40px;
            line-height: 40px;
            border-radius: 999px;
            margin: 0 auto;
            text-align: center;
            color: #fff;
            box-shadow: 0 0 0 2px rgba(255,255,255,0.08);
          }
        `}</style>
      </Head>

      <main className="container py-3" style={{ paddingBottom: "70px", background: "linear-gradient(135deg, #1a1a1a 0%, #2e1a0f 100%)", color: "#fff", borderRadius: "12px" }}>
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            {session?.user?.image && <img src={session.user.image} alt="" className="rounded-circle" style={{ width: 36, height: 36, objectFit: "cover" }} />}
            <div className="fw-semibold">{session?.user?.name || "Athlete"}</div>
          </div>
          <div>
            {status === "authenticated" ? (
              <button className="btn btn-link text-light p-0" onClick={() => signOut()}>Sign out</button>
            ) : (
              <button className={btnClass} onClick={() => signIn("google")}>Sign in</button>
            )}
          </div>
        </div>

        {/* Greeting */}
        <div className="mb-2">
          <h2 className="mb-1" style={{ fontWeight: 700, fontSize: "1.6rem" }}>{greeting}, {session?.user?.name || "Athlete"}</h2>
        </div>

        {/* Micro-task banner */}
        <div className="bxkr-pill mb-3">
          <div className="d-flex align-items-center justify-content-between">
            <div className="fw-semibold">You’re {sessionsAway} {sessionsAway === 1 ? "session" : "sessions"} away from your weekly goal</div>
            <div className="small" style={{ opacity: 0.85 }}>Target: 3/week</div>
          </div>
          <div className="mt-2 small" style={{ opacity: 0.85 }}>Completed this week: {weeklyCompletedCount}</div>
        </div>

        {/* Calendar strip */}
        <div className="bxkr-calendar mb-3">
          <div className="d-flex justify-content-between text-center" style={{ gap: 8 }}>
            {weekDays.map((d, i) => {
              const isToday = isSameDay(d, today);
              const isSelected = isSameDay(d, selectedDay);
              const hasWorkout = daysWithWorkout[i];
              const ringColor = isSelected ? (allTasksDone ? ringCompleteColor : ringOutstandingColor) : undefined;
              return (
                <div key={i} style={{ width: 44, cursor: "pointer" }} onClick={() => setSelectedDay(d)}>
                  <div style={{ fontSize: "0.8rem", opacity: 0.8, marginBottom: "4px", color: "#fff" }}>{dayLabels[i]}</div>
                  <div className="bxkr-day" style={{
                    backgroundColor: isSelected ? "#ff7f32" : isToday ? "rgba(255,127,50,0.18)" : "transparent",
                    border: isToday && !isSelected ? "1px solid #ff7f32" : "none",
                    opacity: hasWorkout ? 1 : 0.85,
                    fontWeight: isSelected ? 700 : 500,
                    ...(ringColor ? { boxShadow: `0 0 0 2px ${ringColor}`, ...ringWrapGlow(ringColor) } : {})
                  }}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CoachBanner wrapped in pill */}
        <div className="bxkr-pill mb-3">
          <CoachBanner message={`Nutrition — Log today’s meals and macros.`} dateKey={selectedDateKey} />
        </div>

        {/* Day tasks */}
        <div className="mb-3">
          {dayTasks.filter((t) => t.show).map((t) => {
            const accentClass = t.complete ? "bxkr-badge bxkr-badge--ok" : "bxkr-badge bxkr-badge--warn";
            const statusText = t.complete ? "Completed" : "Outstanding";
            const ctaLabel = t.key === "workout" ? "Start workout" : t.key === "habit" ? "Fill habit" : "Open check‑in";
            return (
              <div key={t.key} className="bxkr-pill mb-3">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="fw-bold">{t.title}</div>
                  <span className={accentClass}>{statusText}</span>
                </div>
                <div className="mt-2" style={{ opacity: 0.9 }}>{t.description}</div>
                {t.href && <Link href={t.href} className={`${btnClass} btn btn-sm mt-3`}>{ctaLabel}</Link>}
              </div>
            );
          })}
        </div>

        {/* Workouts */}
        {selectedWorkouts.length > 0 && selectedWorkouts.map((w: any) => (
          <div key={w.id} className="bxkr-pill mb-3">
            <div className="mb-2 fw-bold">{selectedDayName}</div>
            <h6>{w.workout_name}</h6>
            <p>{w.notes || "Workout details"}</p>
            <Link href={`/workout/${w.id}`} className={`${btnClass} btn btn-sm mt-2`}>Start Workout</Link>
          </div>
        ))}

        {error && <div className="alert alert-danger">Failed to load workouts</div>}
        {isLoading && <div className="alert alert-secondary">Loading…</div>}
