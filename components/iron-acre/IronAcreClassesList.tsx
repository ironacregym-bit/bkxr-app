// components/iron-acre/IronAcreClassesList.tsx
import { useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toMillis } from "../../lib/time";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Gym = {
  id: string;
  name: string;
  location?: string | null;
};

type SessionItem = {
  id: string;
  class_id: string | null;
  coach_name?: string | null;
  start_time: string | null;
  end_time: string | null;
  price: number;
  max_attendance: number;
  current_attendance: number;
  gym_name: string | null;
  location: string | null;
};

type UserAccess = {
  membership_status?: string | null;
  payment_type?: string | null;
  gym_id?: string | null;
};

type BookingsMineResponse = {
  sessionIds?: string[];
};

type PaymentMethod = "stripe" | "pay_on_day" | "member_free";

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
  e.setDate(s.getDate() + 13);
  e.setHours(23, 59, 59, 999);
  return e;
}

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function renderStartStr(start_time: string | null) {
  if (!start_time) return "TBC";
  const d = new Date(start_time);
  return isNaN(d.getTime())
    ? "TBC"
    : d.toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
}

export default function IronAcreClassesList() {
  const { data: authSession } = useSession();
  const isAuthed = Boolean(authSession?.user?.email);
  const authedEmail = authSession?.user?.email || "";

  const { data: gymsResp } = useSWR("/api/gyms/list", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const gyms: Gym[] = Array.isArray(gymsResp?.gyms) ? gymsResp.gyms : [];

  const profileKey = authedEmail ? `/api/profile?email=${encodeURIComponent(authedEmail)}` : null;
  const {
    data: profile,
    mutate: mutateProfile,
  } = useSWR<UserAccess>(profileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const userGymId = String(profile?.gym_id || "").trim();
  const isGymMember = String(profile?.membership_status || "").toLowerCase() === "gym_member";
  const isCashPayer = String(profile?.payment_type || "").toLowerCase() === "cash";

  const selectedGym = useMemo(() => {
    if (!userGymId) return null;
    return gyms.find((g) => g.id === userGymId) || null;
  }, [gyms, userGymId]);

  const joinableGym = useMemo(() => {
    if (selectedGym) return selectedGym;
    if (gyms.length === 1) return gyms[0];
    const g1 = gyms.find((g) => g.id === "g1");
    return g1 || gyms[0] || null;
  }, [gyms, selectedGym]);

  const now = new Date();
  const weekStart = startOfAlignedWeek(now);
  const weekEnd = endOfAlignedWeek(now);

  const fromISO = weekStart.toISOString();
  const toISO = weekEnd.toISOString();

  const shouldLoadSessions = Boolean(selectedGym?.location);

  const { data: sessionsResp, mutate: mutateSessions } = useSWR(
    shouldLoadSessions
      ? `/api/schedule/upcoming?location=${encodeURIComponent(selectedGym!.location || "")}&from=${encodeURIComponent(
          fromISO
        )}&to=${encodeURIComponent(toISO)}`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const sessions: SessionItem[] = Array.isArray(sessionsResp?.sessions) ? sessionsResp.sessions : [];

  const bookingsKey =
    isAuthed && shouldLoadSessions
      ? `/api/bookings/mine?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`
      : null;

  const { data: bookingsResp, mutate: mutateBookings } = useSWR<BookingsMineResponse>(
    bookingsKey,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 20_000 }
  );

  const [localBookedIds, setLocalBookedIds] = useState<string[]>([]);
  const [bookingBusy, setBookingBusy] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const bookedSet = useMemo(() => {
    const fromApi = Array.isArray(bookingsResp?.sessionIds) ? bookingsResp.sessionIds : [];
    return new Set<string>([...fromApi, ...localBookedIds]);
  }, [bookingsResp?.sessionIds, localBookedIds]);

  const byWeek = useMemo(() => {
    const thisWeekStart = startOfAlignedWeek(now);
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
    thisWeekEnd.setHours(23, 59, 59, 999);

    const nextWeekStart = new Date(thisWeekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    nextWeekStart.setHours(0, 0, 0, 0);

    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
    nextWeekEnd.setHours(23, 59, 59, 999);

    const thisWeek: SessionItem[] = [];
    const nextWeek: SessionItem[] = [];

    for (const s of sessions) {
      const ms = toMillis(s.start_time);
      if (!ms) continue;

      const d = new Date(ms);

      if (d >= thisWeekStart && d <= thisWeekEnd) {
        thisWeek.push(s);
      } else if (d >= nextWeekStart && d <= nextWeekEnd) {
        nextWeek.push(s);
      }
    }

    const group = (arr: SessionItem[]) => {
      const out: Record<string, SessionItem[]> = {};
      for (const s of arr) {
        const ms = toMillis(s.start_time);
        if (!ms) continue;
        const key = ymdLocal(new Date(ms));
        (out[key] ??= []).push(s);
      }
      return out;
    };

    return {
      thisWeek: group(thisWeek),
      nextWeek: group(nextWeek),
    };
  }, [sessions, now]);

  async function handleJoinGym() {
    if (!joinableGym?.id) return;

    setErr(null);
    setMsg(null);
    setJoinBusy(true);

    try {
      const res = await fetch("/api/profile/join-gym", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gym_id: joinableGym.id }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to join gym");
      }

      await mutateProfile();
      setMsg(`You are now linked to ${joinableGym.name}. Class updates and gym sessions will now show here.`);
    } catch (e: any) {
      setErr(e?.message || "Failed to join gym");
    } finally {
      setJoinBusy(false);
    }
  }

  async function book(sessionId: string, payOnDay: boolean) {
    setErr(null);
    setMsg(null);
    setBookingBusy(sessionId);

    try {
      let method: PaymentMethod;

      if (isGymMember && isAuthed) {
        method = "member_free";
      } else if (isCashPayer && isAuthed) {
        method = "pay_on_day";
      } else if (payOnDay) {
        method = "pay_on_day";
      } else {
        method = "stripe";
      }

      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, payment_method: method }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Booking failed");

      if (json.status === "pending_payment") {
        const checkoutRes = await fetch("/api/billing/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose: "class_booking", booking_id: json.booking_id }),
        });

        const cj = await checkoutRes.json().catch(() => ({}));

        if (!checkoutRes.ok) throw new Error(cj?.error || "Stripe error");
        if (!cj?.url) throw new Error("Stripe checkout created but no URL returned");

        window.location.href = cj.url;
        return;
      }

      setLocalBookedIds((prev) => (prev.includes(sessionId) ? prev : [...prev, sessionId]));

      setMsg(
        json.payment_method === "member_free"
          ? "Booked ✅ Gym member booking (free)"
          : isCashPayer
          ? "Booked ✅ Pay £8 cash at the gym"
          : json.payment_method === "pay_on_day"
          ? "Booked ✅ Pay £10 on arrival"
          : "Booked ✅"
      );

      mutateSessions?.();
      mutateBookings?.();
    } catch (e: any) {
      setErr(e?.message || "Booking failed");
    } finally {
      setBookingBusy(null);
    }
  }

  function renderWeek(title: string, groups: Record<string, SessionItem[]>) {
    const days = Object.keys(groups).sort();

    if (!days.length) return null;

    return (
      <div className="mb-3">
        <div className="ia-kicker mb-2">{title.toUpperCase()}</div>

        {days.map((ymd) => (
          <div key={ymd} className="mb-2">
            <div className="text-dim small mb-1">{ymd}</div>

            {(groups[ymd] || []).map((s) => {
              const full = s.max_attendance > 0 && s.current_attendance >= s.max_attendance;
              const startStr = renderStartStr(s.start_time);
              const alreadyBooked = bookedSet.has(s.id);

              return (
                <div
                  key={s.id}
                  className="mb-2"
                  style={{
                    padding: "12px 12px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.05)",
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div style={{ minWidth: 0 }}>
                      <div className="ia-tile-title" style={{ fontSize: "1rem" }}>
                        {s.class_id || "Class"}
                        {s.gym_name ? ` • ${s.gym_name}` : ""}
                      </div>

                      <div className="text-dim small">
                        {startStr}
                        {s.coach_name ? ` • Coach: ${s.coach_name}` : ""}
                      </div>

                      <div className="text-dim small mt-1">
                        Seats: {s.current_attendance}/{s.max_attendance || "∞"}
                        {isGymMember ? " • Members book free" : ""}
                        {isCashPayer ? " • Cash members £8 pay on arrival" : ""}
                      </div>
                    </div>

                    <div className="d-flex flex-column gap-2" style={{ minWidth: 120 }}>
                      <button
                        type="button"
                        className={alreadyBooked ? "btn btn-sm ia-btn" : "btn btn-sm ia-btn-primary"}
                        disabled={alreadyBooked || full || bookingBusy === s.id}
                        onClick={() => book(s.id, false)}
                        style={{ opacity: full ? 0.6 : 1 }}
                      >
                        {alreadyBooked ? "Booked" : full ? "Full" : bookingBusy === s.id ? "…" : "Book"}
                      </button>

                      {!isGymMember && !alreadyBooked ? (
                        <button
                          type="button"
                          className="btn btn-sm ia-btn"
                          disabled={full || bookingBusy === s.id}
                          onClick={() => book(s.id, true)}
                        >
                          Pay on day
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  const emptyThis = Object.keys(byWeek.thisWeek || {}).length === 0;
  const emptyNext = Object.keys(byWeek.nextWeek || {}).length === 0;
  const emptyAll = emptyThis && emptyNext;
  const hasGym = Boolean(userGymId);

  return (
    <section className="futuristic-card ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="ia-kicker">
          <i className="fas fa-calendar-alt" style={{ color: "var(--ia-neon)" }} />
          CLASSES
        </div>

        <span className="ia-badge ia-badge-neon">This week + next</span>
      </div>

      {msg ? (
        <div
          className="mb-2"
          style={{
            borderRadius: 999,
            padding: "8px 12px",
            background: "rgba(24,255,154,0.14)",
            color: "var(--ia-neon)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
            fontWeight: 600,
            fontSize: ".85rem",
          }}
        >
          {msg}
        </div>
      ) : null}

      {err ? <div className="alert alert-danger mb-2">{err}</div> : null}

      {!isAuthed ? (
        <div className="text-dim small">Sign in to view your gym classes and book sessions.</div>
      ) : !hasGym ? (
        <div
          style={{
            padding: "14px 14px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.05)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          <div className="ia-tile-title" style={{ fontSize: "1rem" }}>
            Join a gym to receive classes
          </div>

          <div className="text-dim small mt-1">
            Link your account to {joinableGym?.name || "the gym"} to see the timetable, book classes and receive gym
            notifications.
          </div>

          <div className="mt-3">
            <button
              type="button"
              className="btn btn-sm ia-btn-primary"
              onClick={handleJoinGym}
              disabled={joinBusy || !joinableGym?.id}
            >
              {joinBusy ? "Joining…" : `Join ${joinableGym?.name || "gym"}`}
            </button>
          </div>
        </div>
      ) : emptyAll ? (
        <div className="text-dim small">No classes scheduled.</div>
      ) : (
        <>
          {renderWeek("This week", byWeek.thisWeek)}
          {renderWeek("Next week", byWeek.nextWeek)}
        </>
      )}
    </section>
  );
}
