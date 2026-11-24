// pages/admin/sessions/index.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../../components/BottomNav";

type SessionRow = {
  id: string;
  class_id: string | null;
  class_name: string;
  gym_id: string | null;
  gym_name: string;
  coach_name?: string | null;
  start_time: string | null;
  end_time: string | null;
  price: number;
  max_attendance: number;
  current_attendance: number;
};

type SessionListResp = {
  items: SessionRow[];
};

type SessionDetail = {
  id: string;
  class_id: string | null;
  class_name: string;
  gym_id: string | null;
  gym_name: string;
  coach_name?: string | null;
  start_time: string | null;
  end_time: string | null;
  price: number;
  max_attendance: number;
  current_attendance: number;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  notify_members?: boolean;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#24FFA0";

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";

  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isPastSession(value?: string | null) {
  if (!value) return false;
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

export default function AdminSessionsPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";

  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [timing, setTiming] = useState<"upcoming" | "past" | "all">("upcoming");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileViewing, setMobileViewing] = useState(false);

  useEffect(() => setMounted(true), []);

  const isAllowed = !!session && (role === "admin" || role === "gym");

  const listKey = useMemo(() => {
    if (!mounted || status === "loading" || !isAllowed) return null;

    const qs = new URLSearchParams();
    if (query.trim()) qs.set("q", query.trim());
    if (timing) qs.set("timing", timing);
    qs.set("limit", "200");

    return `/api/admin/sessions/list?${qs.toString()}`;
  }, [mounted, status, isAllowed, query, timing]);

  const { data: listData } = useSWR<SessionListResp>(listKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const items = Array.isArray(listData?.items) ? listData!.items : [];

  const detailKey = useMemo(() => {
    if (!mounted || status === "loading" || !isAllowed || !selectedId) return null;
    return `/api/admin/sessions/${encodeURIComponent(selectedId)}`;
  }, [mounted, status, isAllowed, selectedId]);

  const { data: selectedData } = useSWR<SessionDetail>(detailKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
  });

  const selected = selectedData || null;

  const selectedIsPast = useMemo(() => isPastSession(selected?.start_time), [selected?.start_time]);

  if (!mounted || status === "loading") {
    return (
      <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
        Checking access…
      </main>
    );
  }

  if (!isAllowed) {
    return (
      <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
        <div className="ia-tile ia-tile-pad">
          <div className="ia-page-title">Access denied</div>
          <div className="ia-page-subtitle">You do not have permission to view this page.</div>
          <div className="mt-3">
            <Link href="/admin" className="ia-btn ia-btn-outline">
              Back to admin
            </Link>
          </div>
        </div>

        <BottomNav />
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>Sessions • Admin</title>
      </Head>

      <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="d-flex align-items-center gap-2">
            <Link href="/admin" className="ia-btn ia-btn-outline">
              ← Admin
            </Link>

            <div>
              <div className="ia-page-title" style={{ marginBottom: 0 }}>
                Sessions
              </div>
              <div className="ia-page-subtitle">Manage one-off and recurring gym timetable sessions.</div>
            </div>
          </div>

          <div className="d-none d-md-flex gap-2">
            <Link href="/admin/classes/create-session" className="ia-btn">
              + Create session
            </Link>

            <button type="button" className="ia-btn ia-btn-outline" disabled title="Coming next">
              Recurring sessions
            </button>
          </div>
        </div>

        <div className="d-flex d-md-none gap-2 mb-3">
          <Link href="/admin/classes/create-session" className="ia-btn">
            + Create session
          </Link>

          <button type="button" className="ia-btn ia-btn-outline" disabled title="Coming next">
            Recurring
          </button>
        </div>

        <div className="row gx-3">
          <div className={`col-12 col-md-5 ${mobileViewing ? "d-none d-md-block" : ""}`}>
            <div className="ia-tile ia-tile-pad">
              <div className="d-flex gap-2 mb-2">
                <input
                  className="form-control"
                  placeholder="Search class, gym or coach…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />

                <button type="button" className="btn btn-outline-light" onClick={() => setQuery("")}>
                  <i className="fas fa-times" />
                </button>
              </div>

              <div className="d-flex gap-2 mb-3">
                <select
                  className="form-select"
                  value={timing}
                  onChange={(e) => setTiming(e.target.value as "upcoming" | "past" | "all")}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                  <option value="all">All</option>
                </select>
              </div>

              <div style={{ maxHeight: 560, overflowY: "auto", paddingRight: 4 }}>
                {!items.length ? (
                  <div className="text-dim">No sessions found.</div>
                ) : (
                  <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
                    {items.map((item) => {
                      const active = selectedId === item.id;
                      const past = isPastSession(item.start_time);

                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(item.id);
                              setMobileViewing(true);
                            }}
                            className="w-100 text-start"
                            style={{
                              border: "1px solid rgba(255,255,255,0.12)",
                              background: active ? "rgba(36,255,160,0.10)" : "rgba(255,255,255,0.04)",
                              color: "#fff",
                              borderRadius: 12,
                              padding: "12px 12px",
                              marginBottom: 8,
                            }}
                          >
                            <div className="d-flex align-items-center justify-content-between gap-2">
                              <div className="fw-semibold text-truncate">{item.class_name}</div>

                              <span
                                className="badge"
                                style={{
                                  background: past ? "rgba(255,255,255,0.14)" : ACCENT,
                                  color: past ? "#fff" : "#08120d",
                                  border: "none",
                                }}
                              >
                                {past ? "Past" : "Upcoming"}
                              </span>
                            </div>

                            <div className="small text-dim mt-1">
                              {item.gym_name} {item.coach_name ? `• Coach: ${item.coach_name}` : ""}
                            </div>

                            <div className="small text-dim">{formatDateTime(item.start_time)}</div>

                            <div className="small text-dim mt-1">
                              Seats: {item.current_attendance}/{item.max_attendance || "∞"} • £{item.price}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className={`col-12 col-md-7 ${mobileViewing ? "" : "d-none d-md-block"}`}>
            <div className="ia-tile ia-tile-pad">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="fw-semibold" style={{ fontSize: "1.05rem" }}>
                  {selected ? selected.class_name : "Select a session"}
                </div>

                <div className="d-md-none">
                  <button type="button" className="btn btn-outline-light btn-sm" onClick={() => setMobileViewing(false)}>
                    <i className="fas fa-chevron-left me-2" />
                    Back to list
                  </button>
                </div>
              </div>

              {!selected ? (
                <div className="text-dim">Pick a session from the list to view details and actions.</div>
              ) : (
                <>
                  <div className="row g-2">
                    <div className="col-12 col-md-6">
                      <div className="text-dim small">Class</div>
                      <div className="fw-semibold">{selected.class_name}</div>
                    </div>

                    <div className="col-12 col-md-6">
                      <div className="text-dim small">Gym</div>
                      <div className="fw-semibold">{selected.gym_name}</div>
                    </div>

                    <div className="col-12 col-md-6">
                      <div className="text-dim small">Start</div>
                      <div className="fw-semibold">{formatDateTime(selected.start_time)}</div>
                    </div>

                    <div className="col-12 col-md-6">
                      <div className="text-dim small">End</div>
                      <div className="fw-semibold">{formatDateTime(selected.end_time)}</div>
                    </div>

                    <div className="col-6 col-md-4">
                      <div className="text-dim small">Coach</div>
                      <div className="fw-semibold">{selected.coach_name || "—"}</div>
                    </div>

                    <div className="col-6 col-md-4">
                      <div className="text-dim small">Price</div>
                      <div className="fw-semibold">£{selected.price}</div>
                    </div>

                    <div className="col-6 col-md-4">
                      <div className="text-dim small">Attendance</div>
                      <div className="fw-semibold">
                        {selected.current_attendance}/{selected.max_attendance || "∞"}
                      </div>
                    </div>

                    <div className="col-6 col-md-4">
                      <div className="text-dim small">Notify members</div>
                      <div className="fw-semibold">{selected.notify_members ? "Yes" : "No"}</div>
                    </div>

                    <div className="col-12 col-md-4">
                      <div className="text-dim small">Created by</div>
                      <div className="fw-semibold text-break">{selected.created_by || "—"}</div>
                    </div>

                    <div className="col-12 col-md-4">
                      <div className="text-dim small">Created</div>
                      <div className="fw-semibold">{formatDateTime(selected.created_at)}</div>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mt-4">
                    <Link href="/admin/classes/create-session" className="ia-btn">
                      Create another session
                    </Link>

                    <button
                      type="button"
                      className="ia-btn ia-btn-outline"
                      disabled
                      title="Edit session coming next"
                    >
                      Edit session
                    </button>

                    <button
                      type="button"
                      className="ia-btn ia-btn-outline"
                      disabled
                      title="Recurring sessions coming next"
                    >
                      Make recurring
                    </button>

                    <button
                      type="button"
                      className="ia-btn ia-btn-outline"
                      disabled={selectedIsPast}
                      title="Bookings view coming next"
                    >
                      View bookings
                    </button>
                  </div>

                  <div className="small text-dim mt-3">
                    Session ID: <span className="text-light">{selected.id}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
