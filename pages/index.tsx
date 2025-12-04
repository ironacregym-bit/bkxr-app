
import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import CoachBanner from "../components/CoachBanner";
// Redirect logic for index
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getSession(context);

  // If the user is NOT logged in → show landing page instead
  if (!session) {
    return {
      redirect: {
        destination: "/landing",
        permanent: false,
      },
    };
  }

  return {
    props: {}, // loads your existing home/dashboard
  };
}
const fetcher = (u: string) => fetch(u).then((r) => r.json());

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

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function Home() {
  const { data: session, status } = useSession();

  // Fetch workouts
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  // Completion history
  const [range, setRange] = useState<"week" | "month" | "all">("week");
  const { data: completionData } = useSWR(
    session?.user?.email
      ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}&range=${range}`
      : null,
    fetcher
  );
  const completedIds = completionData?.history?.map((h: any) => h.workout_id) || [];

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

  // Stats from completionData
  const now = new Date();
  let startDate: Date;
  if (range === "week") {
    startDate = new Date();
    startDate.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
    startDate.setHours(0, 0, 0, 0);
  } else if (range === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    startDate = new Date(2000, 0, 1);
  }

  const filteredCompletions = (completionData?.history || []).filter((c: any) => {
    const completedAt = new Date(c.completed_date);
    return completedAt >= startDate && completedAt <= now;
  });

  const workoutsCompleted = filteredCompletions.length;
  const caloriesBurned = filteredCompletions.reduce(
    (sum: number, c: any) => sum + (c.calories_burned || 0),
    0
  );
  const setsCompleted = filteredCompletions.reduce(
    (sum: number, c: any) => sum + (c.sets_completed || 0),
    0
  );

  const daysWithWorkout = weekDays.map((d) => {
    const dayName = getDayName(d);
    return (data?.workouts || []).some(
      (w: any) => (w.day_name || "").toLowerCase() === dayName.toLowerCase()
    );
  });

  // ===== Nutrition check (today) =====
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: nutritionData } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${todayKey}` : null,
    fetcher
  );
  const noNutritionLogged = (nutritionData?.entries?.length || 0) === 0;

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main
        className="container py-3"
        style={{
          paddingBottom: "70px",
          background: "linear-gradient(135deg, #1a1a1a 0%, #2e1a0f 100%)",
          color: "#fff",
          borderRadius: "12px",
        }}
      >
        {/* Coach reminder pill */}
        {status === "authenticated" && noNutritionLogged && (
          <CoachBanner
            message="Log your meals for today to stay on track!"
            dateKey={todayKey}
          />
        )}


        {/* Greeting */}
        <h2 className="mb-4 text-center" style={{ fontWeight: 700, fontSize: "1.8rem" }}>
          {greeting}, {session?.user?.name || "Athlete"}
        </h2>

        {/* Range Filter Buttons */}
        <div className="d-flex justify-content-center gap-2 mb-3">
          {["week", "month", "all"].map((r) => (
            <button
              key={r}
              className={`btn btn-sm ${range === r ? "btn-primary" : "btn-outline-primary"}`}
              style={{
                borderRadius: "24px",
                backgroundColor: range === r ? "#ff7f32" : "transparent",
                color: "#fff",
                border: range === r ? "none" : "1px solid #ff7f32",
              }}
              onClick={() => setRange(r as "week" | "month" | "all")}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats Overview */}
        <div className="row text-center mb-4 gx-3">
          <div className="col">
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "16px",
                padding: "16px",
                backdropFilter: "blur(10px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ opacity: 0.7 }}>
                <i className="fas fa-dumbbell me-1" style={{ color: "#ff7f32" }} /> Workouts
              </div>
              <div style={{ fontSize: "22px", fontWeight: 700 }}>{workoutsCompleted}</div>
              <div style={{ fontSize: "12px", opacity: 0.6 }}>
                {range === "week" ? "This Week" : range === "month" ? "This Month" : "All Time"}
              </div>
            </div>
          </div>
          <div className="col">
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "16px",
                padding: "16px",
                backdropFilter: "blur(10px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ opacity: 0.7 }}>
                <i className="fas fa-fire me-1" style={{ color: "#ff7f32" }} /> Calories
              </div>
              <div style={{ fontSize: "22px", fontWeight: 700 }}>{caloriesBurned}</div>
              <div style={{ fontSize: "12px", opacity: 0.6 }}>
                {range === "week" ? "This Week" : range === "month" ? "This Month" : "All Time"}
              </div>
            </div>
          </div>
          <div className="col">
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "16px",
                padding: "16px",
                backdropFilter: "blur(10px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ opacity: 0.7 }}>
                <i className="fas fa-layer-group me-1" style={{ color: "#ff7f32" }} /> Sets
              </div>
              <div style={{ fontSize: "22px", fontWeight: 700 }}>{setsCompleted}</div>
              <div style={{ fontSize: "12px", opacity: 0.6 }}>
                {range === "week" ? "This Week" : range === "month" ? "This Month" : "All Time"}
              </div>
            </div>
          </div>
        </div>

        {/* Auth */}
        <div className="mb-4 d-flex justify-content-center gap-3 flex-wrap">
          {status === "loading" ? (
            <span>Checking session…</span>
          ) : !session ? (
            <button
              className="btn btn-primary"
              style={{
                backgroundColor: "#ff7f32",
                borderRadius: "24px",
                fontWeight: 600,
              }}
              onClick={() => signIn("google")}
            >
              Sign in with Google
            </button>
          ) : (
            <div className="d-flex gap-3 align-items-center">
              <img
                src={session.user?.image ?? ""}
                alt=""
                className="rounded-circle"
                style={{ width: 32, height: 32 }}
              />
              <span style={{ opacity: 0.7 }}>{session.user?.email}</span>
              <button
                className="btn btn-outline-light"
                style={{ borderRadius: "24px" }}
                onClick={() => signOut()}
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {error && <div className="alert alert-danger">Failed to load workouts</div>}
        {isLoading && <div className="alert alert-secondary">Loading…</div>}

        {/* Weekly strip */}
        <div className="d-flex justify-content-between text-center mb-4">
          {weekDays.map((d, i) => {
            const isToday = isSameDay(d, today);
            const isSelected = isSameDay(d, selectedDay);
            const hasWorkout = daysWithWorkout[i];
        
            return (
              <div
                key={i}
                style={{ width: "40px", cursor: "pointer" }}
                onClick={() => setSelectedDay(d)}
                aria-label={`Select ${dayLabels[i]} ${d.getDate()}`}
              >
                <div
                  style={{
                    fontSize: "0.8rem",
                    opacity: 0.7,
                    marginBottom: "4px",
                  }}
                >
                  {dayLabels[i]}
                </div>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    lineHeight: "32px",
                    borderRadius: "50%",
                    margin: "0 auto",
                    backgroundColor: isSelected
                      ? "#ff7f32"
                      : isToday
                      ? "rgba(255,127,50,0.2)"
                      : "transparent",
                    color: isSelected ? "#fff" : "#fff",
                    border: isToday && !isSelected ? "1px solid #ff7f32" : "none",
                    opacity: hasWorkout ? 1 : 0.5,
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Selected day's workouts */}
        {selectedWorkouts.length > 0 &&
          selectedWorkouts.map((w: any) => (
            <div
              key={w.id}
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "16px",
                padding: "16px",
                backdropFilter: "blur(10px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                marginBottom: "12px",
              }}
            >
              <div className="mb-2 fw-bold">{selectedDayName}</div>
              <h6>{w.workout_name}</h6>
              <p>{w.notes || "Workout details"}</p>
              <Link
                href={`/workout/${w.id}`}
                className="btn btn-primary btn-sm mt-2"
                style={{
                  backgroundColor: "#ff7f32",
                  borderRadius: "24px",
                  fontWeight: 600,
                }}
              >
                Start Workout
              </Link>
            </div>
          ))}
      </main>

      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
