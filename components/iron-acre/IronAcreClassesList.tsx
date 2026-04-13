import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toMillis } from "../../lib/time";
import { IA, neonCardStyle, neonPrimaryStyle, neonButtonStyle } from "./theme";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Gym = { id: string; name: string; location: string };

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
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function IronAcreClassesList() {
  const { data: authSession } = useSession();
  const isAuthed = Boolean(authSession?.user?.email);
  const authedEmail = authSession?.user?.email || "";

  // We still load gyms so we can auto-pick the Iron Acre gym location,
  // but we do NOT render the select UI.
  const { data: gymsResp } = useSWR("/api/gyms/list", fetcher, { revalidateOnFocus: false });
  const gyms: Gym[] = gymsResp?.gyms ?? [];
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);

  useEffect(() => {
    // Auto-select first gym silently
    if (!selectedGymId && gyms.length > 0) setSelectedGymId(gyms[0].id);
  }, [gyms, selectedGymId]);

  const selectedGym = useMemo(
    () => gyms.find((g) => g.id === selectedGymId) || null,
    [gyms, selectedGymId]
  );

  const profileKey = authedEmail ? `/api/profile?email=${encodeURIComponent(authedEmail)}` : null;
  const { data: profile } = useSWR<UserAccess>(profileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const isGymMember = String(profile?.membership_status || "").toLowerCase() === "gym_member";
  const isCashPayer = String(profile?.payment_type || "").toLowerCase() === "cash";

  const now = new Date();
  const thisWeekStart = startOfAlignedWeek(now);
  const thisWeekEnd = endOfAlignedWeek(now);
  const nextWeekStart = new Date(thisWeekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const nextWeekEnd = endOfAlignedWeek(nextWeekStart);

  const fromISO = thisWeekStart.toISOString();
  const toISO = nextWeekEnd.toISOString();

  const shouldLoadSessions = Boolean(selectedGym?.location);

  const { data: sessionsResp, mutate: mutateSessions } = useSWR(
    shouldLoadSessions
      ? `/api/schedule/upcoming?location=${encodeURIComponent(selectedGym!.location)}&from=${encodeURIComponent(
          fromISO
        )}&to=${encodeURIComponent(toISO)}`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const sessions: SessionItem[] = sessionsResp?.sessions ?? [];

  const byWeek = useMemo(() => {
    const thisWeek: SessionItem[] = [];
    const nextWeek: SessionItem[] = [];

    for (const s of sessions) {
      const ms = toMillis(s.start_time);
      if (!ms) continue;
      const d = new Date(ms);
      if (d >= thisWeekStart && d <= thisWeekEnd) thisWeek.push(s);
      else if (d >= nextWeekStart && d <= nextWeekEnd) nextWeek.push(s);
    }

    const group = (arr: SessionItem[]) => {
      const m: Record<string, SessionItem[]> = {};
      for (const s of arr) {
        const ms = toMillis(s.start_time);
        if (!ms) continue;
        const key = ymdLocal(new Date(ms));
        (m[key] ??= []).push(s);
      }
      return m;
    };

    return { thisWeek: group(thisWeek), nextWeek: group(nextWeek) };
  }, [sessions, thisWeekStart, thisWeekEnd, nextWeekStart, nextWeekEnd]);

  const [bookingBusy, setBookingBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function book(sessionId: string, payOnDay: boolean) {
    setErr(null);
    setMsg(null);
    setBookingBusy(sessionId);

    try {
      let method: PaymentMethod;

      if (isGymMember && isAuthed) method = "member_free";
      else if (isCashPayer && isAuthed) method = "pay_on_day";
      else if (payOnDay) method = "pay_on_day";
      else method = "stripe";

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
        <div className="fw-semibold mb-2">{title}</div>

        {days.map((ymd) => (
          <div key={ymd} className="mb-2">
            <div className="text-dim small mb-1">{ymd}</div>

            {(groups[ymd] || []).map((s) => {
              const full = s.max_attendance > 0 && s.current_attendance >= s.max_attendance;
              const startStr = s.start_time ? new Date(s.start_time).toLocaleString() : "TBC";

              return (
                <section
                  key={s.id}
                  className="futuristic-card p-3 mb-2"
                  style={neonCardStyle({
                    border: `1px solid ${IA.borderSoft}`,
                    boxShadow: IA.glowSoft,
                  })}
                >
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div style={{ minWidth: 0 }}>
                      <div className="fw-semibold">
                        {s.class_id || "Class"} {s.gym_name ? `• ${s.gym_name}` : ""}
                      </div>

                      <div className="text-dim small">
                        {startStr} {s.coach_name ? `• Coach: ${s.coach_name}` : ""}
                      </div>

                      <div className="text-dim small mt-1">
                        Seats: {s.current_attendance}/{s.max_attendance || "∞"}
                        {isGymMember ? " • Members book free" : ""}
                        {isCashPayer ? " • Cash members £8 pay on arrival" : ""}
                      </div>
                    </div>

                    <div className="d-flex flex-column gap-2">
                      <button
                        className="btn btn-sm"
                        style={neonPrimaryStyle({
                          borderRadius: 14,
                          paddingLeft: 14,
                          paddingRight: 14,
                          opacity: full ? 0.6 : 1,
                        })}
                        disabled={full || bookingBusy === s.id}
                        onClick={() => book(s.id, false)}
                      >
                        {full ? "Full" : bookingBusy === s.id ? "…" : "Book"}
                      </button>

                      {!isGymMember && (
                        <button
                          className="btn btn-sm"
                          style={neonButtonStyle({ borderRadius: 14 })}
                          disabled={full || bookingBusy === s.id}
                          onClick={() => book(s.id, true)}
                        >
                          Pay on day
                        </button>
                      )}
                    </div>
                  </div>
                </section>
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

  return (
    <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
      {/* Header row styled like Today's workout */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="text-dim small" style={{ letterSpacing: 0.9, display: "flex", alignItems: "center", gap: 8 }}>
          <i className="fas fa-calendar-alt" style={{ color: IA.neon, filter: `drop-shadow(0 0 8px ${IA.neon}66)` }} />
          CLASSES
        </div>

        <span
          className="badge"
          style={{
            background: `rgba(24,255,154,0.12)`,
            color: IA.neon,
            border: `1px solid ${IA.borderSoft}`,
          }}
        >
          This week + next
        </span>
      </div>

      {msg && (
        <div
          className="mb-2"
          style={{
            borderRadius: 999,
            padding: "8px 12px",
            background: `rgba(24,255,154,0.14)`,
            color: IA.neon,
            border: `1px solid ${IA.borderSoft}`,
            boxShadow: IA.glowSoft,
            fontWeight: 800,
            fontSize: ".85rem",
          }}
        >
          {msg}
        </div>
      )}

      {err && <div className="alert alert-danger mb-2">{err}</div>}

      {emptyAll ? (
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
