
import Head from "next/head";
import useSWR from "swr";
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

  // Fetch profile for location
  const { data: profileData } = useSWR(
    session?.user?.email
      ? `/api/profile?email=${encodeURIComponent(session.user.email)}`
      : null,
    fetcher
  );
  const userLocation: string | undefined = profileData?.location || undefined;

  // Fetch all sessions for the next 14 days
  const fromISO = new Date().toISOString();
  const toDate = new Date();
  toDate.setDate(toDate.getDate() + 14);
  const toISO = toDate.toISOString();

  const { data: calendarData, isLoading: calendarLoading, error: calendarError } = useSWR(
    userLocation
      ? `/api/schedule/upcoming?location=${encodeURIComponent(userLocation)}&from=${encodeURIComponent(
          fromISO
        )}&to=${encodeURIComponent(toISO)}`
      : null,
    fetcher
  );

  // Filter sessions for selected day
  const sessionsForDay =
    calendarData?.sessions?.filter((s: any) => {
      const start = new Date(s.start_time);
      return (
        start.getFullYear() === selectedDay.getFullYear() &&
        start.getMonth() === selectedDay.getMonth() &&
        start.getDate() === selectedDay.getDate()
      );
    }) || [];

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
        {/* Greeting */}
        <h2 className="mb-4 text-center">
          {greeting}, {session?.user?.name || "Athlete"}
        </h2>

        {/* Location */}
        <div className="text-center mb-4">
          <div className="text-muted">Location:</div>
          {userLocation ? (
            <div className="fw-semibold">{userLocation}</div>
          ) : (
            <div className="text-warning">Set your location in Profile</div>
          )}
        </div>

        {/* Calendar Navigation */}
        <h4 className="mb-3 text-center">Select a Day</h4>
        <div className="d-flex justify-content-between text-center mb-4">
          {weekDays.map((d, i) => {
            const isSelected =
              d.getDate() === selectedDay.getDate() &&
              d.getMonth() === selectedDay.getMonth();
            return (
              <div
                key={i}
                style={{ width: "40px", cursor: "pointer" }}
                onClick={() => setSelectedDay(d)}
              >
                <div className="fw-bold">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                <div
                  className={`bxkr-day-pill ${isSelected ? "bxkr-selected" : ""}`}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sessions for Selected Day */}
        <h4 className="mb-3 text-center">{getDayName(selectedDay)}'s Sessions</h4>
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
                    <div className="fw-semibold">{s.class_name} @ {s.gym_name}</div>
                    <div className="small text-muted">
                      {start.toLocaleString()} {end ? `– ${end.toLocaleTimeString()}` : ""}
                    </div>
                    <div className="small text-muted">{s.location}</div>
                  </div>
                  <div className="text-end">
                    {s.max_attendance && (
                      <div className="small">
                        {s.current_attendance || 0}/{s.max_attendance}
                      </div>
                    )}
                    <button
                      className={`btn btn-sm mt-2 ${full ? "btn-secondary" : "btn-primary"}`}
                      disabled={full}
                      onClick={() => handleBook(s.id)}
                    >
                      {full ? "Full" : "Book"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            !calendarLoading && <p>No sessions for this day.</p>
          )}
        </div>
      </main>

      <BottomNav />
    </>
  );
}
