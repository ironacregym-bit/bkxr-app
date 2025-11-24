
import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";

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

export default function Home() {
  const { data: session, status } = useSession();
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  const { data: completionData } = useSWR(
    session?.user?.email ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}` : null,
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
  const todayName = today.toLocaleDateString(undefined, { weekday: "long" });

  // Greeting
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  // Today's workouts
  const todaysWorkouts = (data?.workouts || []).filter(
    (w: any) => (w.day || "").toLowerCase() === todayName.toLowerCase()
  );

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
      </Head>

      <main className="container py-3" style={{ paddingBottom: "70px" }}>
        {/* Greeting */}
        <h2 className="mb-4 text-center">{greeting}, {session?.user?.name || "Athlete"}</h2>

        {/* Auth bar */}
        <div className="mb-4 d-flex justify-content-center gap-3 flex-wrap">
          {status === "loading" ? (
            <span>Checking session…</span>
          ) : !session ? (
            <button className="btn btn-dark" onClick={() => signIn("google")}>
              Sign in with Google
            </button>
          ) : (
            <div className="d-flex gap-3 align-items-center">
              <img
                src={session.user?.image ?? ""}
                alt=""
                style={{ width: 32, height: 32, borderRadius: "50%" }}
              />
              <span className="text-muted">{session.user?.email}</span>
              <button className="btn btn-outline-dark" onClick={() => signOut()}>
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Errors/Loading */}
        {error && <div className="alert alert-danger">Failed to load workouts</div>}
        {isLoading && <div className="alert alert-secondary">Loading…</div>}

        {/* Weekly strip */}
        <div className="d-flex justify-content-between text-center mb-4">
          {weekDays.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div key={i} style={{ width: "40px" }}>
                <div style={{ fontSize: "14px" }}>{dayLabels[i]}</div>
                <div
                  style={{
                    fontSize: "14px",
                    marginTop: "4px",
                    width: "28px",
                    height: "28px",
                    lineHeight: "28px",
                    borderRadius: "50%",
                    background: isToday ? "#f9d923" : "transparent",
                    color: isToday ? "#101522" : "#fff",
                    margin: "0 auto"
                  }}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Today's workout card */}
        {todaysWorkouts.length > 0 && (
          <div className="p-3 mb-3" style={{ background: "#fab1a0", borderRadius: "16px" }}>
            <div className="mb-2" style={{ fontSize: "14px", fontWeight: "bold" }}>
              {todayName}
            </div>
            <h6>{todaysWorkouts[0].title}</h6>
            <p>{todaysWorkouts[0].notes || "Workout details"}</p>
            <Link href={`/workout/${todaysWorkouts[0].id}`} className="btn btn-dark btn-sm mt-2">
              Start Workout
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
