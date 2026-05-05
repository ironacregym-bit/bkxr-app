// File: pages/admin/programs/index.tsx
import Head from "next/head;
import Link from next/link";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type ProgramListItem = {
  program_id: string;
  name?: string;
  start_date?: string | Date | null;
  weeks?: number;
};

type WorkoutListItem = {
  workout_id: string;
  workout_name?: string;
};

type ScheduleRow = {
  schedule_id: string;
  workout_id: string;
  day_of_week: string | number | null;
  order: number;
};

type ProgramsListResp = {
  programs?: ProgramListItem[];
};

type WorkoutsListResp = {
  workouts?: WorkoutListItem[];
};

type ScheduleResp = {
  ok?: boolean;
  program_id?: string;
  schedule?: ScheduleRow[];
};

type AddScheduleBody = {
  workout_id: string;
  day_of_week: number | null;
  order: number;
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

function safeDateLabel(v: unknown): string {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function dayLabel(day: string | number | null): string {
  if (day === null || day === undefined) return "—";
  const n = typeof day === "number" ? day : Number(day);
  if (!Number.isFinite(n)) return String(day);
  const match = DAY_OPTIONS.find((x) => x.value === n);
  return match ? match.label : String(day);
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

export default function AdminProgramsPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const isSignedIn = !!session?.user?.email;
  const canAccess = isSignedIn && (role === "admin" || role === "gym");

  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [programSearch, setProgramSearch] = useState<string>("");
  const [workoutSearch, setWorkoutSearch] = useState<string>("");

  const [addWorkoutId, setAddWorkoutId] = useState<string>("");
  const [addDay, setAddDay] = useState<number | null>(1);
  const [addOrder, setAddOrder] = useState<number>(1);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: programsResp, error: programsErr, isLoading: programsLoading } = useSWR<ProgramsListResp>(
    canAccess ? "/api/programs/admin/list" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: workoutsResp, error: workoutsErr, isLoading: workoutsLoading } = useSWR<WorkoutsListResp>(
    canAccess ? "/api/workouts/admin/list" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const programs = Array.isArray(programsResp?.programs) ? programsResp!.programs! : [];
  const workouts = Array.isArray(workoutsResp?.workouts) ? workoutsResp!.workouts! : [];

  const selectedProgram = useMemo(() => {
    return programs.find((p) => p.program_id === selectedProgramId) || null;
  }, [programs, selectedProgramId]);

  const scheduleKey = selectedProgramId ? `/api/programs/admin/${encodeURIComponent(selectedProgramId)}/schedule` : null;
  const {
    data: scheduleResp,
    error: scheduleErr,
    isLoading: scheduleLoading,
    mutate: mutateSchedule,
  } = useSWR<ScheduleResp>(canAccess ? scheduleKey : null, fetcher, { revalidateOnFocus: false });

  const schedule = Array.isArray(scheduleResp?.schedule) ? scheduleResp!.schedule! : [];

  const workoutNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workouts) {
      if (!w?.workout_id) continue;
      m.set(w.workout_id, String(w.workout_name || "Untitled workout"));
    }
    return m;
  }, [workouts]);

  const filteredPrograms = useMemo(() => {
    const q = programSearch.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter((p) => String(p?.name || "").toLowerCase().includes(q));
  }, [programs, programSearch]);

  const filteredWorkouts = useMemo(() => {
    const q = workoutSearch.trim().toLowerCase();
    if (!q) return workouts;
    return workouts.filter((w) => String(w?.workout_name || "").toLowerCase().includes(q));
  }, [workouts, workoutSearch]);

  async function addWorkoutToProgram() {
    if (!selectedProgramId) return;
    if (!addWorkoutId) return;

    try {
      setSaving(true);
      setSaveError(null);

      const url = `/api/programs/admin/${encodeURIComponent(selectedProgramId)}/schedule`;
      const payload: AddScheduleBody = {
        workout_id: addWorkoutId,
        day_of_week: addDay,
        order: Number.isFinite(addOrder) ? Math.max(0, Math.trunc(addOrder)) : 0,
      };

      await postJson(url, payload);
      await mutateSchedule();

      setAddWorkoutId("");
      setAddOrder(1);
    } catch (e: any) {
      setSaveError(e?.message || "Failed to add workout to program");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <>
        <Head>
          <title>Admin • Programs</title>
        </Head>
        <main className="container py-4 text-white">
          <div className="ia-tile ia-tile-pad">
            <div className="text-dim">Checking access…</div>
          </div>
        </main>
      </>
    );
  }

  if (!canAccess) {
    return (
      <>
        <Head>
          <title>Admin • Programs</title>
        </Head>
        <main className="container py-4 text-white">
          <div className="ia-tile ia-tile-pad">
            <div className="ia-page-title">Access denied</div>
            <div className="text-dim">You do not have permission to view this page.</div>
            <div className="mt-3">
              <Link href="/admin" className="ia-btn ia-btn-outline">
                Back to admin
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Admin • Programs</title>
      </Head>

      <main className="container py-3 text-white" style={{ paddingBottom: 24 }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <div className="ia-page-title">Programs</div>
            <div className="ia-page-subtitle text-dim">Manage programs and attach workouts to schedules.</div>
          </div>

          <div className="d-flex gap-2">
            <Link href="/admin" className="ia-btn ia-btn-outline">
              ← Admin
            </Link>
            <Link href="/admin/programs/create" className="ia-btn ia-btn-primary">
              Create program
            </Link>
            <Link href="/admin/workouts/gym-create" className="ia-btn ia-btn-outline">
              Create workout
            </Link>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-5">
            <div className="ia-tile ia-tile-pad">
              <div className="d-flex justify-content-between align-items-center">
                <div className="ia-kicker">Programs</div>
                <div className="text-dim small">{programs.length} total</div>
              </div>

              <div className="mt-2">
                <input
                  className="form-control"
                  placeholder="Search programs…"
                  value={programSearch}
                  onChange={(e) => setProgramSearch(e.target.value)}
                />
              </div>

              <div className="mt-3">
                {!programsLoading && programsErr && (
                  <div className="text-danger">Failed to load programs.</div>
                )}

                {programsLoading && <div className="text-dim">Loading…</div>}

                {!programsLoading && !programsErr && filteredPrograms.length === 0 && (
                  <div className="text-dim">No programs found.</div>
                )}

                <div className="d-flex flex-column gap-2">
                  {filteredPrograms.map((p) => {
                    const isActive = p.program_id === selectedProgramId;
                    const start = safeDateLabel(p.start_date);
                    const weeks = p.weeks ?? "—";

                    return (
                      <button
                        key={p.program_id}
                        type="button"
                        className={`ia-tile ia-tile-pad ia-tile-flat text-start ${isActive ? "ia-badge-neon" : ""}`}
                        onClick={() => setSelectedProgramId(p.program_id)}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="ia-tile-title">{p.name || "Untitled program"}</div>
                          <div className="text-dim small">{weeks}w</div>
                        </div>
                        <div className="text-dim small">Start: {start}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-7">
            <div className="ia-tile ia-tile-pad">
              <div className="d-flex justify-content-between align-items-center">
                <div className="ia-kicker">Schedule</div>
                <div className="text-dim small">
                  {selectedProgram ? selectedProgram.name : "Select a program"}
                </div>
              </div>

              {!selectedProgram && (
                <div className="mt-3 text-dim">
                  Pick a program on the left to view and edit its workout schedule.
                </div>
              )}

              {selectedProgram && (
                <>
                  <div className="mt-3 ia-tile ia-tile-pad ia-tile-flat">
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="ia-tile-title">Add workout</div>
                      <div className="text-dim small">Writes to programs/{selectedProgramId}/schedule</div>
                    </div>

                    <div className="row g-2 mt-2">
                      <div className="col-12">
                        <input
                          className="form-control"
                          placeholder="Search workouts…"
                          value={workoutSearch}
                          onChange={(e) => setWorkoutSearch(e.target.value)}
                        />
                      </div>

                      <div className="col-12">
                        <select
                          className="form-select"
                          value={addWorkoutId}
                          onChange={(e) => setAddWorkoutId(e.target.value)}
                        >
                          <option value="">Select a workout…</option>
                          {filteredWorkouts.map((w) => (
                            <option key={w.workout_id} value={w.workout_id}>
                              {w.workout_name || "Untitled workout"}
                            </option>
                          ))}
                        </select>
                        {!workoutsLoading && workoutsErr && (
                          <div className="text-danger small mt-1">Failed to load workouts.</div>
                        )}
                      </div>

                      <div className="col-7 col-md-8">
                        <select
                          className="form-select"
                          value={addDay === null ? "" : String(addDay)}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") setAddDay(null);
                            else setAddDay(Number(v));
                          }}
                        >
                          {DAY_OPTIONS.map((d) => (
                            <option key={d.value} value={String(d.value)}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-5 col-md-4">
                        <input
                          className="form-control"
                          type="number"
                          min={0}
                          step={1}
                          value={String(addOrder)}
                          onChange={(e) => setAddOrder(Number(e.target.value))}
                          placeholder="Order"
                        />
                      </div>

                      <div className="col-12 d-flex justify-content-between align-items-center">
                        <div className="text-dim small">
                          Tip: keep “order” tight (1,2,3) to avoid messy schedules.
                        </div>
                        <button
                          type="button"
                          className="ia-btn ia-btn-primary"
                          disabled={!addWorkoutId || saving}
                          onClick={addWorkoutToProgram}
                        >
                          {saving ? "Adding…" : "Add"}
                        </button>
                      </div>

                      {saveError && <div className="col-12 text-danger small">{saveError}</div>}
                    </div>
                  </div>

                  <div className="mt-3">
                    {scheduleLoading && <div className="text-dim">Loading schedule…</div>}
                    {!scheduleLoading && scheduleErr && (
                      <div className="text-danger">Failed to load schedule.</div>
                    )}

                    {!scheduleLoading && !scheduleErr && schedule.length === 0 && (
                      <div className="text-dim">No workouts in this program yet.</div>
                    )}

                    <div className="d-flex flex-column gap-2">
                      {schedule.map((row) => {
                        const wName = workoutNameById.get(row.workout_id) || row.workout_id;
                        return (
                          <div key={row.schedule_id} className="ia-tile ia-tile-pad ia-tile-flat">
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="ia-tile-title">{wName}</div>
                              <div className="text-dim small">
                                {dayLabel(row.day_of_week)} • #{row.order}
                              </div>
                            </div>
                            <div className="text-dim small">Workout ID: {row.workout_id}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
