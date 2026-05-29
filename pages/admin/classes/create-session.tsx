// pages/admin/classes/create-session.tsx
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
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

type CreateSessionResponse = {
  ok: true;
  sessionId: string;
};

function toMoneyInput(value: string) {
  return value.replace(/[^\d.]/g, "");
}

function toIntInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

export default function CreateSessionAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

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
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [coachName, setCoachName] = useState("");
  const [price, setPrice] = useState("8");
  const [maxAttendance, setMaxAttendance] = useState("12");
  const [notifyMembers, setNotifyMembers] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!gymId && gyms.length === 1) {
      setGymId(gyms[0].id);
    }
  }, [gyms, gymId]);

  useEffect(() => {
    if (!classId && classes.length === 1) {
      setClassId(classes[0].id);
    }
  }, [classes, classId]);

  const selectedGym = useMemo(() => gyms.find((g) => g.id === gymId) || null, [gyms, gymId]);
  const selectedClass = useMemo(() => classes.find((c) => c.id === classId) || null, [classes, classId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    try {
      setSubmitting(true);

      const res = await fetch("/api/admin/classes/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: classId,
          gym_id: gymId,
          date,
          start_time_hhmm: startTime,
          end_time_hhmm: endTime,
          coach_name: coachName.trim(),
          price: Number(price || 0),
          max_attendance: Number(maxAttendance || 0),
          notify_members: notifyMembers,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to create session"));
      }

      const payload = json as CreateSessionResponse;
      await router.push(`/admin?createdSession=${encodeURIComponent(payload.sessionId)}`);
    } catch (err: any) {
      setSubmitError(String(err?.message || err || "Failed to create session"));
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="container py-4 text-white">
        <div className="ia-tile ia-tile-pad">
          <div className="text-dim">Checking access…</div>
        </div>
      </div>
    );
  }

  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4 text-white">
        <div className="ia-tile ia-tile-pad">
          <div className="ia-page-title">Access denied</div>
          <div className="ia-page-subtitle">You do not have permission to view this page.</div>
          <div className="mt-3">
            <Link href="/admin" className="ia-btn ia-btn-outline">
              Back to admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Create Session • Admin</title>
      </Head>

      <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
        <div className="mb-3">
          <Link href="/admin" className="ia-btn ia-btn-outline">
            ← Back to admin
          </Link>
        </div>

        <div className="ia-page-title">Create session</div>
        <div className="ia-page-subtitle">
          Create a one-off Iron Acre class session. Once this is working cleanly, we can add recurring timetable generation next.
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

                <div className="col-12 col-md-4">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label">Start time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label">End time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
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
                  <label
                    className="d-flex align-items-center gap-2"
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <input
                      type="checkbox"
                      checked={notifyMembers}
                      onChange={(e) => setNotifyMembers(e.target.checked)}
                    />
                    <span>Notify members after creating this session</span>
                  </label>
                  <div className="text-dim small mt-1">
                    This is captured now so we can wire the actual in-app + push notification send next.
                  </div>
                </div>
              </div>

              {(selectedClass || selectedGym || date || startTime || endTime) && (
                <div
                  className="mt-4"
                  style={{
                    borderRadius: 18,
                    padding: 16,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="text-dim small mb-2" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Preview
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                    {selectedClass?.name || "Class not selected"}
                  </div>
                  <div className="text-dim mt-1">
                    {selectedGym?.name || "Gym not selected"}
                    {selectedGym?.location ? ` • ${selectedGym.location}` : ""}
                  </div>
                  <div className="text-dim mt-1">
                    {date || "No date"} • {startTime || "--:--"} to {endTime || "--:--"}
                  </div>
                  <div className="text-dim mt-1">
                    £{price || "0"} • Max {maxAttendance || "0"} attendees
                  </div>
                  {coachName.trim() ? <div className="text-dim mt-1">Coach: {coachName.trim()}</div> : null}
                </div>
              )}

              {submitError ? (
                <div className="mt-3 text-danger">{submitError}</div>
              ) : null}

              <div className="mt-4 d-flex gap-2 flex-wrap">
                <button type="submit" className="ia-btn" disabled={submitting}>
                  {submitting ? "Creating…" : "Create session"}
                </button>

                <Link href="/admin" className="ia-btn ia-btn-outline">
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
``
