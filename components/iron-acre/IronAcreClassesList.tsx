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

  const bookedSet = useMemo(() => new Set<string>(bookedSessionIds || []), [bookedSessionIds]);

  const bookedSessions = useMemo(() => {
    return (sessions || [])
      .filter((session) => bookedSet.has(session.id))
      .sort((a, b) => toMillis(a.start_time) - toMillis(b.start_time));
  }, [sessions, bookedSet]);

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
      <div className="ia-section-header mb-2">
        <div className="ia-kicker">
          <i className="fas fa-calendar-alt" />
          CLASSES
        </div>

        <Link href="/schedule" className="ia-btn ia-btn-outline ia-task-link-btn">
          View all
        </Link>
      </div>

      {msg ? <div className="ia-inline-note-success mb-2">{msg}</div> : null}
      {err ? <div className="ia-inline-note-error mb-2">{err}</div> : null}

      {!isAuthed ? (
        <div className="text-dim small">Sign in to view your booked classes.</div>
      ) : !hasGym ? (
        <div className="ia-join-panel">
          <div className="ia-tile-title">Join a gym to see your classes</div>

          <div className="text-dim small mt-1">
            Link your account to {joinableGym?.name || "the gym"} to see your booked sessions and the timetable.
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
      ) : bookedSessions.length === 0 ? (
        <div className="text-dim small">No booked classes yet.</div>
      ) : (
        <div className="ia-class-list">
          {bookedSessions.map((session) => (
            <div key={session.id} className="ia-class-item">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div style={{ minWidth: 0 }}>
                  <div className="ia-class-item-title">
                    {session.class_id || "Class"}
                    {session.gym_name ? ` • ${session.gym_name}` : ""}
                  </div>

                  <div className="ia-class-item-meta mt-1">
                    {renderStartStr(session.start_time)}
                    {session.coach_name ? ` • Coach: ${session.coach_name}` : ""}
                  </div>

                  <div className="ia-class-item-meta mt-1">
                    Seats: {session.current_attendance}/{session.max_attendance || "∞"}
                  </div>
                </div>

                <div className="ia-class-item-status">
                  <span className="ia-badge ia-badge-neon">Booked</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
