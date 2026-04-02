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
  membership_status?: string | null;
  payment_type?: string | null;
};

type PaymentMethod = "stripe" | "pay_on_day" | "member_free";

/* ---------- Local YYYY-MM-DD (fixes day offset bug) ---------- */
function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SchedulePage() {
  const { data: authSession } = useSession();
  const isAuthed = Boolean(authSession?.user?.email);
  const authedEmail = authSession?.user?.email || "";

  /* ---------- Profile / membership ---------- */
  const profileKey = authedEmail
    ? `/api/profile?email=${encodeURIComponent(authedEmail)}`
    : null;

  const { data: profile } = useSWR<UserAccess>(profileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const isGymMember =
    String(profile?.membership_status || "").toLowerCase() === "gym_member";

  const isCashPayer =
    String(profile?.payment_type || "").toLowerCase() === "cash";

  /* ---------- Gyms ---------- */
  const { data: gymsResp } = useSWR("/api/gyms/list", fetcher);
  const gyms: Gym[] = gymsResp?.gyms ?? [];
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

  /* ---------- Calendar ---------- */
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const monthStart = useMemo(() => new Date(year, month, 1), [year, month]);
  const monthEnd = useMemo(
    () => new Date(year, month + 1, 0, 23, 59, 59, 999),
    [year, month]
  );

  const monthLabel = monthStart.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

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

  /* ---------- Sessions ---------- */
  const fromISO = monthStart.toISOString();
  const toISO = monthEnd.toISOString();

  const { data: sessionsResp } = useSWR(
    selectedGym?.location
      ? `/api/schedule/upcoming?location=${encodeURIComponent(
          selectedGym.location
        )}&from=${fromISO}&to=${toISO}`
      : null,
    fetcher
  );

  const sessions: SessionItem[] = sessionsResp?.sessions ?? [];

  const sessionsByDay = useMemo(() => {
    const map: Record<string, SessionItem[]> = {};
    for (const s of sessions) {
      const ms = toMillis(s.start_time);
      if (!ms) continue;
      const key = ymdLocal(new Date(ms));
      (map[key] ??= []).push(s);
    }
    return map;
  }, [sessions]);

  /* ---------- Booking modal ---------- */
  const [showBookModal, setShowBookModal] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [payOnDay, setPayOnDay] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookMsg, setBookMsg] = useState<string | null>(null);
  const [bookErr, setBookErr] = useState<string | null>(null);

  function openBookingModal(s: SessionItem) {
    setActiveSession(s);
    setShowBookModal(true);
    setGuestName("");
    setGuestEmail("");
    setPayOnDay(false);
    setBookMsg(null);
    setBookErr(null);
  }

  async function confirmBooking() {
    if (!activeSession) return;
    setBookingBusy(true);
    setBookErr(null);
    setBookMsg(null);

    try {
      if (!isAuthed) {
        if (!guestName.trim()) throw new Error("Please enter your name");
        if (!guestEmail.trim()) throw new Error("Please enter your email");
      }

      let method: PaymentMethod;

      if (isGymMember && isAuthed) {
        method = "member_free";
      } else if (isCashPayer && isAuthed) {
        method = "pay_on_day"; // £8 cash
      } else if (payOnDay) {
        method = "pay_on_day"; // £10
      } else {
        method = "stripe"; // £8
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

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Booking failed");

      if (json.status === "pending_payment") {
        const checkoutRes = await fetch(
          "/api/billing/create-checkout-session",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              purpose: "class_booking",
              booking_id: json.booking_id,
            }),
          }
        );

        const cj = await checkoutRes.json();
        if (!checkoutRes.ok) throw new Error(cj?.error || "Stripe error");
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
    } catch (e: any) {
      setBookErr(e.message || "Booking failed");
    } finally {
      setBookingBusy(false);
    }
  }

  /* ---------- UI ---------- */
  return (
    <>
      <main className="container py-3 schedule-page" style={{ paddingBottom: 90 }}>
        <div className="schedule-toolbar">
          <button onClick={prevMonth}>←</button>
          <h2>Schedule — {monthLabel}</h2>
          <button onClick={nextMonth}>→</button>
        </div>

        {Object.entries(sessionsByDay).map(([day, list]) => (
          <div key={day} className="futuristic-card p-3 mb-2">
            <h5>{day}</h5>
            {list.map((s) => (
              <div key={s.id} className="session-card">
                <div>{s.class_id}</div>
                <div>
                  £8 prebook / £10 pay on day
                  {isGymMember && " • Members free"}
                  {isCashPayer && " • Cash £8"}
                </div>
                <button onClick={() => openBookingModal(s)}>Book</button>
              </div>
            ))}
          </div>
        ))}

        {showBookModal && activeSession && (
          <div className="modal">
            <div className="futuristic-card p-3">
              <h4>Book session</h4>

              {!isAuthed && (
                <>
                  <input
                    placeholder="Name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                  <input
                    placeholder="Email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                  />
                </>
              )}

              {!isGymMember && (
                <label>
                  <input
                    type="checkbox"
                    checked={payOnDay}
                    onChange={(e) => setPayOnDay(e.target.checked)}
                  />
                  {isCashPayer ? " Pay £8 cash on the day" : " Pay on the day (£10)"}
                </label>
              )}

              {bookErr && <div className="error">{bookErr}</div>}
              {bookMsg && <div className="success">{bookMsg}</div>}

              <button disabled={bookingBusy} onClick={confirmBooking}>
                {bookingBusy
                  ? "Processing…"
                  : isGymMember
                  ? "Book free"
                  : payOnDay
                  ? "Confirm booking"
                  : "Pay £8 now"}
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
