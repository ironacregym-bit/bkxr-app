// File: pages/admin/programs/index.tsx
import Head from "next/head";
import Link from "next/link";
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: programsResp, error: programsErr, isLoading: programsLoading } =
    useSWR<ProgramsListResp>(canAccess ? "/api/programs/admin/list" : null, fetcher, {
      revalidateOnFocus: false,
    });

  const { data: workoutsResp, error: workoutsErr, isLoading: workoutsLoading } =
    useSWR<WorkoutsListResp>(canAccess ? "/api/workouts/admin/list" : null, fetcher, {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    });

  const programs = Array.isArray(programsResp?.programs) ? programsResp!.programs! : [];
  const workouts = Array.isArray(workoutsResp?.workouts) ? workoutsResp!.workouts! : [];

  const selectedProgram = useMemo(
    () => programs.find((p) => p.program_id === selectedProgramId) || null,
    [programs, selectedProgramId]
  );

  const scheduleKey = selectedProgramId
    ? `/api/programs/admin/${encodeURIComponent(selectedProgramId)}/schedule`
    : null;

  const {
    data: scheduleResp,
    error: scheduleErr,
    isLoading: scheduleLoading,
    mutate: mutateSchedule,
  } = useSWR<ScheduleResp>(canAccess ? scheduleKey : null, fetcher, {
    revalidateOnFocus: false,
  });

  const schedule = Array.isArray(scheduleResp?.schedule) ? scheduleResp!.schedule! : [];

  const workoutNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workouts) {
      if (w?.workout_id) m.set(w.workout_id, w.workout_name || "Untitled workout");
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
    if (!selectedProgramId || !addWorkoutId) return;

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
            <div className="ia-page-subtitle text-dim">
              Manage programs and attach workouts to schedules.
            </div>
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
              <div className="ia-kicker">Programs</div>

              <input
                className="form-control mt-2"
                placeholder="Search programs…"
                value={programSearch}
                onChange={(e) => setProgramSearch(e.target.value)}
              />

              <div className="mt-3 d-flex flex-column gap-2">
                {filteredPrograms.map((p) => {
                  const isActive = p.program_id === selectedProgramId;
                  return (
                    <button
                      key={p.program_id}
                      type="button"
                      className={`ia-tile ia-tile-pad ia-tile-flat text-start ${
                        isActive ? "ia-badge-neon" : ""
                      }`}
                      onClick={() => setSelectedProgramId(p.program_id)}
                    >
                      <div className="d-flex justify-content-between">
                        <div className="ia-tile-title">{p.name || "Untitled program"}</div>
                        <div className="text-dim small">{p.weeks ?? "—"}w</div>
                      </div>
                      <div className="text-dim small">Start: {safeDateLabel(p.start_date)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-7">
            <div className="ia-tile ia-tile-pad">
              <div className="ia-kicker">Schedule</div>

              {!selectedProgram && (
                <div className="text-dim mt-2">Select a program to view its schedule.</div>
              )}

              {selectedProgram && (
                <>
                  <div className="ia-tile ia-tile-pad ia-tile-flat mt-3">
                    <div className="ia-tile-title mb-2">Add workout</div>

                    <input
                      className="form-control mb-2"
                      placeholder="Search workouts…"
                      value={workoutSearch}
                      onChange={(e) => setWorkoutSearch(e.target.value)}
                    />

                    <select
                      className="form-select mb-2"
                      value={addWorkoutId}
                      onChange={(e) => setAddWorkoutId(e.target.value)}
                    >
                      <option value="">Select workout…</option>
                      {filteredWorkouts.map((w) => (
                        <option key={w.workout_id} value={w.workout_id}>
                          {w.workout_name || "Untitled workout"}
                        </option>
                      ))}
                    </select>

                    <div className="d-flex gap-2">
                      <select
                        className="form-select"
                        value={addDay ?? ""}
                        onChange={(e) => setAddDay(e.target.value === "" ? null : Number(e.target.value))}
                      >
                        {DAY_OPTIONS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>

                      <input
                        className="form-control"
                        type="number"
                        value={addOrder}
                        onChange={(e) => setAddOrder(Number(e.target.value))}
                      />
                    </div>

                    <div className="mt-2 d-flex justify-content-end">
                      <button
                        type="button"
                        className="ia-btn ia-btn-primary"
                        disabled={!addWorkoutId || saving}
                        onClick={addWorkoutToProgram}
                      >
                        {saving ? "Adding…" : "Add"}
                      </button>
                    </div>

                    {saveError && <div className="text-danger small mt-2">{saveError}</div>}
                  </div>

                  <div className="mt-3 d-flex flex-column gap-2">
                    {schedule.map((row) => (
                      <div key={row.schedule_id} className="ia-tile ia-tile-pad ia-tile-flat">
                        <div className="d-flex justify-content-between">
                          <div className="ia-tile-title">
                            {workoutNameById.get(row.workout_id) || row.workout_id}
                          </div>
                          <div className="text-dim small">
                            {dayLabel(row.day_of_week)} • #{row.order}
                          </div>
                        </div>
                      </div>
                    ))}
                    {scheduleLoading && <div className="text-dim">Loading schedule…</div>}
                    {scheduleErr && <div className="text-danger">Failed to load schedule.</div>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
