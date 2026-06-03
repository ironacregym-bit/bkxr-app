// pages/admin/programs/create.tsx
import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import BottomNav from "../../../components/BottomNav";

type WorkoutListItem = {
  workout_id: string;
  workout_name?: string;
};

type WorkoutsListResp = {
  workouts?: WorkoutListItem[];
};

type ProgramScheduleItem = {
  workout_id: string;
  day_of_week: number | null;
  order: number;
};

type WeekOverrides = {
  [workout_id: string]: {
    weeks: {
      [week: number]: {
        percent_1rm?: number | null;
      };
    };
  };
};

type ProgramCreatePayload = {
  name: string;
  weeks: number;
  schedule: ProgramScheduleItem[];
  week_overrides: WeekOverrides;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const DAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

function dayLabel(day: number | null) {
  const match = DAY_OPTIONS.find((d) => d.value === day);
  return match ? match.label : "—";
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(json?.error || "Request failed");
  return json as T;
}

export default function CreateProgramPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";

  const [name, setName] = useState("");
  const [weeks, setWeeks] = useState(12);
  const [creating, setCreating] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [schedule, setSchedule] = useState<ProgramScheduleItem[]>([]);
  const [weekOverrides, setWeekOverrides] = useState<WeekOverrides>({});

  const [selectedWorkoutId, setSelectedWorkoutId] = useState("");
  const [selectedDay, setSelectedDay] = useState<number | null>(1);
  const [selectedOrder, setSelectedOrder] = useState(1);
  const [workoutSearch, setWorkoutSearch] = useState("");

  const canAccess = !!session && (role === "admin" || role === "gym");

  const { data: workoutsResp, isLoading: workoutsLoading } = useSWR<WorkoutsListResp>(
    canAccess ? "/api/workouts/admin/list" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  const workouts = Array.isArray(workoutsResp?.workouts) ? workoutsResp.workouts : [];

  const filteredWorkouts = useMemo(() => {
    const q = workoutSearch.trim().toLowerCase();
    if (!q) return workouts;
    return workouts.filter((w) =>
      String(w?.workout_name || w?.workout_id || "")
        .toLowerCase()
        .includes(q)
    );
  }, [workouts, workoutSearch]);

  const workoutNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workouts) {
      if (w?.workout_id) {
        m.set(w.workout_id, w.workout_name || w.workout_id);
      }
    }
    return m;
  }, [workouts]);

  const sortedSchedule = useMemo(() => {
    return [...schedule].sort((a, b) => {
      const da = a.day_of_week ?? 99;
      const db = b.day_of_week ?? 99;
      if (da !== db) return da - db;
      return a.order - b.order;
    });
  }, [schedule]);

  const scheduleWorkoutIds = useMemo(() => {
    return Array.from(new Set(schedule.map((s) => s.workout_id).filter(Boolean)));
  }, [schedule]);

  function addScheduleRow() {
    if (!selectedWorkoutId) return;

    setSchedule((prev) => [
      ...prev,
      {
        workout_id: selectedWorkoutId,
        day_of_week: selectedDay,
        order: Number.isFinite(selectedOrder) ? Math.max(0, Math.trunc(selectedOrder)) : 0,
      },
    ]);

    setSelectedWorkoutId("");
    setSelectedOrder(1);
  }

  function removeScheduleRow(index: number) {
    setSchedule((prev) => prev.filter((_, i) => i !== index));
  }

  function updateOverride(workoutId: string, week: number, percent: string) {
    const parsed =
      percent.trim() === "" ? null : Number.isFinite(Number(percent)) ? Number(percent) : null;

    setWeekOverrides((prev) => {
      const current = { ...(prev || {}) };
      const workoutEntry = {
        ...(current[workoutId] || {}),
        weeks: {
          ...((current[workoutId] && current[workoutId].weeks) || {}),
        },
      };

      workoutEntry.weeks[week] = {
        ...(workoutEntry.weeks[week] || {}),
        percent_1rm: parsed,
      };

      current[workoutId] = workoutEntry;
      return current;
    });
  }

  async function createProgram() {
    try {
      setCreating(true);
      setSaveErr(null);
      setSaveMsg(null);

      const payload: ProgramCreatePayload = {
        name: name.trim(),
        weeks,
        schedule,
        week_overrides: weekOverrides,
      };

      const res = await postJson<{ ok?: boolean; program_id?: string }>("/api/programs/create", payload);

      setSaveMsg(`Program created ✅${res?.program_id ? ` (${res.program_id})` : ""}`);
      setName("");
      setWeeks(12);
      setSchedule([]);
      setWeekOverrides({});
      setWorkoutSearch("");
      setSelectedWorkoutId("");
      setSelectedDay(1);
      setSelectedOrder(1);
    } catch (e: any) {
      setSaveErr(e?.message || "Failed to create program");
    } finally {
      setCreating(false);
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

  if (!canAccess) {
    return (
      <div className="container py-4 text-white">
        <div className="ia-tile ia-tile-pad">
          <div className="ia-page-title">Access denied</div>
          <div className="text-dim">You do not have permission to view this page.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Create Training Program • Admin</title>
      </Head>

      <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <div className="ia-page-title">Create training program</div>
            <div className="ia-page-subtitle text-dim">
              Build a reusable program template, attach workouts, and add optional weekly % overrides.
            </div>
          </div>

          <div className="d-flex gap-2">
            <Link href="/admin/programs" className="ia-btn ia-btn-outline">
              ← Programs
            </Link>
          </div>
        </div>

        {saveMsg ? (
          <div className="alert alert-success" role="alert">
            {saveMsg}
          </div>
        ) : null}

        {saveErr ? (
          <div className="alert alert-danger" role="alert">
            {saveErr}
          </div>
        ) : null}

        <div className="row g-3">
          <div className="col-12 col-xl-5">
            <div className="ia-tile ia-tile-pad">
              <div className="ia-kicker">Program details</div>

              <div className="mt-3">
                <label className="form-label">Program name</label>
                <input
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Farm Strength – 12 Week Block"
                />
              </div>

              <div className="mt-3">
                <label className="form-label">Weeks</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  className="form-control"
                  value={weeks}
                  onChange={(e) => setWeeks(Number(e.target.value) || 12)}
                />
              </div>

              <div className="mt-4">
                <div className="fw-semibold mb-2">Create program</div>
                <div className="small text-dim mb-3">
                  Programs are templates only. User assignment happens later from the member page
                  with a chosen start date.
                </div>

                <button
                  type="button"
                  className="ia-btn"
                  disabled={creating || !name.trim() || weeks < 1}
                  onClick={createProgram}
                >
                  {creating ? "Creating…" : "Create program"}
                </button>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-7">
            <div className="ia-tile ia-tile-pad">
              <div className="ia-kicker">Schedule builder</div>

              <div className="mt-3">
                <label className="form-label">Search workouts</label>
                <input
                  className="form-control"
                  placeholder="Search workouts…"
                  value={workoutSearch}
                  onChange={(e) => setWorkoutSearch(e.target.value)}
                />
              </div>

              <div className="row g-2 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label">Workout</label>
                  <select
                    className="form-select"
                    value={selectedWorkoutId}
                    onChange={(e) => setSelectedWorkoutId(e.target.value)}
                    disabled={workoutsLoading}
                  >
                    <option value="">{workoutsLoading ? "Loading workouts…" : "Select workout"}</option>
                    {filteredWorkouts.map((w) => (
                      <option key={w.workout_id} value={w.workout_id}>
                        {w.workout_name || w.workout_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6 col-md-3">
                  <label className="form-label">Day</label>
                  <select
                    className="form-select"
                    value={selectedDay ?? ""}
                    onChange={(e) => setSelectedDay(e.target.value === "" ? null : Number(e.target.value))}
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6 col-md-3">
                  <label className="form-label">Order</label>
                  <input
                    type="number"
                    min={0}
                    className="form-control"
                    value={selectedOrder}
                    onChange={(e) => setSelectedOrder(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="mt-3 d-flex justify-content-end">
                <button
                  type="button"
                  className="ia-btn ia-btn-outline"
                  onClick={addScheduleRow}
                  disabled={!selectedWorkoutId}
                >
                  Add to schedule
                </button>
              </div>

              <div className="mt-4">
                <div className="fw-semibold mb-2">Scheduled workouts</div>

                {sortedSchedule.length === 0 ? (
                  <div className="text-dim small">No workouts added yet.</div>
                ) : (
                  <div className="d-grid gap-2">
                    {sortedSchedule.map((item, idx) => (
                      <div
                        key={`${item.workout_id}-${item.day_of_week}-${item.order}-${idx}`}
                        className="p-3"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 14,
                        }}
                      >
                        <div className="d-flex align-items-start justify-content-between gap-2">
                          <div>
                            <div className="fw-semibold">
                              {workoutNameById.get(item.workout_id) || item.workout_id}
                            </div>
                            <div className="small text-dim">
                              {dayLabel(item.day_of_week)} • Order {item.order}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-light"
                            onClick={() => removeScheduleRow(idx)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="ia-tile ia-tile-pad">
              <div className="ia-kicker">Progression overrides</div>
              <div className="small text-dim mt-2">
                Optional. Set per-week % 1RM values for workouts already included in this program.
              </div>

              {!scheduleWorkoutIds.length ? (
                <div className="text-dim small mt-3">
                  Add workouts to the schedule first to configure progression overrides.
                </div>
              ) : (
                <div className="d-grid gap-3 mt-3">
                  {scheduleWorkoutIds.map((workoutId) => (
                    <div
                      key={workoutId}
                      className="p-3"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 14,
                      }}
                    >
                      <div className="fw-semibold mb-2">
                        {workoutNameById.get(workoutId) || workoutId}
                      </div>

                      <div className="row g-2">
                        {Array.from({ length: weeks }, (_, i) => i + 1).map((week) => {
                          const current =
                            weekOverrides?.[workoutId]?.weeks?.[week]?.percent_1rm ?? "";

                          return (
                            <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={`${workoutId}-${week}`}>
                              <label className="form-label small">Week {week}</label>
                              <input
                                type="number"
                                step="0.1"
                                className="form-control form-control-sm"
                                value={current === null ? "" : String(current)}
                                onChange={(e) => updateOverride(workoutId, week, e.target.value)}
                                placeholder="%"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="col-12">
            <div className="ia-tile ia-tile-pad">
              <div className="ia-kicker">Review</div>

              <div className="row g-2 mt-2">
                <div className="col-12 col-md-6">
                  <div className="small text-dim">Program name</div>
                  <div className="fw-semibold">{name.trim() || "—"}</div>
                </div>

                <div className="col-12 col-md-3">
                  <div className="small text-dim">Weeks</div>
                  <div className="fw-semibold">{weeks}</div>
                </div>

                <div className="col-12 col-md-3">
                  <div className="small text-dim">Scheduled workouts</div>
                  <div className="fw-semibold">{sortedSchedule.length}</div>
                </div>
              </div>

              <div className="mt-3 d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ia-btn"
                  disabled={creating || !name.trim() || weeks < 1}
                  onClick={createProgram}
                >
                  {creating ? "Creating…" : "Create program"}
                </button>

                <Link href="/admin/programs" className="ia-btn ia-btn-outline">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
