// pages/admin/sessions/recurring.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import BottomNav from "../../../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type GymOption = {
  id: string;
  name: string;
  location?: string | null;
};

type ClassOption = {
  id: string;
  name: string;
};

type SessionOptionsResponse = {
  gyms: GymOption[];
  classes: ClassOption[];
};

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

function toMoneyInput(value: string) {
  return value.replace(/[^\d.]/g, "");
}

function toIntInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formatDateRange(start: string, end: string) {
  if (!start || !end) return "";
  return `${start} → ${end}`;
}

function countOccurrences(startDate: string, endDate: string, weekdays: number[]) {
  if (!startDate || !endDate || weekdays.length === 0) return 0;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  let count = 0;
  const d = new Date(start);

  while (d <= end) {
    if (weekdays.includes(d.getDay())) {
      count++;
    }
    d.setDate(d.getDate() + 1);
  }

  return count;
}

export default function RecurringSessionsAdminPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";

  const { data, error: optionsError } = useSWR<SessionOptionsResponse>(
    "/api/admin/classes/session-options",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const gyms = useMemo(() => (Array.isArray(data?.gyms) ? data!.gyms : []), [data?.gyms]);
  const classes = useMemo(() => (Array.isArray(data?.classes) ? data!.classes : []), [data?.classes]);

  const [classId, setClassId] = useState("");
  const [gymId, setGymId] = useState("");
  const [coachName, setCoachName] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [price, setPrice] = useState("8");
  const [maxAttendance, setMaxAttendance] = useState("12");
  const [notifyMembers, setNotifyMembers] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const selectedGym = useMemo(() => gyms.find((g) => g.id === gymId) || null, [gyms, gymId]);
  const selectedClass = useMemo(() => classes.find((c) => c.id === classId) || null, [classes, classId]);

  const totalOccurrences = useMemo(
    () => countOccurrences(startDate, endDate, weekdays),
    [startDate, endDate, weekdays]
  );

  const weekdayLabel = useMemo(() => {
    if (!weekdays.length) return "No days selected";
    return WEEKDAY_OPTIONS.filter((d) => weekdays.includes(d.value))
      .map((d) => d.label)
      .join(", ");
  }, [weekdays]);

  function toggleWeekday(day: number) {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((x) => x !== day) : [...prev, day].sort((a, b) => a - b)
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitMsg(null);

    if (!classId) {
      setSubmitError("Please select a class.");
      return;
    }

    if (!gymId) {
      setSubmitError("Please select a gym.");
      return;
    }

    if (!startDate || !endDate) {
      setSubmitError("Please set a start and end date.");
      return;
    }

    if (!startTime || !endTime) {
      setSubmitError("Please set a start and end time.");
      return;
    }

    if (weekdays.length === 0) {
      setSubmitError("Please choose at least one weekday.");
      return;
    }

    if (totalOccurrences < 1) {
      setSubmitError("No sessions would be created with the current date range and weekday selection.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch("/api/admin/sessions/recurring-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: classId,
          gym_id: gymId,
          coach_name: coachName.trim(),
          weekdays,
          start_date: startDate,
          end_date: endDate,
          start_time_hhmm: startTime,
          end_time_hhmm: endTime,
          price: Number(price || 0),
          max_attendance: Number(maxAttendance || 0),
          notify_members: notifyMembers,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to create recurring sessions"));
      }

      setSubmitMsg(`Created ${Number(json?.created || 0)} sessions ✅`);
    } catch (err: any) {
      setSubmitError(String(err?.message || err || "Failed to create recurring sessions"));
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
        Checking access…
      </main>
    );
  }

  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <>
        <Head>
          <title>Recurring Sessions • Admin</title>
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
        <title>Recurring Sessions • Admin</title>
      </Head>

      <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
        <div className="mb-3 d-flex flex-wrap gap-2">
          <Link href="/admin/sessions" className="ia-btn ia-btn-outline">
            ← Back to sessions
          </Link>

          <Link href="/admin/classes/create-session" className="ia-btn ia-btn-outline">
            Single session
          </Link>
        </div>

        <div className="ia-page-title">Recurring sessions</div>
        <div className="ia-page-subtitle">
          Build your weekly timetable in bulk by choosing the weekday pattern, date range and class details.
        </div>

        <div className="mt-3 ia-tile ia-tile-pad">
          {optionsError ? (
            <div className="text-danger">Failed to load gyms/classes.</div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label">Class</label>
                  <select
                    className="form-select"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    required
                  >
                    <option value="">Select a class</option>
                    {classes.map((item) => (
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
                    value={gymId}
                    onChange={(e) => setGymId(e.target.value)}
                    required
                  >
                    <option value="">Select a gym</option>
                    {gyms.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.location ? ` • ${item.location}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Coach name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={coachName}
                    onChange={(e) => setCoachName(e.target.value)}
                    placeholder="Optional coach name"
                  />
                </div>

                <div className="col-6 col-md-3">
                  <label className="form-label">Price (£)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control"
                    value={price}
                    onChange={(e) => setPrice(toMoneyInput(e.target.value))}
                    required
                  />
                </div>

                <div className="col-6 col-md-3">
                  <label className="form-label">Max attendance</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-control"
                    value={maxAttendance}
                    onChange={(e) => setMaxAttendance(toIntInput(e.target.value))}
                    required
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Weekdays</label>
                  <div className="d-flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((day) => {
                      const active = weekdays.includes(day.value);

                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleWeekday(day.value)}
                          className={active ? "ia-btn" : "ia-btn ia-btn-outline"}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Start date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">End date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>

                <div className="col-6 col-md-6">
                  <label className="form-label">Start time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>

                <div className="col-6 col-md-6">
                  <label className="form-label">End time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>

                <div className="col-12">
                  <label
                    className="d-flex align-items-center gap-2"
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <input
                      type="checkbox"
                      checked={notifyMembers}
                      onChange={(e) => setNotifyMembers(e.target.checked)}
                    />
                    <span>Notify gym members after creating these sessions</span>
                  </label>
                </div>
              </div>

              <div
                className="mt-4"
                style={{
                  borderRadius: 18,
                  padding: 16,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="text-dim small mb-2"
                  style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
                >
                  Preview
                </div>

                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                  {selectedClass?.name || "Class not selected"}
                </div>

                <div className="text-dim mt-1">
                  {selectedGym?.name || "Gym not selected"}
                  {selectedGym?.location ? ` • ${selectedGym.location}` : ""}
                </div>

                <div className="text-dim mt-1">{weekdayLabel}</div>
                <div className="text-dim mt-1">{formatDateRange(startDate, endDate) || "No date range set"}</div>
                <div className="text-dim mt-1">
                  {startTime || "--:--"} to {endTime || "--:--"}
                </div>
                <div className="text-dim mt-1">
                  £{price || "0"} • Max {maxAttendance || "0"} attendees
                </div>
                {coachName.trim() ? <div className="text-dim mt-1">Coach: {coachName.trim()}</div> : null}

                <div className="mt-3">
                  <span className="ia-badge ia-badge-neon">{totalOccurrences} sessions will be created</span>
                </div>
              </div>

              {submitError ? <div className="mt-3 text-danger">{submitError}</div> : null}
              {submitMsg ? <div className="mt-3 text-success">{submitMsg}</div> : null}

              <div className="mt-4 d-flex gap-2 flex-wrap">
                <button type="submit" className="ia-btn" disabled={submitting}>
                  {submitting ? "Creating…" : "Create recurring sessions"}
                </button>

                <Link href="/admin/sessions" className="ia-btn ia-btn-outline">
                  Cancel
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>

      <BottomNav />
    </>
  );
}
