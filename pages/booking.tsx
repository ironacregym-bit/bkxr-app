// pages/booking.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
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
  class_name?: string | null;
  coach_name?: string | null;
  start_time: string | number | null;
  end_time: string | number | null;
  price: number;
  drop_in_price?: number | null;
  max_attendance: number;
  current_attendance: number;
  gym_name: string;
  location: string;
};

type PaymentMethod = "stripe" | "pay_on_day";

type Cell =
  | {
      key: string;
      blank: true;
    }
  | {
      key: string;
      blank: false;
      day: number;
      ymd: string;
      count: number;
      isToday: boolean;
    };

function safeMillis(value: string | number | null | undefined): number {
  const ms = toMillis(value);
  return typeof ms === "number" && Number.isFinite(ms) ? ms : 0;
}

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(value: string | number | null) {
  const ms = safeMillis(value);
  if (!ms) return "TBC";

  return new Date(ms).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatTime(value: string | number | null) {
  const ms = safeMillis(value);
  if (!ms) return "";

  return new Date(ms).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function compareSessionStart(a: SessionItem, b: SessionItem) {
  return safeMillis(a.start_time) - safeMillis(b.start_time);
}

function classLabel(session: SessionItem) {
  return String(session.class_name || session.class_id || "Class").trim();
}

function normaliseEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

export default function BookingPage() {
  const { data: gymsResp, error: gymsError } = useSWR("/api/gyms/list", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const gyms: Gym[] = Array.isArray(gymsResp?.gyms) ? gymsResp.gyms : [];
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedGymId && gyms.length > 0) {
      setSelectedGymId(gyms[0].id);
    }
  }, [gyms, selectedGymId]);

  const selectedGym = useMemo(
    () => gyms.find((g) => g.id === selectedGymId) || null,
    [gyms, selectedGymId]
  );

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const monthStart = useMemo(
    () => new Date(year, month, 1, 0, 0, 0, 0),
    [year, month]
  );

  const monthEnd = useMemo(
    () => new Date(year, month + 1, 0, 23, 59, 59, 999),
    [year, month]
  );

  const monthLabel = useMemo(
    () =>
      monthStart.toLocaleString("en-GB", {
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
      ? `/api/schedule/upcoming?location=${encodeURIComponent(
          selectedGym?.location || ""
        )}&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  const sessions: SessionItem[] = Array.isArray(sessionsResp?.sessions)
    ? sessionsResp.sessions
    : [];

  const sessionsByDay = useMemo(() => {
    const map: Record<string, SessionItem[]> = {};

    for (const session of sessions) {
      const ms = safeMillis(session.start_time);
      if (!ms) continue;

      const key = ymdLocal(new Date(ms));
      const daySessions: SessionItem[] = map[key] ? [...map[key]] : [];
      daySessions.push(session);
      daySessions.sort(compareSessionStart);
      map[key] = daySessions;
    }

    return map;
  }, [sessions]);

  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Cell[] = useMemo(() => {
    const blanks: Cell[] = Array.from({ length: firstWeekday }, (_, i) => ({
      key: `blank-${i}`,
      blank: true,
    }));

    const days: Cell[] = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const date = new Date(year, month, dayNum);
      const ymd = ymdLocal(date);
      const count = (sessionsByDay[ymd] || []).length;
      const isToday = date.toDateString() === new Date().toDateString();

      return {
        key: `d-${ymd}`,
        blank: false,
        day: dayNum,
        ymd,
        count,
        isToday,
      };
    });

    return [...blanks, ...days];
  }, [firstWeekday, daysInMonth, year, month, sessionsByDay]);

  const [activeDay, setActiveDay] = useState<string | null>(null);

  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setActiveDay(null);
    setActionMsg(null);
    setActionErr(null);
    setPending(null);
  }, [year, month, selectedGymId]);

  useEffect(() => {
    setActionMsg(null);
    setActionErr(null);
    setPending(null);
  }, [activeDay]);

  useEffect(() => {
    if (!actionMsg && !actionErr) return;

    const t = window.setTimeout(() => {
      setActionMsg(null);
      setActionErr(null);
    }, 3500);

    return () => window.clearTimeout(t);
  }, [actionMsg, actionErr]);

  const [showBookModal, setShowBookModal] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [payOnDay, setPayOnDay] = useState(false);
  const [bookMsg, setBookMsg] = useState<string | null>(null);
  const [bookErr, setBookErr] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);

  function openBookingModal(session: SessionItem) {
    setActiveSession(session);
    setShowBookModal(true);
    setBookMsg(null);
    setBookErr(null);
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setPayOnDay(false);
  }

  async function confirmBooking() {
    if (!activeSession) return;

    setBookingBusy(true);
    setBookMsg(null);
    setBookErr(null);
    setActionMsg(null);
    setActionErr(null);

    try {
      const name = guestName.trim();
      const email = normaliseEmail(guestEmail);
      const phone = guestPhone.trim();

      if (!name) throw new Error("Please enter your name.");
      if (!email) throw new Error("Please enter your email.");
      if (!email.includes("@")) throw new Error("Please enter a valid email address.");
      if (!phone) throw new Error("Please enter your phone number.");

      const method: PaymentMethod = payOnDay ? "pay_on_day" : "stripe";

      setPending(activeSession.id);

      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeSession.id,
          payment_method: method,
          guest_name: name,
          guest_email: email,
          guest_phone: phone,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to create booking");

      if (json.status === "pending_payment") {
        const checkoutRes = await fetch("/api/bookings/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: json.booking_id,
          }),
        });

        const cj = await checkoutRes.json().catch(() => ({}));
        if (!checkoutRes.ok) throw new Error(cj?.error || "Stripe error");
        if (!cj?.url) throw new Error("Stripe checkout created but no URL returned");

        window.location.href = cj.url;
        return;
      }

      if (method === "pay_on_day") {
        setBookMsg(`Booked. Pay £${Number(activeSession.drop_in_price || 12)} on arrival.`);
        setActionMsg("Booking confirmed. Your place has been reserved.");
      } else {
        setBookMsg("Booked.");
        setActionMsg("Booking confirmed.");
      }

      await mutateSessions?.();
    } catch (e: any) {
      setBookErr(e?.message || "Booking failed");
      setActionErr(e?.message || "Booking failed");
    } finally {
      setBookingBusy(false);
      setPending(null);
    }
  }

  const activeDaySessions = activeDay ? sessionsByDay[activeDay] || [] : [];
  const nowMs = Date.now();

  return (
    <>
      <main className="container py-2 iron-acre-home ia-home-main" style={{ color: "#fff" }}>
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div style={{ minWidth: 0 }}>
              <div className="ia-kicker">
                <i className="fas fa-calendar-alt" />
                public booking
              </div>

              <div className="ia-page-title">Book Your Session</div>

              <div className="ia-page-subtitle">
                Choose a class below and reserve your place. No membership required.
              </div>
            </div>

            <Link href="/">
              <i className="fas fa-chevron-left" />
              Home
            </Link>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
            <button
              type="button"
              className="ia-btn ia-btn-muted ia-btn-icon-left"
              onClick={prevMonth}
              aria-label="Previous month"
            >
              <i className="fas fa-chevron-left" />
              Prev
            </button>

            <div className="ia-card-title-compact text-center">{monthLabel}</div>

            <button
              type="button"
              className="ia-btn ia-btn-muted ia-btn-icon-right"
              onClick={nextMonth}
              aria-label="Next month"
            >
              Next
              <i className="fas fa-chevron-right" />
            </button>
          </div>

          <div className="mb-2">
            <label className="text-dim small mb-1 d-block">Gym</label>

            {gymsError ? (
              <div className="ia-inline-note-error mb-2">Failed to load gyms.</div>
            ) : null}

            <select
              className="form-select gym-select"
              value={selectedGymId ?? ""}
              onChange={(e) => setSelectedGymId(e.target.value || null)}
              aria-label="Select a gym"
            >
              {gyms.length === 0 ? <option value="">No gyms found</option> : null}

              {gyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} — {g.location}
                </option>
              ))}
            </select>
          </div>

          <div className="schedule-calendar" role="grid" aria-label={`Calendar for ${monthLabel}`}>
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

                return (
                  <button
                    key={cell.key}
                    className={`calendar-day ${cell.isToday ? "today" : ""} ${
                      cell.ymd === activeDay ? "active" : ""
                    } ${(cell.count ?? 0) > 0 ? "has-sessions" : ""}`.trim()}
                    onClick={() => setActiveDay(cell.ymd)}
                    aria-label={`${cell.ymd}: ${cell.count} session${cell.count === 1 ? "" : "s"}`}
                  >
                    <div className="num">{cell.day}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {activeDay ? (
          <section className="ia-tile ia-tile-pad mb-3">
            <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
              <div>
                <div className="ia-kicker">
                  <i className="fas fa-clock" />
                  day view
                </div>

                <div className="ia-card-title-compact">{activeDay}</div>
              </div>

              <button type="button" className="ia-btn ia-btn-muted" onClick={() => setActiveDay(null)}>
                Close
              </button>
            </div>

            {sessionsLoading ? <div className="text-dim small">Loading sessions…</div> : null}

            {sessionsError ? (
              <div className="ia-inline-note-error">Failed to load sessions for this range.</div>
            ) : null}

            {!sessionsLoading && activeDaySessions.length === 0 ? (
              <div className="text-dim small">
                No sessions scheduled on this day at {selectedGym?.name || "this gym"}.
              </div>
            ) : null}

            {activeDaySessions.map((session) => {
              const startMs = safeMillis(session.start_time);
              const endMs = safeMillis(session.end_time);
              const isPast = !!startMs && startMs < nowMs;
              const full =
                session.max_attendance > 0 &&
                session.current_attendance >= session.max_attendance;
              const displayName = classLabel(session);
              const prebookPrice = Number(session.price || 9);
              const dropInPrice = Number(session.drop_in_price || 12);

              return (
                <div
                  key={session.id}
                  className="ia-class-item"
                  style={{
                    opacity: isPast ? 0.45 : full ? 0.55 : 1,
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div style={{ minWidth: 0 }}>
                      <div className="ia-class-item-title">
                        {displayName} • {session.gym_name}
                      </div>

                      <div className="ia-class-item-meta mt-1">
                        {formatDateTime(session.start_time)}
                        {endMs ? ` — ${formatTime(session.end_time)}` : ""}
                      </div>

                      <div className="ia-class-item-meta mt-1">
                        {session.coach_name ? `Coach: ${session.coach_name}` : "Coach: TBC"} •{" "}
                        {session.current_attendance}/{session.max_attendance || "∞"} booked
                      </div>

                      <div className="ia-class-item-meta mt-1">
                        {isPast
                          ? "Session complete"
                          : `£${prebookPrice} prebook / £${dropInPrice} pay on day`}
                      </div>
                    </div>

                    <div className="d-flex flex-column gap-2" style={{ flex: "0 0 auto" }}>
                      <button
                        type="button"
                        className={isPast ? "ia-btn ia-btn-muted" : "ia-btn ia-btn-primary"}
                        onClick={() => openBookingModal(session)}
                        disabled={isPast || full || pending === session.id}
                      >
                        {isPast ? "Done" : full ? "Full" : "Book"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {actionMsg || actionErr ? (
              <div className="mt-3">
                {actionMsg ? (
                  <div className="ia-inline-note-success mb-2">{actionMsg}</div>
                ) : null}

                {actionErr ? (
                  <div className="ia-inline-note-error mb-2">{actionErr}</div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : (
          <section className="ia-tile ia-tile-pad mb-3">
            <div className="text-dim small">
              Select a day in the calendar to view available sessions.
            </div>
          </section>
        )}
      </main>

      {showBookModal && activeSession ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.62)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
          onClick={() => {
            if (!bookingBusy) setShowBookModal(false);
          }}
        >
          <div
            className="ia-tile ia-tile-pad"
            style={{ width: "min(520px, 92vw)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
              <div>
                <div className="ia-kicker">
                  <i className="fas fa-ticket-alt" />
                  book session
                </div>

                <div className="ia-card-title-compact">
                  {classLabel(activeSession)} • {activeSession.gym_name}
                </div>
              </div>

              <button
                type="button"
                className="ia-btn ia-btn-muted"
                onClick={() => setShowBookModal(false)}
                disabled={bookingBusy}
              >
                Close
              </button>
            </div>

            <div className="text-dim small mb-2">
              {formatDateTime(activeSession.start_time)}
              {activeSession.coach_name ? ` • Coach: ${activeSession.coach_name}` : ""}
            </div>

            <div className="mb-2">
              <label className="text-dim small mb-1 d-block">Name</label>
              <input
                className="form-control"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                disabled={bookingBusy}
                autoComplete="name"
              />
            </div>

            <div className="mb-2">
              <label className="text-dim small mb-1 d-block">Email</label>
              <input
                className="form-control"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                disabled={bookingBusy}
                autoComplete="email"
              />
            </div>

            <div className="mb-2">
              <label className="text-dim small mb-1 d-block">Phone Number</label>
              <input
                className="form-control"
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                disabled={bookingBusy}
                autoComplete="tel"
              />
            </div>

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
                Pay on the day (£{Number(activeSession.drop_in_price || 12)})
              </label>
            </div>

            {!payOnDay ? (
              <div className="text-dim small mt-2">
                You’ll be redirected to Stripe to pay £{Number(activeSession.price || 9)}.
              </div>
            ) : (
              <div className="text-dim small mt-2">
                You’ll pay £{Number(activeSession.drop_in_price || 12)} when you arrive.
              </div>
            )}

            {bookErr ? <div className="ia-inline-note-error mt-2">{bookErr}</div> : null}
            {bookMsg ? <div className="ia-inline-note-success mt-2">{bookMsg}</div> : null}

            <div className="d-grid gap-2 mt-3">
              <button
                type="button"
                className="ia-btn ia-btn-primary"
                onClick={confirmBooking}
                disabled={bookingBusy}
              >
                {bookingBusy
                  ? "Processing…"
                  : payOnDay
                  ? "Confirm booking"
                  : `Pay £${Number(activeSession.price || 9)} now`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
