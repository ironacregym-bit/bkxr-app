// pages/admin/sessions/index.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../../../components/BottomNav";

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
  drop_in_price?: number | null;
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
  drop_in_price?: number | null;
  max_attendance: number;
  current_attendance: number;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  notify_members?: boolean;
  cancelled?: boolean;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
};

type SessionOptionsResponse = {
  gyms: { id: string; name: string; location?: string | null }[];
  classes: { id: string; name: string }[];
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

function toDateInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toTimeInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isPastSession(value?: string | null) {
  if (!value) return false;
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function money(value?: number | null) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2).replace(/\.00$/, "") : "0";
}

function priceSummary(prebook?: number | null, dropIn?: number | null) {
  const pre = money(prebook);
  const drop = money(dropIn ?? 12);
  return `£${pre} prebook • £${drop} drop-in`;
}

export default function AdminSessionsPage() {
  const { data: authSession, status } = useSession();
  const role = (authSession?.user as any)?.role || "user";

  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [timing, setTiming] = useState<"upcoming" | "past" | "all">("upcoming");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileViewing, setMobileViewing] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [formClassId, setFormClassId] = useState("");
  const [formGymId, setFormGymId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");
  const [formCoachName, setFormCoachName] = useState("");
  const [formPrice, setFormPrice] = useState("9");
  const [formDropInPrice, setFormDropInPrice] = useState("12");
  const [formMaxAttendance, setFormMaxAttendance] = useState("1");
  const [formNotifyMembers, setFormNotifyMembers] = useState(false);

  useEffect(() => setMounted(true), []);

  const isAllowed = !!authSession && (role === "admin" || role === "gym");

  const listKey = useMemo(() => {
    if (!mounted || status === "loading" || !isAllowed) return null;

    const qs = new URLSearchParams();
    if (query.trim()) qs.set("q", query.trim());
    if (timing) qs.set("timing", timing);
    qs.set("limit", "200");

    return `/api/admin/sessions/list?${qs.toString()}`;
  }, [mounted, status, isAllowed, query, timing]);

  const { data: listData, mutate: mutateList } = useSWR<SessionListResp>(listKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const items = Array.isArray(listData?.items) ? listData.items : [];

  const detailKey = useMemo(() => {
    if (!mounted || status === "loading" || !isAllowed || !selectedId) return null;
    return `/api/admin/sessions/${encodeURIComponent(selectedId)}`;
  }, [mounted, status, isAllowed, selectedId]);

  const { data: selectedData, mutate: mutateSelected } = useSWR<SessionDetail>(detailKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
  });

  const optionsKey = useMemo(() => {
    if (!mounted || status === "loading" || !isAllowed) return null;
    return "/api/admin/classes/session-options";
  }, [mounted, status, isAllowed]);

  const { data: optionsData } = useSWR<SessionOptionsResponse>(optionsKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const gymOptions = Array.isArray(optionsData?.gyms) ? optionsData.gyms : [];
  const classOptions = Array.isArray(optionsData?.classes) ? optionsData.classes : [];

  const selected = selectedData || null;
  const selectedIsPast = useMemo(() => isPastSession(selected?.start_time), [selected?.start_time]);

  useEffect(() => {
    if (!selected) {
      setEditMode(false);
      return;
    }

    setFormClassId(selected.class_id || "");
    setFormGymId(selected.gym_id || "");
    setFormDate(toDateInput(selected.start_time));
    setFormStartTime(toTimeInput(selected.start_time));
    setFormEndTime(toTimeInput(selected.end_time));
    setFormCoachName(selected.coach_name || "");
    setFormPrice(String(selected.price ?? 9));
    setFormDropInPrice(String(selected.drop_in_price ?? 12));
    setFormMaxAttendance(String(selected.max_attendance ?? 1));
    setFormNotifyMembers(Boolean(selected.notify_members));
    setSaveMsg(null);
    setSaveErr(null);
    setEditMode(false);
  }, [selected?.id, selected]);

  function resetFormFromSelected() {
    if (!selected) return;

    setFormClassId(selected.class_id || "");
    setFormGymId(selected.gym_id || "");
    setFormDate(toDateInput(selected.start_time));
    setFormStartTime(toTimeInput(selected.start_time));
    setFormEndTime(toTimeInput(selected.end_time));
    setFormCoachName(selected.coach_name || "");
    setFormPrice(String(selected.price ?? 9));
    setFormDropInPrice(String(selected.drop_in_price ?? 12));
    setFormMaxAttendance(String(selected.max_attendance ?? 1));
    setFormNotifyMembers(Boolean(selected.notify_members));
    setSaveErr(null);
    setSaveMsg(null);
  }

  async function handleSave() {
    if (!selectedId) return;

    setSaving(true);
    setSaveErr(null);
    setSaveMsg(null);

    try {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: formClassId,
          gym_id: formGymId,
          date: formDate,
          start_time_hhmm: formStartTime,
          end_time_hhmm: formEndTime,
          coach_name: formCoachName,
          price: Number(formPrice || 0),
          drop_in_price: Number(formDropInPrice || 0),
          max_attendance: Number(formMaxAttendance || 0),
          notify_members: formNotifyMembers,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to update session"));
      }

      await Promise.all([mutateSelected(), mutateList()]);
      setEditMode(false);
      setSaveMsg("Session updated ✅");
    } catch (err: any) {
      setSaveErr(String(err?.message || err || "Failed to update session"));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelOrDelete() {
    if (!selectedId || !selected) return;

    const hasBookings = Number(selected.current_attendance || 0) > 0;
    const ok = window.confirm(
      hasBookings
        ? "This session has attendees. It will be marked as cancelled instead of fully deleted. Continue?"
        : "Delete this session? This cannot be undone."
    );

    if (!ok) return;

    setCancelling(true);
    setSaveErr(null);
    setSaveMsg(null);

    try {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(selectedId)}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to cancel session"));
      }

      setSaveMsg(hasBookings ? "Session cancelled ✅" : "Session deleted ✅");
      setEditMode(false);
      setSelectedId(null);
      setMobileViewing(false);

      await Promise.all([
        mutateSelected(undefined, { revalidate: false }),
        mutateList(),
      ]);
    } catch (err: any) {
      setSaveErr(String(err?.message || err || "Failed to cancel session"));
    } finally {
      setCancelling(false);
    }
  }

  if (!mounted || status === "loading") {
    return (
      <>
        <Head>
          <title>Sessions • Admin</title>
        </Head>

        <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
          Checking access…
        </main>

        <BottomNav />
      </>
    );
  }

  if (!isAllowed) {
    return (
      <>
        <Head>
          <title>Sessions • Admin</title>
        </Head>

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
        </main>

        <BottomNav />
      </>
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
              <div className="ia-page-subtitle">
                Manage one-off and future recurring timetable sessions.
              </div>
            </div>
          </div>

          <div className="d-none d-md-flex gap-2">
            <Link href="/admin/classes/create-session" className="ia-btn">
              + Create session
            </Link>

            <Link href="/admin/sessions/recurring" className="ia-btn ia-btn-outline">
              Recurring sessions
            </Link>
          </div>
        </div>

        <div className="d-flex d-md-none gap-2 mb-3">
          <Link href="/admin/classes/create-session" className="ia-btn">
            + Create session
          </Link>

          <Link href="/admin/sessions/recurring" className="ia-btn ia-btn-outline">
            Recurring
          </Link>
        </div>

        {(saveMsg || saveErr) && (
          <div className={`mb-3 alert ${saveErr ? "alert-danger" : "alert-success"}`} role="alert">
            {saveErr || saveMsg}
          </div>
        )}

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
                              Seats: {item.current_attendance}/{item.max_attendance || "∞"} •{" "}
                              {priceSummary(item.price, item.drop_in_price)}
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

                <div className="d-flex align-items-center gap-2">
                  {selected && !editMode ? (
                    <button
                      type="button"
                      className="ia-btn ia-btn-outline"
                      onClick={() => {
                        resetFormFromSelected();
                        setEditMode(true);
                      }}
                    >
                      Edit
                    </button>
                  ) : null}

                  <div className="d-md-none">
                    <button
                      type="button"
                      className="btn btn-outline-light btn-sm"
                      onClick={() => setMobileViewing(false)}
                    >
                      <i className="fas fa-chevron-left me-2" />
                      Back to list
                    </button>
                  </div>
                </div>
              </div>

              {!selected ? (
                <div className="text-dim">Pick a session from the list to view details and actions.</div>
              ) : editMode ? (
                <>
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Class</label>
                      <select
                        className="form-select"
                        value={formClassId}
                        onChange={(e) => setFormClassId(e.target.value)}
                      >
                        <option value="">Select class</option>
                        {classOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Gym</label>
                      <select
                        className="form-select"
                        value={formGymId}
                        onChange={(e) => setFormGymId(e.target.value)}
                      >
                        <option value="">Select gym</option>
                        {gymOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                            {item.location ? ` • ${item.location}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label">Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                      />
                    </div>

                    <div className="col-6 col-md-4">
                      <label className="form-label">Start time</label>
                      <input
                        type="time"
                        className="form-control"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                      />
                    </div>

                    <div className="col-6 col-md-4">
                      <label className="form-label">End time</label>
                      <input
                        type="time"
                        className="form-control"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Coach name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formCoachName}
                        onChange={(e) => setFormCoachName(e.target.value)}
                        placeholder="Optional coach name"
                      />
                    </div>

                    <div className="col-6 col-md-3">
                      <label className="form-label">Prebook price (£)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control"
                        value={formPrice}
                        onChange={(e) => setFormPrice(e.target.value)}
                      />
                    </div>

                    <div className="col-6 col-md-3">
                      <label className="form-label">Drop-in price (£)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control"
                        value={formDropInPrice}
                        onChange={(e) => setFormDropInPrice(e.target.value)}
                      />
                    </div>

                    <div className="col-6 col-md-3">
                      <label className="form-label">Max attendance</label>
                      <input
                        type="number"
                        min={Math.max(1, Number(selected.current_attendance || 0))}
                        step="1"
                        className="form-control"
                        value={formMaxAttendance}
                        onChange={(e) => setFormMaxAttendance(e.target.value)}
                      />
                    </div>

                    <div className="col-12">
                      <label
                        className="d-flex align-items-center gap-2"
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        <input
                          type="checkbox"
                          checked={formNotifyMembers}
                          onChange={(e) => setFormNotifyMembers(e.target.checked)}
                        />
                        <span>Notify members for this session</span>
                      </label>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mt-4">
                    <button type="button" className="ia-btn" onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save changes"}
                    </button>

                    <button
                      type="button"
                      className="ia-btn ia-btn-outline"
                      onClick={() => {
                        resetFormFromSelected();
                        setEditMode(false);
                      }}
                      disabled={saving}
                    >
                      Cancel edit
                    </button>

                    <button
                      type="button"
                      className="ia-btn ia-btn-outline"
                      onClick={handleCancelOrDelete}
                      disabled={saving || cancelling}
                      title={
                        Number(selected.current_attendance || 0) > 0
                          ? "This will mark the session as cancelled"
                          : "This will delete the session"
                      }
                    >
                      {cancelling
                        ? "Working..."
                        : Number(selected.current_attendance || 0) > 0
                        ? "Cancel session"
                        : "Delete session"}
                    </button>
                  </div>

                  <div className="small text-dim mt-3">
                    Current booked count: <span className="text-light">{selected.current_attendance}</span>
                  </div>
                </>
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
                      <div className="text-dim small">Prebook price</div>
                      <div className="fw-semibold">£{money(selected.price)}</div>
                    </div>

                    <div className="col-6 col-md-4">
                      <div className="text-dim small">Drop-in price</div>
                      <div className="fw-semibold">£{money(selected.drop_in_price ?? 12)}</div>
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

                    <div className="col-12 col-md-6">
                      <div className="text-dim small">Cancelled</div>
                      <div className="fw-semibold">
                        {selected.cancelled ? `Yes • ${formatDateTime(selected.cancelled_at)}` : "No"}
                      </div>
                    </div>

                    {selected.cancelled_by ? (
                      <div className="col-12 col-md-6">
                        <div className="text-dim small">Cancelled by</div>
                        <div className="fw-semibold text-break">{selected.cancelled_by}</div>
                      </div>
                    ) : null}
                  </div>

                  <div className="d-flex flex-wrap gap-2 mt-4">
                    <Link href="/admin/classes/create-session" className="ia-btn">
                      Create another session
                    </Link>

                    <button
                      type="button"
                      className="ia-btn ia-btn-outline"
                      onClick={() => {
                        resetFormFromSelected();
                        setEditMode(true);
                      }}
                    >
                      Edit session
                    </button>

                    <button
                      type="button"
                      className="ia-btn ia-btn-outline"
                      onClick={handleCancelOrDelete}
                      disabled={cancelling}
                      title={
                        Number(selected.current_attendance || 0) > 0
                          ? "This will mark the session as cancelled"
                          : "This will delete the session"
                      }
                    >
                      {cancelling
                        ? "Working..."
                        : Number(selected.current_attendance || 0) > 0
                        ? "Cancel session"
                        : "Delete session"}
                    </button>

                    <Link href="/admin/sessions/recurring" className="ia-btn ia-btn-outline">
                      Recurring sessions
                    </Link>

                    <button
                      type="button"
                      className="ia-btn ia-btn-outline"
                      disabled={selectedIsPast || !!selected.cancelled}
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
