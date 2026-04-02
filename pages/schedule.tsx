"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import { toMillis } from "../lib/time";

const fetcher = (u: string) => fetch(u).then(r => r.json());

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

type PaymentMethod = "stripe" | "pay_on_day" | "cash";

export default function SchedulePage() {
  const { data: authSession } = useSession();

  /* -----------------------
     URL date range (Friday link support)
     ----------------------- */
  const params =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

  const fromParam = params?.get("from") || null;
  const toParam = params?.get("to") || null;

  /* -----------------------
     Gyms
     ----------------------- */
  const { data: gymsResp } = useSWR("/api/gyms/list", fetcher);
  const gyms: Gym[] = gymsResp?.gyms ?? [];
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const selectedGym = useMemo(
    () => gyms.find(g => g.id === selectedGymId) || null,
    [gyms, selectedGymId]
  );

  useEffect(() => {
    if (!selectedGymId && gyms.length > 0) {
      setSelectedGymId(gyms[0].id);
    }
  }, [gyms, selectedGymId]);

  /* -----------------------
     Date range
     ----------------------- */
  const today = new Date();
  const monthStart = useMemo(
    () => (fromParam ? new Date(fromParam) : new Date(today.getFullYear(), today.getMonth(), 1)),
    [fromParam]
  );
  const monthEnd = useMemo(
    () => (toParam ? new Date(toParam) : new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    [toParam]
  );

  /* -----------------------
     Sessions
     ----------------------- */
  const {
    data: sessionsResp,
    isLoading,
  } = useSWR(
    selectedGym?.location
      ? `/api/schedule/upcoming?location=${encodeURIComponent(
          selectedGym.location
        )}&from=${encodeURIComponent(monthStart.toISOString())}&to=${encodeURIComponent(
          monthEnd.toISOString()
        )}`
      : null,
    fetcher
  );

  const sessions: SessionItem[] = sessionsResp?.sessions ?? [];

  /* -----------------------
     Booking modal
     ----------------------- */
  const [activeSession, setActiveSession] = useState<SessionItem | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canUseCash =
    !!authSession?.user?.email ||
    guestEmail.endsWith("@bxkr.co.uk"); // simple exclusion rule (adjust later)

  async function reserveAndBook(method: PaymentMethod) {
    if (!activeSession) return;
    setPending(true);
    setBookingStatus(null);

    try {
      const res = await fetch("/api/bookings/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeSession.id,
          guest_name: authSession ? undefined : guestName,
          guest_email: authSession ? undefined : guestEmail,
          payment_method: method === "pay_on_day" ? "pay_on_day" : method,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to reserve");

      if (method === "stripe") {
        const checkout = await fetch("/api/billing/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purpose: "class_booking",
            booking_id: json.booking_id,
          }),
        });
        const cj = await checkout.json();
        if (!checkout.ok) throw new Error(cj?.error || "Failed to start payment");
        window.location.href = cj.url;
        return;
      }

      setBookingStatus("Booking confirmed ✅");
    } catch (e: any) {
      setBookingStatus(e?.message || "Booking failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <main className="container py-3" style={{ paddingBottom: 90, color: "#fff" }}>
        <h2 className="mb-3">
          {fromParam ? "Next Week Sessions" : "Schedule"}
        </h2>

        {!fromParam && (
          <div className="mb-3">
            <label className="form-label">Select gym</label>
            <select
              className="form-select"
              value={selectedGymId ?? ""}
              onChange={e => setSelectedGymId(e.target.value)}
            >
              {gyms.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} — {g.location}
                </option>
              ))}
            </select>
          </div>
        )}

        {isLoading && <div>Loading sessions…</div>}

        {!isLoading &&
          sessions.map(s => {
            const startMs = toMillis(s.start_time);
            const startStr = startMs ? new Date(startMs).toLocaleString() : "TBC";
            const full = s.max_attendance > 0 && s.current_attendance >= s.max_attendance;

            return (
              <div key={s.id} className="bxkr-card p-3 mb-2">
                <div className="fw-semibold">{s.class_id} — {s.gym_name}</div>
                <div className="small text-dim">
                  {startStr} • Coach: {s.coach_name || "TBC"}
                </div>

                <div className="d-flex justify-content-between align-items-center mt-2">
                  <span>£8 prebook / £10 on the day</span>
                  <button
                    className="btn btn-bxkr"
                    disabled={full}
                    onClick={() => setActiveSession(s)}
                  >
                    {full ? "Full" : "Book"}
                  </button>
                </div>
              </div>
            );
          })}

        {/* Booking modal */}
        {activeSession && (
          <div className="bxkr-modal">
            <div className="bxkr-card p-3">
              <h5 className="mb-2">Book session</h5>

              {!authSession && (
                <>
                  <input
                    className="form-control mb-2"
                    placeholder="Your name"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                  />
                  <input
                    className="form-control mb-2"
                    placeholder="Email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                  />
                </>
              )}

              <button
                className="btn btn-bxkr w-100 mb-2"
                disabled={pending}
                onClick={() => reserveAndBook("stripe")}
              >
                Prepay £8 now
              </button>

              <button
                className="btn btn-bxkr-outline w-100 mb-2"
                disabled={pending}
                onClick={() => reserveAndBook("pay_on_day")}
              >
                Pay £10 on the day
              </button>

              {canUseCash && (
                <button
                  className="btn btn-outline-secondary w-100 mb-2"
                  disabled={pending}
                  onClick={() => reserveAndBook("cash")}
                >
                  Cash / Comp
                </button>
              )}

              {bookingStatus && (
                <div className="small mt-2">{bookingStatus}</div>
              )}

              <button
                className="btn btn-link w-100 mt-2"
                onClick={() => setActiveSession(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
