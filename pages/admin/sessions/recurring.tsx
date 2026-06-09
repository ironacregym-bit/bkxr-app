// pages/admin/sessions/recurring.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../../../components/BottomNav";

type RecurringTimetableItem = {
  id: string;
  active: boolean;
  class_id: string | null;
  class_name: string;
  gym_id: string | null;
  gym_name: string;
  coach_name?: string | null;
  weekdays: number[];
  start_time_hhmm: string;
  end_time_hhmm: string;
  price: number;
  drop_in_price: number;
  max_attendance: number;
  notify_members: boolean;
  effective_from: string | null;
  effective_to: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
};

type RecurringListResponse = {
  items: RecurringTimetableItem[];
};

type SessionOptionsResponse = {
  gyms: { id: string; name: string; location?: string | null }[];
  classes: { id: string; name: string }[];
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

function weekdayLabel(days: number[]) {
  if (!days.length) return "—";
  const map = new Map(WEEKDAY_OPTIONS.map((x) => [x.value, x.label]));
  return [...days]
    .sort((a, b) => {
      const normA = a === 0 ? 7 : a;
      const normB = b === 0 ? 7 : b;
      return normA - normB;
    })
    .map((d) => map.get(d) || String(d))
    .join(", ");
}

function priceSummary(item: RecurringTimetableItem) {
  const pre = Number(item.price || 0);
  const drop = Number(item.drop_in_price || 0);
  return `£${pre} prebook • £${drop} drop-in`;
}

function effectiveSummary(item: RecurringTimetableItem) {
  if (item.effective_from && item.effective_to) {
    return `${item.effective_from} → ${item.effective_to}`;
  }
  if (item.effective_from) {
    return `From ${item.effective_from}`;
  }
  if (item.effective_to) {
    return `Until ${item.effective_to}`;
  }
  return "Always active";
}

export default function AdminRecurringSessionsPage() {
  const { data: authSession, status } = useSession();
  const role = (authSession?.user as any)?.role || "user";

  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileViewing, setMobileViewing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [formActive, setFormActive] = useState(true);
  const [formClassId, setFormClassId] = useState("");
  const [formGymId, setFormGymId] = useState("");
  const [formCoachName, setFormCoachName] = useState("");
  const [formWeekdays, setFormWeekdays] = useState<number[]>([]);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formPrice, setFormPrice] = useState("9");
  const [formDropInPrice, setFormDropInPrice] = useState("12");
  const [formMaxAttendance, setFormMaxAttendance] = useState("12");
  const [formNotifyMembers, setFormNotifyMembers] = useState(false);
  const [formEffectiveFrom, setFormEffectiveFrom] = useState("");
  const [formEffectiveTo, setFormEffectiveTo] = useState("");

  useEffect(() => setMounted(true), []);

  const isAllowed = !!authSession && (role === "admin" || role === "gym");

  const listKey = useMemo(() => {
    if (!mounted || status === "loading" || !isAllowed) return null;
    return "/api/admin/sessions/recurring-timetables";
  }, [mounted, status, isAllowed]);

  const { data: listData, mutate: mutateList } = useSWR<RecurringListResponse>(listKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const items = Array.isArray(listData?.items) ? listData.items : [];

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

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

  useEffect(() => {
    if (selected) {
      setFormActive(selected.active);
      setFormClassId(selected.class_id || "");
      setFormGymId(selected.gym_id || "");
      setFormCoachName(selected.coach_name || "");
      setFormWeekdays(Array.isArray(selected.weekdays) ? selected.weekdays : []);
      setFormStartTime(selected.start_time_hhmm || "09:00");
      setFormEndTime(selected.end_time_hhmm || "10:00");
      setFormPrice(String(selected.price ?? 9));
      setFormDropInPrice(String(selected.drop_in_price ?? 12));
      setFormMaxAttendance(String(selected.max_attendance ?? 12));
      setFormNotifyMembers(Boolean(selected.notify_members));
      setFormEffectiveFrom(selected.effective_from || "");
      setFormEffectiveTo(selected.effective_to || "");
    } else {
      setFormActive(true);
      setFormClassId("");
      setFormGymId("");
      setFormCoachName("");
      setFormWeekdays([]);
      setFormStartTime("09:00");
      setFormEndTime("10:00");
      setFormPrice("9");
      setFormDropInPrice("12");
      setFormMaxAttendance("12");
      setFormNotifyMembers(false);
      setFormEffectiveFrom("");
      setFormEffectiveTo("");
    }

    setSaveMsg(null);
    setSaveErr(null);
  }, [selectedId, selected]);

  function toggleWeekday(day: number) {
    setFormWeekdays((prev) =>
      prev.includes(day)
        ? prev.filter((x) => x !== day)
        : [...prev, day].sort((a, b) => {
            const normA = a === 0 ? 7 : a;
            const normB = b === 0 ? 7 : b;
            return normA - normB;
          })
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveErr(null);
    setSaveMsg(null);

    try {
      const payload = {
        active: formActive,
        class_id: formClassId,
        gym_id: formGymId,
        coach_name: formCoachName,
        weekdays: formWeekdays,
        start_time_hhmm: formStartTime,
        end_time_hhmm: formEndTime,
        price: Number(formPrice || 0),
        drop_in_price: Number(formDropInPrice || 0),
        max_attendance: Number(formMaxAttendance || 0),
        notify_members: formNotifyMembers,
        effective_from: formEffectiveFrom || null,
        effective_to: formEffectiveTo || null,
      };

      const isEdit = Boolean(selectedId);
      const url = isEdit
        ? `/api/admin/sessions/recurring-timetables/${encodeURIComponent(selectedId as string)}`
        : "/api/admin/sessions/recurring-timetables";

      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to save recurring timetable"));
      }

      await mutateList();

      if (!isEdit && json?.id) {
        setSelectedId(String(json.id));
      }

      setSaveMsg(isEdit ? "Recurring timetable updated ✅" : "Recurring timetable created ✅");
    } catch (err: any) {
      setSaveErr(String(err?.message || err || "Failed to save recurring timetable"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) return;

    const ok = window.confirm("Delete this recurring timetable entry?");
    if (!ok) return;

    setDeleting(true);
    setSaveErr(null);
    setSaveMsg(null);

    try {
      const res = await fetch(
        `/api/admin/sessions/recurring-timetables/${encodeURIComponent(selectedId)}`,
        { method: "DELETE" }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to delete recurring timetable"));
      }

      setSelectedId(null);
      setMobileViewing(false);
      await mutateList();
      setSaveMsg("Recurring timetable deleted ✅");
    } catch (err: any) {
      setSaveErr(String(err?.message || err || "Failed to delete recurring timetable"));
    } finally {
      setDeleting(false);
    }
  }

  if (!mounted || status === "loading") {
    return (
      <>
        <Head>
          <title>Recurring timetable • Admin</title>
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
          <title>Recurring timetable • Admin</title>
        </Head>

        <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
          <div className="ia-tile ia-tile-pad">
            <div className="ia-page-title">Access denied</div>
            <div className="ia-page-subtitle">You do not have permission to view this page.</div>
            <div className="mt-3">
              /admin
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
        <title>Recurring timetable • Admin</title>
      </Head>

      <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="d-flex align-items-center gap-2">
            <Link href="/admin/sessions">
              ← Sessions
            </Link>

            <div>
              <div className="ia-page-title" style={{ marginBottom: 0 }}>
                Recurring timetable
              </div>
              <div className="ia-page-subtitle">
                Build the weekly timetable template that will generate future sessions.
              </div>
            </div>
          </div>

          <div className="d-none d-md-flex gap-2">
            <button
              type="button"
              className="ia-btn"
              onClick={() => {
                setSelectedId(null);
                setMobileViewing(true);
              }}
            >
              + New timetable row
            </button>
          </div>
        </div>

        <div className="d-flex d-md-none gap-2 mb-3">
          <button
            type="button"
            className="ia-btn"
            onClick={() => {
              setSelectedId(null);
              setMobileViewing(true);
            }}
          >
            + New row
          </button>
        </div>

        {(saveMsg || saveErr) ? (
          <div className={`mb-3 alert ${saveErr ? "alert-danger" : "alert-success"}`} role="alert">
            {saveErr || saveMsg}
          </div>
        ) : null}

        <div className="row gx-3">
          <div className={`col-12 col-md-5 ${mobileViewing ? "d-none d-md-block" : ""}`}>
            <div className="ia-tile ia-tile-pad">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="fw-semibold">Timetable rows</div>

                <button
                  type="button"
                  className="ia-btn ia-btn-outline"
                  onClick={() => {
                    setSelectedId(null);
                    setMobileViewing(true);
                  }}
                >
                  New
                </button>
              </div>

              <div style={{ maxHeight: 620, overflowY: "auto", paddingRight: 4 }}>
                {!items.length ? (
                  <div className="text-dim">No recurring timetable rows yet.</div>
                ) : (
                  <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
                    {items.map((item) => {
                      const active = selectedId === item.id;

                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="w-100 text-start"
                            onClick={() => {
                              setSelectedId(item.id);
                              setMobileViewing(true);
                            }}
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
                              <div className="fw-semibold text-truncate">
                                {item.class_name}
                              </div>

                              <span
                                className="badge"
                                style={{
                                  background: item.active ? "#24FFA0" : "rgba(255,255,255,0.14)",
                                  color: item.active ? "#08120d" : "#fff",
                                  border: "none",
                                }}
                              >
                                {item.active ? "Active" : "Inactive"}
                              </span>
                            </div>

                            <div className="small text-dim mt-1">
                              {item.gym_name}
                              {item.coach_name ? ` • Coach: ${item.coach_name}` : ""}
                            </div>

                            <div className="small text-dim">
                              {weekdayLabel(item.weekdays)} • {item.start_time_hhmm}-{item.end_time_hhmm}
                            </div>

                            <div className="small text-dim mt-1">
                              {priceSummary(item)}
                            </div>

                            <div className="small text-dim">
                              {effectiveSummary(item)}
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
                  {selected ? selected.class_name : "New recurring timetable row"}
                </div>

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

              <div className="row g-3">
                <div className="col-12">
                  <label
                    className="d-flex align-items-center gap-2"
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                    />
                    <span>Active</span>
                  </label>
                </div>

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

                <div className="col-12">
                  <label className="form-label d-block">Weekdays</label>
                  <div className="d-flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((day) => {
                      const selectedDay = formWeekdays.includes(day.value);

                      return (
                        <button
                          key={day.value}
                          type="button"
                          className={selectedDay ? "ia-btn" : "ia-btn ia-btn-outline"}
                          onClick={() => toggleWeekday(day.value)}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="col-6 col-md-6">
                  <label className="form-label">Start time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                  />
                </div>

                <div className="col-6 col-md-6">
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

                <div className="col-6 col-md-4">
                  <label className="form-label">Max attendance</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="form-control"
                    value={formMaxAttendance}
                    onChange={(e) => setFormMaxAttendance(e.target.value)}
                  />
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label">Effective from</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formEffectiveFrom}
                    onChange={(e) => setFormEffectiveFrom(e.target.value)}
                  />
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label">Effective to</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formEffectiveTo}
                    onChange={(e) => setFormEffectiveTo(e.target.value)}
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
                    <span>Notify members when generated</span>
                  </label>
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2 mt-4">
                <button type="button" className="ia-btn" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : selectedId ? "Save changes" : "Create row"}
                </button>

                {selectedId ? (
                  <button
                    type="button"
                    className="ia-btn ia-btn-outline"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                ) : null}

                {!selectedId ? (
                  <button
                    type="button"
                    className="ia-btn ia-btn-outline"
                    onClick={() => {
                      setSelectedId(null);
                      setMobileViewing(false);
                    }}
                  >
                    Back to list
                  </button>
                ) : null}
              </div>

              <div className="small text-dim mt-3">
                {selected
                  ? `Repeats on ${weekdayLabel(selected.weekdays)} • ${selected.start_time_hhmm}-${selected.end_time_hhmm}`
                  : "Create reusable timetable rows here, then we will wire the weekly session generator next."}
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
