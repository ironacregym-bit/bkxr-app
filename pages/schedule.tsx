
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession, signIn } from "next-auth/react";
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

export default function SchedulePage() {
  const { data: authSession } = useSession();

  // Gyms
  const { data: gymsResp, error: gymsError } = useSWR("/api/gyms/list", fetcher);
  const gyms: Gym[] = gymsResp?.gyms ?? [];
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const selectedGym = useMemo(
    () => gyms.find((g) => g.id === selectedGymId) || null,
    [gyms, selectedGymId]
  );

  // Month navigation
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

  // Sessions for selected gym/location in month range
  const fromISO = monthStart.toISOString();
  const toISO = monthEnd.toISOString();
  const shouldLoadSessions = Boolean(selectedGym?.location);
  const {
    data: sessionsResp,
    error: sessionsError,
    isLoading: sessionsLoading,
  } = useSWR(
    shouldLoadSessions
      ? `/api/schedule/upcoming?location=${encodeURIComponent(
          selectedGym!.location
        )}&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`
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
      (map[key] ??= []).push(s);
    }
    return map;
  }, [sessions]);

  // Calendar cells (include leading blanks)
  const firstWeekday = monthStart.getDay(); // 0 Sun .. 6 Sat
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

  // Day panel
  const [activeDay, setActiveDay] = useState<string | null>(null);
  useEffect(() => {
    setActiveDay(null);
  }, [year, month, selectedGymId]);

  // Actions
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [sharing, setSharing] = useState<{ message: string; link: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null); // session id being processed

  async function bookSession(session_id: string) {
    try {
      setPending(session_id);
      setActionErr(null);
      setActionMsg(null);
      if (!authSession?.user?.email) {
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

  // Select first gym automatically
  useEffect(() => {
    if (!selectedGymId && gyms.length > 0) {
      setSelectedGymId(gyms[0].id);
    }
  }, [gyms, selectedGymId]);

  return (
    <>
      <main className="container py-3 schedule-page" style={{ paddingBottom: "90px", color: "#fff" }}>
        {/* Toolbar */}
        <div className="schedule-toolbar">
          <button className="btn btn-bxkr-outline" onClick={prevMonth} aria-label="Previous month">← Previous</button>
          <h2 className="mb-0 month-title">Schedule — {monthLabel}</h2>
          <button className="btn btn-bxkr-outline" onClick={nextMonth} aria-label="Next month">Next →</button>
        </div>

        {/* Gym selector */}
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
              <option key={g.id} value={g.id}>{g.name} — {g.location}</option>
            ))}
          </select>
        </div>

        {/* Calendar */}
        <div className="schedule-calendar mb-3" role="grid" aria-label={`Calendar for ${monthLabel}`}>
          <div className="calendar-weekdays">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="weekday">{d}</div>
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
          <div className="bxkr-card p-3 day-panel">
            <div className="panel-header">
              <h5 className="mb-0 title">Sessions on {activeDay}</h5>
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
              const pct = s.max_attendance > 0
                ? Math.min(100, Math.round((s.current_attendance / s.max_attendance) * 100))
                : 0;

              return (
                <div key={s.id} className="session-card">
                  <div className="session-info">
                    <div className="name">{s.class_id} — {s.gym_name}</div>
                    <div className="sub">Coach: {s.coach_name || "TBC"} • {startStr}{endStr ? ` — ${endStr}` : ""}</div>
                    <div className="session-meta">
                      <span className="chip">£{(s.price ?? 0).toFixed(2)}</span>
                      <span className="chip capacity">
                        <span>{s.current_attendance}/{s.max_attendance || "∞"}</span>
                        <span className="bar"><span style={{ width: `${pct}%` }} /></span>
                      </span>
                    </div>
                  </div>
                  <div className="session-actions">
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
