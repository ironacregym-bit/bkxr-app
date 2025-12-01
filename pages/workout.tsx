
import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import { useState } from "react";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function getWeekDays() {
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

export default function WorkoutPage() {
  const { data: session } = useSession();
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  const greeting =
    today.getHours() < 12
      ? "Good Morning"
      : today.getHours() < 18
      ? "Good Afternoon"
      : "Good Evening";

  const getDayName = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "long" });

  // Profile for location
  const { data: profileData } = useSWR(
    session?.user?.email
      ? `/api/profile?email=${encodeURIComponent(session.user.email)}`
      : null,
    fetcher
  );
  const userLocation: string | undefined = profileData?.location || undefined;

  // Workouts for Today
  const { data: workoutsData } = useSWR("/api/workouts", fetcher);
  const todaysWorkout = (workoutsData?.workouts || []).find(
    (w: any) => (w.day_name || "").toLowerCase() === getDayName(today).toLowerCase()
  );

  // History from workouts_completed
  const { data: completionData } = useSWR(
    session?.user?.email
      ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}`
      : null,
    fetcher
  );


 // Calculate Monday and Sunday of current week
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fromISO = monday.toISOString();
  const toISO = sunday.toISOString();

  // Fetch sessions for this week
  const { data: calendarData, isLoading: calendarLoading, error: calendarError } = useSWR(
    userLocation
      ? `/api/schedule/upcoming?location=${encodeURIComponent(userLocation)}&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`
      : null,
    fetcher
  );

  // Debug log to verify API response
  console.log("Sessions from API:", calendarData?.sessions);

  // Normalize date comparison
  const normalizeDate = (d: Date) => {
    const n = new Date(d);
    n.setHours(0, 0, 0, 0);
    return n.getTime();
  };

// Filter sessions for selected day
const sessionsForDay =
  calendarData?.sessions?.filter((s: any) => {
    if (!s.start_time) return false;
    const start = new Date(s.start_time);
    return normalizeDate(start) === normalizeDate(selectedDay);
  }) || [];


  // Disable past days
  const isPastDay = (date: Date) => {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    return date < todayMidnight;
  };


  async function handleBook(sessionId: string) {
    if (!session?.user?.email) {
      alert("Please sign in to book a session.");
      return;
    }
    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          user_email: session.user.email,
        }),
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem?.error || "Booking failed");
      }
      alert("✅ Booked successfully!");
    } catch (e: any) {
      console.error("Booking error:", e?.message || e);
      alert("❌ Failed to book session.");
    }
  }

  const weekDays = getWeekDays();

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
      </Head>
        <main className="container py-3" style={{ paddingBottom: "70px" }}>
        <div className="bxkr-card p-3 mb-4">
          <div className="d-flex justify-content-between align-items-center flex-wrap">
            <div className="mb-2">
              <div className="text-muted small">Today</div>
              {todaysWorkout ? (
                <h5 className="mb-0">Workout: {todaysWorkout.workout_name}</h5>
              ) : (
                <h5 className="mb-0">Rest Day</h5>
              )}
            </div>
            <div className="text-end mb-2">
              <div className="text-muted small">Location</div>
              {userLocation ? (
                <div className="fw-semibold">{userLocation}</div>
              ) : (
                <Link href="/profile" className="btn btn-primary btn-sm">
                  Set your location in Profile
                </Link>
              )}
            </div>
          </div>

          {todaysWorkout && (
            <div className="mt-2">
              <p className="mb-2">{todaysWorkout.notes || "Workout details"}</p>
              <Link href={`/workout/${todaysWorkout.id}`} className="btn btn-primary btn-sm">
                Start Workout
              </Link>
            </div>
          )}
          {!todaysWorkout && (
            <div className="mt-2">
              <p className="mb-2">No programmed workout today. Book a gym session instead:</p>
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_TRAINER_PHONE || process.env.TRAINER_PHONE}?text=Hi%20Coach%2C%20I%27d%20like%20to%20book%20a%20session`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline-primary btn-sm"
              >
                Book Gym Session
              </a>
            </div>
          )}
        </div>
        {/* Calendar Navigation */}
        <h4 className="mb-3 text-center">Select a Day</h4>
        <div className="d-flex justify-content-between text-center mb-4">
          {weekDays.map((d, i) => {
            const isSelected =
              d.getDate() === selectedDay.getDate() &&
              d.getMonth() === selectedDay.getMonth() &&
              d.getFullYear() === selectedDay.getFullYear();
            return (
              <div
                key={i}
                style={{ width: "40px", cursor: "pointer" }}
                onClick={() => setSelectedDay(d)}
              >
                <div className="fw-bold">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className={`bxkr-day-pill ${isSelected ? "bxkr-selected" : ""}`}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sessions for Selected Day */}
        <h4 className="mb-3 text-center">{getDayName(selectedDay)}’s Sessions</h4>
        <div className="bxkr-card p-3 mb-4">
          {calendarLoading && <div className="alert alert-secondary">Loading sessions…</div>}
          {calendarError && <div className="alert alert-danger">Failed to load sessions.</div>}

          {sessionsForDay.length > 0 ? (
            sessionsForDay.map((s: any) => {
              const start = new Date(s.start_time);
              const end = s.end_time ? new Date(s.end_time) : null;
              const full =
                s.max_attendance && s.current_attendance
                  ? s.current_attendance >= s.max_attendance
                  : false;
              const disabled = full || isPastDay(start);

              return (
                <div
                  key={s.id}
                  className="list-group-item d-flex justify-content-between align-items-center mb-3"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                >
                  <div>
                    <div className="fw-semibold">
                      {s.class_name} @ {s.gym_name}
                    </div>
                    <div className="small text-muted">
                      {start.toLocaleString()} {end ? `– ${end.toLocaleTimeString()}` : ""}
                    </div>
                    <div className="small text-muted">{s.location}</div>
                    {s.coach_name && (
                      <div className="small text-muted">Coach: {s.coach_name}</div>
                    )}
                  </div>
                  <div className="text-end">
                    {s.max_attendance && (
                      <div className="small">
                        {s.current_attendance || 0}/{s.max_attendance}
                      </div>
                    )}
                    <button
                      className={`btn btn-sm mt-2 ${disabled ? "btn-secondary" : "btn-primary"}`}
                      disabled={disabled}
                      onClick={() => handleBook(s.id)}
                    >
                      {disabled ? (full ? "Full" : "Past") : "Book"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            !calendarLoading && !calendarError && <p className="mb-0">No sessions for this day.</p>
          )}
        </div>

        {/* Tiles Section */}
        <div className="row gx-3 mb-4">
          {/* Workout History Tile */}
          <div className="col-6">
            <div className="bxkr-card p-3 text-center">
              <h6 className="mb-3">Workout History</h6>
              {completionData?.history?.length > 0 ? (
                completionData.history.slice(0, 3).map((c: any, idx: number) => (
                  <div key={idx} className="mb-2">
                    <small>{new Date(c.completed_date).toLocaleDateString()}</small>
                    <div>{c.calories_burned} cal | {c.sets_completed} sets</div>
                  </div>
                ))
              ) : (
                <p>No history yet.</p>
              )}
              <button className="btn btn-outline-primary btn-sm mt-2">View More</button>
            </div>
          </div>

          {/* Benchmarks Tile */}
          <div className="col-6">
            <div className="bxkr-card p-3 text-center">
              <h6 className="mb-3">Benchmarks</h6>
              <p>No benchmarks yet.</p>
              <button className="btn btn-outline-primary btn-sm mt-2">Add Result</button>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
