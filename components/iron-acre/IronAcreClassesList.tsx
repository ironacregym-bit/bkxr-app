// components/iron-acre/IronAcreClassesList.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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

type PaymentMethod = "stripe" | "pay_on_day" | "member_free";

type IronAcreClassesListProps = {
  isAuthed: boolean;
  authedEmail?: string | null;
  gyms: Gym[];
  profile: UserAccess | null;
  sessions: SessionItem[];
  bookedSessionIds: string[];
  onJoinGym?: (gymId: string) => Promise<void>;
  onBook?: (sessionId: string, paymentMethod: PaymentMethod) => Promise<void>;
};

const MAX_VISIBLE_SESSIONS = 6;

function renderStartStr(startTime: string | null) {
  if (!startTime) return "TBC";

  const d = new Date(startTime);
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

function toMillis(v?: string | null) {
  if (!v) return 0;
  const d = new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

export default function IronAcreClassesList({
  isAuthed,
  gyms,
  profile,
  sessions,
  bookedSessionIds,
  onJoinGym,
}: IronAcreClassesListProps) {
  const userGymId = String(profile?.gym_id || "").trim();
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

  const [joinBusy, setJoinBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const bookedSet = useMemo(() => {
    return new Set<string>(bookedSessionIds || []);
  }, [bookedSessionIds]);

  const upcomingSessions = useMemo(() => {
    const now = Date.now();

    return (sessions || [])
      .filter((s) => {
        const ms = toMillis(s.start_time);
        return ms > 0 && ms >= now;
      })
      .sort((a, b) => toMillis(a.start_time) - toMillis(b.start_time))
      .slice(0, MAX_VISIBLE_SESSIONS);
  }, [sessions]);

  async function handleJoinGym() {
    if (!joinableGym?.id || !onJoinGym) return;

    setErr(null);
    setMsg(null);
    setJoinBusy(true);

    try {
      await onJoinGym(joinableGym.id);
      setMsg(`You are now linked to ${joinableGym.name}.`);
    } catch (e: any) {
      setErr(e?.message || "Failed to join gym");
    } finally {
      setJoinBusy(false);
    }
  }

  const hasGym = Boolean(userGymId);

  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
        <div className="ia-kicker">
          <i className="fas fa-calendar-alt" />
          CLASSES
        </div>

        <Link href="/schedule" className="ia-btn ia-btn-outline">
          View schedule
        </Link>
      </div>

      {msg ? (
        <div className="ia-badge ia-badge-neon mb-2" style={{ width: "100%", justifyContent: "flex-start" }}>
          {msg}
        </div>
      ) : null}

      {err ? (
        <div className="text-dim small mb-2" style={{ color: "#ffb3b3" }}>
          {err}
        </div>
      ) : null}

      {!isAuthed ? (
        <div className="text-dim small">Sign in to view your gym classes and book sessions.</div>
      ) : !hasGym ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          <div className="ia-tile-title">Join a gym to receive classes</div>

          <div className="text-dim small mt-1">
            Link your account to {joinableGym?.name || "the gym"} to view the timetable and receive gym notifications.
          </div>

          <div className="mt-2">
            <button
              type="button"
              className="ia-btn ia-btn-primary"
              onClick={handleJoinGym}
              disabled={joinBusy || !joinableGym?.id || !onJoinGym}
            >
              {joinBusy ? "Joining…" : `Join ${joinableGym?.name || "gym"}`}
            </button>
          </div>
        </div>
      ) : upcomingSessions.length === 0 ? (
        <div className="text-dim small">No upcoming classes scheduled.</div>
      ) : (
        <>
          <div className="d-flex flex-column">
            {upcomingSessions.map((session, idx) => {
              const full =
                session.max_attendance > 0 && session.current_attendance >= session.max_attendance;
              const alreadyBooked = bookedSet.has(session.id);

              return (
                <div
                  key={session.id}
                  style={{
                    paddingTop: idx === 0 ? 0 : 10,
                    paddingBottom: 10,
                    borderTop: idx === 0 ? "none" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div style={{ minWidth: 0 }}>
                      <div className="ia-tile-title">
                        {session.class_id || "Class"}
                        {session.gym_name ? ` • ${session.gym_name}` : ""}
                      </div>

                      <div className="text-dim small mt-1">
                        {renderStartStr(session.start_time)}
                        {session.coach_name ? ` • Coach: ${session.coach_name}` : ""}
                      </div>

                      <div className="text-dim small mt-1">
                        Seats: {session.current_attendance}/{session.max_attendance || "∞"}
                      </div>
                    </div>

                    <div style={{ flex: "0 0 auto" }}>
                      {alreadyBooked ? (
                        <span className="ia-badge ia-badge-neon">Booked</span>
                      ) : full ? (
                        <span className="ia-badge">Full</span>
                      ) : (
                        <span className="ia-badge">Available</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {sessions.length > upcomingSessions.length ? (
            <div className="text-dim small mt-2">
              Showing next {upcomingSessions.length} sessions.
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
