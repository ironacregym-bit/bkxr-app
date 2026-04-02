// FILE: pages/schedule.tsx
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

type PaymentMethod = "stripe" | "pay_on_day" | "cash" | "bank";

export default function SchedulePage() {
  const { data: authSession } = useSession();
  const role = (authSession?.user as any)?.role || "user";

  const { data: gymsResp, error: gymsError } = useSWR("/api/gyms/list", fetcher);
  const gyms: Gym[] = gymsResp?.gyms ?? [];
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const selectedGym = useMemo(
    () => gyms.find((g) => g.id === selectedGymId) || null,
    [gyms, selectedGymId]
  );

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
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

  const fromISO = monthStart.toISOString();
  const toISO = monthEnd.toISOString();
  const shouldLoadSessions = Boolean(selectedGym?.location);

  const { data: sessionsResp, error: sessionsError, isLoading: sessionsLoading } = useSWR(
    shouldLoadSessions
      ? `/api/schedule/upcoming?location=${encodeURIComponent(selectedGym!.location)}&from=${encodeURIComponent(
          fromISO
        )}&to=${encodeURIComponent(toISO)}`
      : null,
    fetcher
  );

  const sessions: SessionItem[] = sessionsResp?.sessions ?? [];

  const sessionsByDay = useMemo(() => {
    const map: Record<string, SessionItem[]> = {};
    for (const s of sessions) {
      const ms = toMillis(s.start_time);
      if (!ms) continue;
      const d = new Date(ms);
      const key = d.toISOString().slice(0, 10);
      (map[key] ??= []).push(s);
    }
    return map;
  }, [sessions]);

  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  type Cell = { key: string; blank: boolean; day?: number; ymd?: string; isToday?: boolean; count?: number };

  const cells: Cell[] = useMemo(() => {
    const blanks: Cell[] = Array.from({ length: firstWeekday }, (_, i) => ({ key: `blank-${i}`, blank: true }));
    const days: Cell[] = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const date = new Date(year, month, dayNum);
      const ymd = date.toISOString().slice(0, 10);
      const count = (sessionsByDay[ymd] || []).length;
      const isToday = date.toDateString() === new Date().toDateString();
      return { key: `d-${ymd}`, blank: false, day: dayNum, ymd, isToday, count };
    });
    return [...blanks, ...days];
  }, [firstWeekday, daysInMonth, year, month, sessionsByDay]);

  const [activeDay, setActiveDay] = useState<string | null>(null);
  useEffect(() => {
    setActiveDay(null);
  }, [year, month, selectedGymId]);

  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [sharing, setSharing] = useState<{ message: string; link: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const [showBookModal, setShowBookModal] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [bookMsg, setBookMsg] = useState<string | null>(null);
  const [bookErr, setBookErr] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);

  const canUseCash = role === "admin" || role === "gym";

  function openBookingModal(s: SessionItem) {
    setActiveSession(s);
    setShowBookModal(true);
    setBookMsg(null);
    setBookErr(null);
    setGuestName("");
    setGuestEmail("");
  }

  async function reserveAndPay(method: PaymentMethod) {
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

      const reserveRes = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeSession.id,
          payment_method: method,
          guest_name: isAuthed ? undefined : guestName.trim(),
          guest_email: isAuthed ? undefined : guestEmail.trim(),
        }),
      });

      const reserveJson = await reserveRes.json().catch(() => ({}));
      if (!reserveRes.ok) throw new Error(reserveJson?.error || "Failed to reserve booking");

      const bookingId = reserveJson.booking_id as string | undefined;
      if (!bookingId) throw new Error("Reserved but no booking_id returned");

      if (method === "stripe") {
        const checkoutRes = await fetch("/api/billing/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose: "class_booking", booking_id: bookingId }),
        });

        const checkoutJson = await checkoutRes.json().catch(() => ({}));
        if (!checkoutRes.ok) throw new Error(checkoutJson?.error || "Failed to start Stripe checkout");

        if (!checkoutJson?.url) throw new Error("Stripe checkout created but no URL returned");
        window.location.href = checkoutJson.url;
        return;
      }

      if (method === "pay_on_day") setBookMsg("Booked ✅ Pay £10 on arrival");
      else if (method === "bank") setBookMsg("Reserved ✅ Bank transfer pending");
      else if (method === "cash") setBookMsg("Booked ✅ Cash/Comp recorded");
      else setBookMsg("Booked ✅");

    } catch (e: any) {
      setBookErr(e?.message || "Booking failed");
    } finally {
      setBookingBusy(false);
    }
  }

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

  useEffect(() => {
    if (!selectedGymId && gyms.length > 0) {
      setSelectedGymId(gyms[0].id);
    }
  }, [gyms, selectedGymId]);

  return (
    <>
      <main className="container py-3 schedule-page" style={{ paddingBottom: "90px", color: "#fff" }}>
        <div className="schedule-toolbar">
          <button className="btn btn-bxkr-outline" onClick={prevMonth} aria-label="Previous month">
            ← Previous
          </button>
          <h2 className="mb-0 month-title">Schedule — {monthLabel}</h2>
          <button className="btn btn-bxkr-outline" onClick={nextMonth} aria-label="Next month">
            Next →
          </button>
        </div>

        <div className="bxkr-card p-3 mb-3">
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
              ]
                .join(" ")
                .trim();
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

        {activeDay && (
          <div className="bxkr-card p-3 day-panel">
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
              const pct =
                s.max_attendance > 0 ? Math.min(100, Math.round((s.current_attendance / s.max_attendance) * 100)) : 0;

              return (
                <div key={s.id} className="session-card">
                  <div className="session-info">
                    <div className="name">
                      {s.class_id} — {s.gym_name}
                    </div>
                    <div className="sub">
                      Coach: {s.coach_name || "TBC"} • {startStr}
                      {endStr ? ` — ${endStr}` : ""}
                    </div>
                    <div className="session-meta">
                      <span className="chip">£8 prebook / £10 on the day</span>
                      <span className="chip capacity">
                        <span>
                          {s.current_attendance}/{s.max_attendance || "∞"}
                        </span>
                        <span className="bar">
                          <span style={{ width: `${pct}%` }} />
                        </span>
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
                  <div className="bxkr-card p-2">
                    <div className="small mb-2">WhatsApp message</div>
                    <textarea className="form-control mb-2" rows={3} readOnly value={sharing.message} />
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-bxkr"
                        onClick={() => {
                          const url = `https://wa.me/?text=${encodeURIComponent(sharing.message)}`;
                          window.open(url, "_blank");
                        }}
                      >
                        Open WhatsApp
                      </button>
                      <button className="btn btn-bxkr-outline" onClick={() => navigator.clipboard?.writeText(sharing.message)}>
                        Copy message
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
            <div className="bxkr-card p-3" style={{ width: "min(520px, 92vw)" }} onClick={(e) => e.stopPropagation()}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="m-0">Book session</h5>
                <button className="btn btn-bxkr-outline btn-sm" onClick={() => setShowBookModal(false)} disabled={bookingBusy}>
                  Close
                </button>
              </div>

              <div className="mb-2">
                <div className="fw-semibold">
                  {activeSession.class_id} — {activeSession.gym_name}
                </div>
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

              {bookErr && <div className="alert alert-danger">{bookErr}</div>}
              {bookMsg && <div className="alert alert-success">{bookMsg}</div>}

              <div className="d-grid gap-2 mt-2">
                <button className="btn btn-bxkr" onClick={() => reserveAndPay("stripe")} disabled={bookingBusy}>
                  {bookingBusy ? "Processing…" : "Prepay £8 now (Stripe)"}
                </button>

                <button className="btn btn-bxkr-outline" onClick={() => reserveAndPay("pay_on_day")} disabled={bookingBusy}>
                  Pay £10 on the day
                </button>

                <button className="btn btn-outline-light" onClick={() => reserveAndPay("bank")} disabled={bookingBusy}>
                  Bank transfer £8
                </button>

                {canUseCash && (
                  <button className="btn btn-outline-secondary" onClick={() => reserveAndPay("cash")} disabled={bookingBusy}>
                    Cash / Comp (coach)
                  </button>
                )}
              </div>

              <div className="small text-dim mt-2">Prepay is £8. Pay on the day is £10.</div>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
