
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import { toMillis } from "../lib/time";

// generic fetcher
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
  start_time: string | number | null; // ISO string from API or millis
  end_time: string | number | null;   // ISO string from API or millis
  price: number;
  max_attendance: number;
  current_attendance: number;
  gym_name: string;
  location: string;
};

export default function SchedulePage() {
  const { data: session } = useSession();

  // Gym selection
  const { data: gymsResp, error: gymsError } = useSWR("/api/gyms/list", fetcher);
  const gyms: Gym[] = gymsResp?.gyms ?? [];
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);

  // Month selection
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0..11

  // Derive selected gym details
  const selectedGym = useMemo(
    () => gyms.find((g) => g.id === selectedGymId) || null,
    [gyms, selectedGymId]
  );

  // Month boundaries
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

  // Sessions for the selected month and gym location
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

  // Group sessions by YYYY-MM-DD
  const sessionsByDay = useMemo(() => {
    const map: Record<string, SessionItem[]> = {};
    for (const s of sessions) {
      const ms = toMillis(s.start_time);
      if (!ms) continue;
      const d = new Date(ms);
      const key = d.toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [sessions]);

  // Calendar cells (with leading blanks)
  const firstWeekday = monthStart.getDay(); // 0 Sunday .. 6 Saturday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellKeys = useMemo(() => {
    const blanks = Array.from({ length: firstWeekday }, (_, i) => `blank-${i}`);
    const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
    return [...blanks, ...days];
  }, [firstWeekday, daysInMonth]);

  // Day selection (opens the session list)
  const [activeDay, setActiveDay] = useState<string | null>(null); // "YYYY-MM-DD"
  useEffect(() => {
    // reset active day when month/gym changes
    setActiveDay(null);
  }, [year, month, selectedGymId]);

  // Booking state
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [sharing, setSharing] = useState<{ message: string; link: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null); // session id being processed

  async function bookSession(session_id: string) {
    try {
      setPending(session_id);
      setActionErr(null);
      setActionMsg(null);
      // Require sign-in
      if (!session?.user?.email) {
        await signIn("google");
        setPending(null);
        return;
      }
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create booking");
      setActionMsg("Booking confirmed ✅");
    } catch (e: any) {
      setActionErr(e?.message || "Failed to create booking");
    } finally {
      setPending(null);
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

  // initial gym selection (first in list)
  useEffect(() => {
    if (!selectedGymId && gyms.length > 0) {
      setSelectedGymId(gyms[0].id);
    }
  }, [gyms, selectedGymId]);

  return (
    <>
      <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff" }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <button className="btn btn-bxkr-outline" onClick={prevMonth}>← Previous</button>
          <h2 className="mb-0" style={{ fontWeight: 700 }}>Schedule — {monthLabel}</h2>
          <button className="btn btn-bxkr-outline" onClick={nextMonth}>Next →</button>
        </div>

        {/* Gym selector */}
        <div className="bxkr-card p-3 mb-3">
          <label className="form-label">Select gym</label>
          {gymsError && <div className="text-danger">Failed to load gyms.</div>}
          <select
            className="form-select"
            value={selectedGymId ?? ""}
            onChange={(e) => setSelectedGymId(e.target.value || null)}
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
        <div className="bxkr-card p-3 mb-3">
          <div className="row row-cols-7 g-2 text-center mb-2">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="col text-dim">{d}</div>
            ))}
          </div>
          <div className="row row-cols-7 g-2">
            {cellKeys.map((key, idx) => {
              if (key.startsWith("blank-")) {
                return <div key={key} className="col" />;
              }
              const dayNum = Number(key);
              const date = new Date(year, month, dayNum);
              const ymd = date.toISOString().slice(0, 10);
              const daySessions = sessionsByDay[ymd] || [];
              const isToday =
                date.toDateString() === new Date().toDateString();

              return (
                <div key={key} className="col">
                  <button
                    className="btn w-100"
                    style={{
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.05)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.08)",
                      boxShadow: isToday ? "0 0 10px rgba(255,127,50,0.6)" : "none",
                    }}
                    onClick={() => setActiveDay(ymd)}
                  >
                    <div className="fw-bold">{dayNum}</div>
                    <div className="small text-dim">
                      {daySessions.length > 0 ? `${daySessions.length} session${daySessions.length > 1 ? "s" : ""}` : "—"}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        {activeDay && (
          <div className="bxkr-card p-3 mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="mb-0">Sessions on {activeDay}</h5>
              <button className="btn btn-bxkr-outline" onClick={() => setActiveDay(null)}>Close</button>
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

              return (
                <div key={s.id} className="bxkr-card p-3 mb-2">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="me-2">
                      <div className="fw-bold">{s.class_id} — {s.gym_name}</div>
                      <div className="small text-dim">
                        Coach: {s.coach_name || "TBC"} • {startStr}{endStr ? ` — ${endStr}` : ""}
                      </div>
                      <div className="small">
                        Price: £{(s.price ?? 0).toFixed(2)} • Capacity: {s.current_attendance}/{s.max_attendance || "∞"}
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-bxkr"
                        onClick={() => bookSession(s.id)}
                        disabled={full || pending === s.id}
                        title={full ? "Session is full" : "Book"}
                      >
                        {pending === s.id ? "Booking…" : full ? "Full" : "Book"}
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
                </div>
              );
            })}

            {/* Action feedback */}
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
                          // open WhatsApp with message prefilled
                          const url = `https://wa.me/?text=${encodeURIComponent(sharing.message)}`;
                          window.open(url, "_blank");
                        }}
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
      </main>

      <BottomNav />
    </>
   );
}
