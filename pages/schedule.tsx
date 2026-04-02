"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import { toMillis } from "../lib/time";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Gym = {
  id: string;
  name: string;
  location: string;
};

type SessionItem = {
  id: string;
  class_id: string;
  coach_name?: string;
  start_time: string | number | null;
  end_time: string | number | null;
  price: number;
  max_attendance: number;
  current_attendance: number;
  gym_name: string;
  location: string;
};

type UserAccess = {
  subscription_status?: string | null;
  membership_status?: string | null;
  payment_type?: string | null;
};

type PaymentMethod = "stripe" | "pay_on_day" | "member_free";

// Local YYYY-MM-DD (prevents the “day out” bug from UTC conversion)
function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SchedulePage() {
  const { data: authSession } = useSession();
  const authedEmail = authSession?.user?.email || "";

  // Profile for member-free booking
  const profileKey = authedEmail ? `/api/profile?email=${encodeURIComponent(authedEmail)}` : null;
  const { data: profile } = useSWR<UserAccess>(profileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const isGymMember =
    String(profile?.membership_status || "").toLowerCase() === "gym_member";
  
  const isCashPayer =
    String(profile?.payment_type || "").toLowerCase() === "cash";

  // Gyms
  const { data: gymsResp, error: gymsError } = useSWR("/api/gyms/list", fetcher);
  const gyms: Gym[] = gymsResp?.gyms ?? [];
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const selectedGym = useMemo(() => gyms.find((g) => g.id === selectedGymId) || null, [gyms, selectedGymId]);

  // Month navigation (calendar view)
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0..11

  const monthStart = useMemo(() => new Date(year, month, 1, 0, 0, 0, 0), [year, month]);
  const monthEnd = useMemo(() => new Date(year, month + 1, 0, 23, 59, 59, 999), [year, month]);

  const monthLabel = useMemo(
    () =>
      monthStart.toLocaleString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [monthStart]
  );

  function prevMonth() {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() - 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function nextMonth() {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  // Sessions
  const fromISO = monthStart.toISOString();
  const toISO = monthEnd.toISOString();
  const shouldLoadSessions = Boolean(selectedGym?.location);

  const {
    data: sessionsResp,
    error: sessionsError,
    isLoading: sessionsLoading,
    mutate: mutateSessions,
  } = useSWR(
    shouldLoadSessions
      ? `/api/schedule/upcoming?location=${encodeURIComponent(selectedGym!.location)}&from=${encodeURIComponent(
          fromISO
        )}&to=${encodeURIComponent(toISO)}`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const sessions: SessionItem[] = sessionsResp?.sessions ?? [];

  // Group sessions by local YYYY-MM-DD (fixes “day out”)
  const sessionsByDay = useMemo(() => {
    const map: Record<string, SessionItem[]> = {};
    for (const s of sessions) {
      const ms = toMillis(s.start_time);
      if (!ms) continue;
      const d = new Date(ms);
      const key = ymdLocal(d);
      (map[key] ??= []).push(s);
    }
    return map;
  }, [sessions]);

  // Calendar cells
  const firstWeekday = monthStart.getDay(); // 0 Sun .. 6 Sat
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  type Cell = { key: string; blank: boolean; day?: number; ymd?: string; isToday?: boolean; count?: number };

  const cells: Cell[] = useMemo(() => {
    const blanks: Cell[] = Array.from({ length: firstWeekday }, (_, i) => ({ key: `blank-${i}`, blank: true }));
    const days: Cell[] = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const date = new Date(year, month, dayNum);
      const ymd = ymdLocal(date);
      const count = (sessionsByDay[ymd] || []).length;
      const isToday = date.toDateString() === new Date().toDateString();
      return { key: `d-${ymd}`, blank: false, day: dayNum, ymd, isToday, count };
    });
    return [...blanks, ...days];
  }, [firstWeekday, daysInMonth, year, month, sessionsByDay]);

  // Day panel
  const [activeDay, setActiveDay] = useState<string | null>(null);
  useEffect(() => {
    setActiveDay(null);
  }, [year, month, selectedGymId]);

  // Share
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [sharing, setSharing] = useState<{ message: string; link: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function shareWhatsApp(session_id: string) {
    try {
      setPending(session_id);
      setActionErr(null);
      setActionMsg(null);
      const res = await fetch("/api/bookings/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to generate link");
      setSharing({ message: json.whatsappMessage, link: json.link });
      setActionMsg("Share link generated ✨");
    } catch (e: any) {
      setActionErr(e?.message || "Failed to generate link");
    } finally {
      setPending(null);
    }
  }

  // Auto-select first gym
  useEffect(() => {
    if (!selectedGymId && gyms.length > 0) setSelectedGymId(gyms[0].id);
  }, [gyms, selectedGymId]);

  // Booking modal
  const [showBookModal, setShowBookModal] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const [payOnDay, setPayOnDay] = useState(false);
  const [bookMsg, setBookMsg] = useState<string | null>(null);
  const [bookErr, setBookErr] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);

  function openBookingModal(s: SessionItem) {
    setActiveSession(s);
    setShowBookModal(true);
    setBookMsg(null);
    setBookErr(null);
    setGuestName("");
    setGuestEmail("");
    setPayOnDay(false);
  }

  async function confirmBooking() {
    if (!activeSession) return;

    setBookingBusy(true);
    setBookMsg(null);
    setBookErr(null);

    try {
      const isAuthed = Boolean(authSession?.user?.email);

      if (!isAuthed) {
        if (!guestName.trim()) throw new Error("Please enter your name.");
        if (!guestEmail.trim()) throw new Error("Please enter your email.");
      }

  let method: PaymentMethod;
  
  if (isGymMember && isAuthed) {
    // Full gym members book free
    method = "member_free";
  } else if (isCashPayer && isAuthed) {
    // Cash members pay £8 cash on the day
    method = "pay_on_day";
  } else if (payOnDay) {
    // Non-members pay £10 on the day
    method = "pay_on_day";
  } else {
    // Default: £8 Stripe prepay
    method = "stripe";
  }

      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeSession.id,
          payment_method: method,
          guest_name: isAuthed ? undefined : guestName.trim(),
          guest_email: isAuthed ? undefined : guestEmail.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to create booking");

      const bookingId = String(json.booking_id || "");

      if (method === "stripe") {
        const checkoutRes = await fetch("/api/billing/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose: "class_booking", booking_id: bookingId }),
        });

        const cj = await checkoutRes.json().catch(() => ({}));
        if (!checkoutRes.ok) throw new Error(cj?.error || "Failed to start Stripe checkout");
        if (!cj?.url) throw new Error("Stripe checkout created but no URL returned");
        window.location.href = cj.url;
        return;
      }

    if (method === "member_free") {
      setBookMsg("Booked ✅ Gym member booking (free)");
    } else if (isCashPayer) {
      setBookMsg("Booked ✅ Pay £8 cash at the gym");
    } else if (method === "pay_on_day") {
      setBookMsg("Booked ✅ Pay £10 on arrival");
    } else {
      setBookMsg("Booked ✅");
    }

      mutateSessions();
    } catch (e: any) {
      setBookErr(e?.message || "Booking failed");
    } finally {
      setBookingBusy(false);
    }
  }

  return (
    <>
      <main className="container py-3 schedule-page" style={{ paddingBottom: "90px", color: "#fff" }}>
        {/* Toolbar */}
        <div className="schedule-toolbar">
          <button className="btn btn-bxkr-outline" onClick={prevMonth} aria-label="Previous month">
            ← Previous
          </button>
          <h2 className="mb-0 month-title">Schedule — {monthLabel}</h2>
          <button className="btn btn-bxkr-outline" onClick={nextMonth} aria-label="Next month">
            Next →
          </button>
        </div>

        {/* Gym selector */}
        <div className="futuristic-card p-3 mb-3">
          <label className="form-label">Select gym</label>
          {gymsError && <div className="text-danger">Failed to load gyms.</div>}
          <select
            className="form-select gym-select"
            value={selectedGymId ?? ""}
            onChange={(e) => setSelectedGymId(e.target.value || null)}
            aria-label="Select a gym that runs BXKR classes"
          >
            {gyms.length === 0 && <option value="">No gyms found</option>}
            {gyms.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} — {g.location}
              </option>
            ))}
          </select>
        </div>

        {/* Calendar */}
        <div className="schedule-calendar mb-3" role="grid" aria-label={`Calendar for ${monthLabel}`}>
          <div className="calendar-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="weekday">
                {d}
              </div>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((cell) => {
              if (cell.blank) return <div key={cell.key} />;
              const isActive = cell.ymd === activeDay;
              const classes = [
                "calendar-day",
                cell.isToday ? "today" : "",
                isActive ? "active" : "",
                (cell.count ?? 0) > 0 ? "has-sessions" : "",
              ].join(" ").trim();
              return (
                <button
                  key={cell.key}
                  className={classes}
                  onClick={() => setActiveDay(cell.ymd!)}
                  aria-label={`${cell.ymd}: ${(cell.count ?? 0)} session${(cell.count ?? 0) > 1 ? "s" : ""}`}
                >
                  <div className="num">{cell.day}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        {activeDay && (
          <div className="futuristic-card p-3 day-panel">
            <div className="panel-header">
              <h5 className="mb-0 title">Sessions on {activeDay}</h5>
              <button className="btn btn-bxkr-outline" onClick={() => setActiveDay(null)}>
                Close
              </button>
            </div>

            {sessionsLoading && <div>Loading sessions…</div>}
            {sessionsError && <div className="text-danger">Failed to load sessions for this range.</div>}

            {!sessionsLoading && (sessionsByDay[activeDay]?.length ?? 0) === 0 && (
              <div className="text-dim">No BXKR sessions scheduled on this day at {selectedGym?.name}.</div>
            )}

            {(sessionsByDay[activeDay] || []).map((s) => {
              const startMs = toMillis(s.start_time);
              const endMs = toMillis(s.end_time);
              const startStr = startMs ? new Date(startMs).toLocaleString() : "Unknown";
              const endStr = endMs ? new Date(endMs).toLocaleTimeString() : "";

              const full = s.max_attendance > 0 && s.current_attendance >= s.max_attendance;
              const pct = s.max_attendance > 0 ? Math.min(100, Math.round((s.current_attendance / s.max_attendance) * 100)) : 0;

              return (
                <div key={s.id} className="session-card">
                  <div className="session-info">
                    <div className="name">{s.class_id} — {s.gym_name}</div>
                    <div className="sub">
                      Coach: {s.coach_name || "TBC"} • {startStr}{endStr ? ` — ${endStr}` : ""}
                    </div>
                    <div className="session-meta">
                      <span className="chip">
                        £8 prebook / £10 pay on day
                        {isGymMember ? " • Members book free" : ""}
                        {isCashPayer ? " • Cash members £8 pay on arrival" : ""}
                      </span>
                      <span className="chip capacity">
                        <span>{s.current_attendance}/{s.max_attendance || "∞"}</span>
                        <span className="bar"><span style={{ width: `${pct}%` }} /></span>
                      </span>
                    </div>
                  </div>

                  <div className="session-actions">
                    <button
                      className="btn btn-bxkr"
                      onClick={() => openBookingModal(s)}
                      disabled={full || pending === s.id}
                      title={full ? "Session is full" : "Book"}
                    >
                      {full ? "Full" : "Book"}
                    </button>

                    <button
                      className="btn btn-bxkr-outline"
                      onClick={() => shareWhatsApp(s.id)}
                      disabled={pending === s.id}
                      title="Generate WhatsApp link"
                    >
                      Share
                    </button>
                  </div>
                </div>
              );
            })}

            {(actionMsg || actionErr || sharing) && (
              <div className="mt-2">
                {actionMsg && <div className="pill-success mb-2">{actionMsg}</div>}
                {actionErr && <div className="text-danger mb-2">{actionErr}</div>}
                {sharing && (
                  <div className="futuristic-card p-2">
                    <div className="small mb-2">WhatsApp message</div>
                    <textarea className="form-control mb-2" rows={3} readOnly value={sharing.message} />
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-bxkr"
                        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(sharing.message)}`, "_blank")}
                      >
                        Open WhatsApp
                      </button>
                      <button
                        className="btn btn-bxkr-outline"
                        onClick={() => navigator.clipboard?.writeText(sharing.message)}
                      >
                        Copy message
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Booking modal */}
        {showBookModal && activeSession && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(6px)",
              zIndex: 3000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
            onClick={() => {
              if (!bookingBusy) setShowBookModal(false);
            }}
          >
            <div className="futuristic-card p-3" style={{ width: "min(520px, 92vw)" }} onClick={(e) => e.stopPropagation()}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="m-0">Book session</h5>
                <button className="btn btn-bxkr-outline btn-sm" onClick={() => setShowBookModal(false)} disabled={bookingBusy}>
                  Close
                </button>
              </div>

              <div className="mb-2">
                <div className="fw-semibold">{activeSession.class_id} — {activeSession.gym_name}</div>
                <div className="small text-dim">
                  {(() => {
                    const ms = toMillis(activeSession.start_time);
                    return ms ? new Date(ms).toLocaleString() : "TBC";
                  })()}{" "}
                  • Coach: {activeSession.coach_name || "TBC"}
                </div>
              </div>

              {!authSession?.user?.email && (
                <>
                  <div className="mb-2">
                    <label className="form-label">Name</label>
                    <input className="form-control" value={guestName} onChange={(e) => setGuestName(e.target.value)} disabled={bookingBusy} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Email</label>
                    <input className="form-control" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} disabled={bookingBusy} />
                  </div>
                </>
              )}

              {!isMemberFree && (
                <div className="form-check mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="payOnDay"
                    checked={payOnDay}
                    onChange={(e) => setPayOnDay(e.target.checked)}
                    disabled={bookingBusy}
                  />
                  <label className="form-check-label" htmlFor="payOnDay">
                    {isCashPayer ? "Pay £8 cash on the day" : "Pay on the day (£10)"}
                  </label>
                </div>
              )}

              {isMemberFree && (
                <div className="alert alert-info mt-2" style={{ marginBottom: 0 }}>
                  You’re a member. This booking is free.
                </div>
              )}

              {bookErr && <div className="alert alert-danger mt-2">{bookErr}</div>}
              {bookMsg && <div className="alert alert-success mt-2">{bookMsg}</div>}

              <div className="d-grid gap-2 mt-3">
                <button className="btn btn-bxkr" onClick={confirmBooking} disabled={bookingBusy}>
                  {bookingBusy ? "Processing…" : isMemberFree ? "Book free" : payOnDay ? "Confirm booking" : "Pay £8 now (Stripe)"}
                </button>
              </div>

              <div className="small text-dim mt-2">
                {!isMemberFree ? (payOnDay ? "You’ll pay £10 at the gym." : "You’ll be redirected to Stripe to pay £8.") : null}
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
