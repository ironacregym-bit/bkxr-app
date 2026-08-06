// File: pages/farmstrong.tsx

import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import useSWR from "swr";
import BottomNav from "../components/BottomNav";

import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
  type ChartDataset,
} from "chart.js";

import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

type WorkoutDayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

type ProgrammeExercise = {
  id?: string;
  name: string;
  reps?: string | null;
  notes?: string | null;
  tracked?: boolean;
  strength_exercise_id?: string | null;
};

type ProgrammeSection = {
  title?: string;
  scheme?: string | null;
  schemeLabel?: string | null;
  durationMinutes?: number | null;
  rounds?: number | null;
  instructions?: string[];
  exercises?: ProgrammeExercise[];
};

type WorkoutDaySections = {
  strength?: ProgrammeSection;
  capacity?: ProgrammeSection;
  athletic?: ProgrammeSection;
  notes?: ProgrammeSection;
};

type WorkoutDay = {
  dayName: WorkoutDayName;
  theme?: string;
  strength?: string[];
  capacity?: string[];
  athletic?: string[];
  notes?: string[];
  raw?: string;
  sections?: WorkoutDaySections;
};

type WeekPlan = {
  weekNumber: number;
  theme?: string;
  days: WorkoutDay[];
  raw?: string;
};

type ActiveBlock = {
  id?: string;
  block_id?: string;
  title?: string;
  name?: string;
  focus?: string | null;
};

type LiftSummary = {
  exerciseId: string;
  exerciseName: string;
  current: number;
  best: number;
  history?: Array<{
    value: number;
    recorded_at: string | null;
  }>;
};

type DashboardResponse = {
  ok: boolean;
  activeBlock?: ActiveBlock | null;
  currentWeek?: WeekPlan | null;
  currentWeekNumber?: number | null;
  lifts?: LiftSummary[];
};

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

const TRAINING_DAYS: WorkoutDayName[] = ["Monday", "Wednesday", "Friday", "Saturday"];

function shortDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function normaliseDayName(value: any): WorkoutDayName {
  const raw = String(value || "").trim();
  const allowed: WorkoutDayName[] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return allowed.includes(raw as WorkoutDayName) ? (raw as WorkoutDayName) : "Monday";
}

function sectionLabel(section?: ProgrammeSection): string {
  if (section?.schemeLabel) return String(section.schemeLabel);
  if (section?.scheme) return String(section.scheme);
  return "";
}

function sectionDuration(section?: ProgrammeSection): string {
  const mins = Number(section?.durationMinutes || 0);
  if (!Number.isFinite(mins) || mins <= 0) return "";
  return `${mins} min`;
}

function sectionLines(section?: ProgrammeSection, fallback?: string[]): string[] {
  const lines: string[] = [];

  if (Array.isArray(section?.instructions)) {
    lines.push(...section!.instructions!.filter(Boolean));
  }

  if (Array.isArray(section?.exercises)) {
    for (const ex of section!.exercises!) {
      const parts = [ex.name];

      if (ex.reps) parts.push(String(ex.reps));
      if (ex.notes) parts.push(`- ${ex.notes}`);

      const line = parts.filter(Boolean).join(" ").trim();
      if (line) lines.push(line);
    }
  }

  if (!lines.length && Array.isArray(fallback)) {
    return fallback.filter(Boolean);
  }

  return lines;
}

function formatKg(value: any): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "No previous";
  return `${n}kg`;
}

function findLift(lifts: LiftSummary[], exerciseId?: string | null, name?: string | null): LiftSummary | null {
  const id = String(exerciseId || "").trim().toLowerCase();
  const exerciseName = String(name || "").trim().toLowerCase();

  return (
    lifts.find((lift) => String(lift.exerciseId || "").trim().toLowerCase() === id) ||
    lifts.find((lift) => String(lift.exerciseName || "").trim().toLowerCase() === exerciseName) ||
    null
  );
}

function getTrackedExercises(day?: WorkoutDay | null): ProgrammeExercise[] {
  const exercises = day?.sections?.strength?.exercises;
  if (!Array.isArray(exercises)) return [];
  return exercises.filter((exercise) => exercise.tracked);
}

function MovementGraph({ lift }: { lift: LiftSummary | null }) {
  const chart = useMemo(() => {
    const rows = Array.isArray(lift?.history) ? lift!.history!.filter((x) => x.recorded_at) : [];

    if (!rows.length) return null;

    return {
      data: {
        labels: rows.map((x) => shortDate(x.recorded_at)),
        datasets: [
          {
            label: lift?.exerciseName || "Progress",
            data: rows.map((x) => x.value),
            borderColor: "#18ff9a",
            backgroundColor: "rgba(24,255,154,.12)",
            tension: 0.35,
            pointRadius: 2,
            fill: true,
          } as ChartDataset<"line">,
        ],
      } as ChartData<"line">,

      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            ticks: {
              color: "#9fb0c3",
            },
            grid: {
              color: "rgba(255,255,255,.06)",
            },
          },
          y: {
            ticks: {
              color: "#9fb0c3",
            },
            grid: {
              color: "rgba(255,255,255,.06)",
            },
          },
        },
      } as ChartOptions<"line">,
    };
  }, [lift]);

  if (!chart) {
    return <div className="fs-empty mt-2">No graph data yet. Update this lift a few times and progress will show here.</div>;
  }

  return (
    <div className="fs-graph-wrap mt-2">
      <Line data={chart.data} options={chart.options} />
    </div>
  );
}

function WorkoutSection({
  title,
  icon,
  section,
  fallback,
}: {
  title: string;
  icon: string;
  section?: ProgrammeSection;
  fallback?: string[];
}) {
  const label = sectionLabel(section);
  const duration = sectionDuration(section);
  const lines = sectionLines(section, fallback);

  if (!label && !duration && !lines.length) return null;

  return (
    <section className="ia-tile ia-tile-pad mb-2 fs-section-card">
      <div className="fs-section-top">
        <div>
          <div className="ia-kicker">
            <i className={`fas ${icon}`} />
            {title}
          </div>

          <div className="fs-pill-row mt-2">
            {label ? <span className="fs-pill">{label}</span> : null}
            {duration ? <span className="fs-pill fs-pill-muted">{duration}</span> : null}
          </div>
        </div>
      </div>

      {lines.length ? (
        <div className="fs-work-list mt-3">
          {lines.map((line, index) => (
            <div key={`${title}-${index}`} className="fs-work-line">
              <span className="fs-dot" />
              <span>{line}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-dim small mt-2">Nothing programmed for this section.</div>
      )}
    </section>
  );
}

function TrackedLiftCard({
  exercise,
  lift,
  value,
  saving,
  expanded,
  onToggle,
  onChange,
  onSave,
}: {
  exercise: ProgrammeExercise;
  lift: LiftSummary | null;
  value: string;
  saving: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="fs-lift-card">
      <button type="button" className="fs-lift-main" onClick={onToggle}>
        <div className="fs-lift-title-row">
          <div className="fs-lift-title">{exercise.name}</div>
          <i className={`fas fa-chevron-${expanded ? "up" : "down"} fs-expand-icon`} />
        </div>

        <div className="fs-lift-meta">
          {exercise.reps ? <span>{exercise.reps}</span> : null}
          <span>Last {formatKg(lift?.current)}</span>
          <span>Best {formatKg(lift?.best)}</span>
        </div>
      </button>

      <div className="fs-lift-action">
        <input
          type="number"
          min="0"
          step="0.5"
          className="fs-lift-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="kg"
        />

        <button type="button" className="ia-btn-primary fs-save-lift-btn" disabled={saving} onClick={onSave}>
          {saving ? "Saving" : "Update"}
        </button>
      </div>

      {expanded ? (
        <div className="fs-lift-expanded">
          <div className="row g-2">
            <div className="col-6">
              <div className="ia-stat-mini">
                <div className="ia-stat-mini-value">{formatKg(lift?.current)}</div>
                <div className="ia-stat-mini-label">Current</div>
              </div>
            </div>

            <div className="col-6">
              <div className="ia-stat-mini">
                <div className="ia-stat-mini-value">{formatKg(lift?.best)}</div>
                <div className="ia-stat-mini-label">Best ever</div>
              </div>
            </div>
          </div>

          <MovementGraph lift={lift} />
        </div>
      ) : null}
    </div>
  );
}

export default function FarmStrongPage() {
  const { data: session, status } = useSession();

  const [emailValue, setEmailValue] = useState("");
  const [selectedDay, setSelectedDay] = useState<WorkoutDayName>("Monday");
  const [liftValues, setLiftValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string>("");
  const [expandedLiftKey, setExpandedLiftKey] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, mutate } = useSWR<DashboardResponse>(
    status === "authenticated" ? "/api/farmstrong/dashboard" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  const activeBlock = data?.activeBlock || null;
  const currentWeek = data?.currentWeek || null;
  const currentWeekNumber = Number(data?.currentWeekNumber || currentWeek?.weekNumber || 1);
  const lifts = Array.isArray(data?.lifts) ? data!.lifts! : [];

  const days: WorkoutDay[] = useMemo(() => {
    if (Array.isArray(currentWeek?.days) && currentWeek!.days.length) {
      return currentWeek!.days;
    }

    return [];
  }, [currentWeek]);

  useEffect(() => {
    if (!days.length) return;

    const currentSelectedExists = days.some((day) => day.dayName === selectedDay);

    if (!currentSelectedExists) {
      const preferred = days.find((day) => TRAINING_DAYS.includes(day.dayName)) || days[0];
      setSelectedDay(normaliseDayName(preferred?.dayName));
    }
  }, [days, selectedDay]);

  useEffect(() => {
    setMessage(null);
    setErrorMessage(null);
    setExpandedLiftKey("");
  }, [selectedDay]);

  const activeDay = useMemo(() => {
    return days.find((day) => day.dayName === selectedDay) || days[0] || null;
  }, [days, selectedDay]);

  const trackedExercises = useMemo(() => getTrackedExercises(activeDay), [activeDay]);

  async function emailLogin() {
    if (!emailValue.trim()) return;

    await signIn("email", {
      email: emailValue.trim(),
      callbackUrl: "/farmstrong",
    });
  }

  function updateLiftValue(key: string, value: string) {
    setLiftValues((prev) => ({
      ...prev,
      value,
    }));
  }

  async function saveLift(exercise: ProgrammeExercise) {
    const exerciseId = String(exercise.strength_exercise_id || exercise.name || "").trim();
    const exerciseName = String(exercise.name || exerciseId).trim();
    const key = exerciseId || exerciseName;
    const value = Number(liftValues[key]);

    setMessage(null);
    setErrorMessage(null);

    if (!exerciseId || !exerciseName) {
      setErrorMessage("This tracked exercise is missing an exercise name.");
      return;
    }

    if (!Number.isFinite(value) || value <= 0) {
      setErrorMessage("Enter the weight you used first.");
      return;
    }

    setSavingKey(key);

    try {
      const res = await fetch("/api/farmstrong/update-lift", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exercise_id: exerciseId,
          exercise_name: exerciseName,
          value,
          farmstrong_block_id: activeBlock?.block_id || activeBlock?.id || null,
          farmstrong_week_number: currentWeekNumber,
          farmstrong_day_name: activeDay?.dayName || null,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to update lift");
      }

      setLiftValues((prev) => ({
        ...prev,
        "",
      }));

      setExpandedLiftKey(key);
      setMessage(`${exerciseName} updated.`);
      await mutate();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update lift");
    } finally {
      setSavingKey("");
    }
  }

  if (status === "loading") {
    return null;
  }

  return (
    <>
      <Head>
        <title>Farm Strong</title>
      </Head>

      {!session ? (
        <div className="ia-modal-backdrop">
          <div className="ia-modal-card" style={{ maxWidth: 460 }}>
            <div className="ia-kicker">
              <i className="fas fa-tractor" />
              FARM STRONG
            </div>

            <div className="ia-page-title mt-2">Member Login</div>

            <div className="ia-page-subtitle mt-2">
              Access this week’s Farm Strong training and update your tracked lifts.
            </div>

            <button
              className="ia-btn-primary w-100 mt-3"
              onClick={() =>
                signIn("google", {
                  callbackUrl: "/farmstrong",
                })
              }
            >
              <i className="fab fa-google" />
              Continue with Google
            </button>

            <input
              className="form-control mt-3"
              placeholder="Email Address"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
            />

            <button className="ia-btn-outline w-100 mt-2" onClick={emailLogin}>
              Email me a sign in link
            </button>
          </div>
        </div>
      ) : (
        <main className="container py-2 iron-acre-home fs-page">
          <section className="ia-tile ia-tile-pad mb-2 fs-hero">
            <div className="ia-kicker">
              <i className="fas fa-tractor" />
              FARM STRONG
            </div>

            <div className="fs-hero-row mt-2">
              <div className="fs-hero-copy">
                <div className="ia-page-title">{activeBlock?.title || activeBlock?.name || "Farm Strong"}</div>
                <div className="ia-page-subtitle">{activeBlock?.focus || "This week’s programmed training."}</div>
              </div>

              <div className="fs-week-box">
                <span>Week</span>
                <strong>{currentWeekNumber}</strong>
              </div>
            </div>

            {currentWeek?.theme ? <div className="fs-week-theme mt-3">{currentWeek.theme}</div> : null}
          </section>

          {!activeBlock ? (
            <section className="ia-tile ia-tile-pad mb-2">
              <div className="ia-card-title-compact">No active block</div>
              <div className="text-dim small mt-2">
                There is no active Farm Strong block yet. Set one in admin to show this week’s training.
              </div>
            </section>
          ) : null}

          {activeBlock && !activeDay ? (
            <section className="ia-tile ia-tile-pad mb-2">
              <div className="ia-card-title-compact">No workouts found this week</div>
              <div className="text-dim small mt-2">
                The active block is loaded, but the current week has no programmed days.
              </div>
            </section>
          ) : null}

          {activeDay ? (
            <>
              <section className="ia-tile ia-tile-pad mb-2">
                <div className="ia-card-title-compact">This week’s workouts</div>

                <div className="ia-week-chip-row mt-2">
                  {days.map((day) => (
                    <button
                      key={day.dayName}
                      type="button"
                      className={selectedDay === day.dayName ? "ia-week-chip ia-week-chip-active" : "ia-week-chip"}
                      onClick={() => setSelectedDay(day.dayName)}
                    >
                      {day.dayName}
                    </button>
                  ))}
                </div>
              </section>

              <section className="ia-tile ia-tile-pad mb-2 fs-day-header">
                <div className="fs-day-kicker">{activeDay.dayName}</div>
                <div className="fs-day-title">{activeDay.theme || "Farm Strong Session"}</div>
                <div className="text-dim small mt-1">
                  Read the session, update the main tracked lifts if needed, then crack on.
                </div>
              </section>

              <section className="ia-tile ia-tile-pad mb-2 fs-section-card">
                <div className="fs-section-top">
                  <div>
                    <div className="ia-kicker">
                      <i className="fas fa-chart-line" />
                      TRACKED LIFTS
                    </div>

                    {sectionLabel(activeDay.sections?.strength) ? (
                      <div className="fs-pill-row mt-2">
                        <span className="fs-pill">{sectionLabel(activeDay.sections?.strength)}</span>
                        {sectionDuration(activeDay.sections?.strength) ? (
                          <span className="fs-pill fs-pill-muted">{sectionDuration(activeDay.sections?.strength)}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {trackedExercises.length ? (
                  <div className="fs-lift-list mt-3">
                    {trackedExercises.map((exercise, index) => {
                      const key = String(exercise.strength_exercise_id || exercise.name || index);
                      const lift = findLift(lifts, exercise.strength_exercise_id, exercise.name);

                      return (
                        <TrackedLiftCard
                          key={`${key}-${index}`}
                          exercise={exercise}
                          lift={lift}
                          value={liftValues[key] || ""}
                          saving={savingKey === key}
                          expanded={expandedLiftKey === key}
                          onToggle={() => setExpandedLiftKey((prev) => (prev === key ? "" : key))}
                          onChange={(value) => updateLiftValue(key, value)}
                          onSave={() => saveLift(exercise)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="fs-empty mt-3">
                    No tracked lifts have been set for this day yet. Add tracked strength exercises in the block editor.
                  </div>
                )}

                {message ? <div className="fs-alert fs-alert-ok mt-3">{message}</div> : null}
                {errorMessage ? <div className="fs-alert fs-alert-error mt-3">{errorMessage}</div> : null}
              </section>

              <WorkoutSection
                title="Strength work"
                icon="fa-dumbbell"
                section={activeDay.sections?.strength}
                fallback={activeDay.strength || []}
              />

              <WorkoutSection
                title="Capacity"
                icon="fa-fire"
                section={activeDay.sections?.capacity}
                fallback={activeDay.capacity || []}
              />

              <WorkoutSection
                title="Athletic"
                icon="fa-bolt"
                section={activeDay.sections?.athletic}
                fallback={activeDay.athletic || []}
              />

              <WorkoutSection
                title="Notes"
                icon="fa-clipboard"
                section={activeDay.sections?.notes}
                fallback={activeDay.notes || []}
              />
            </>
          ) : null}
        </main>
      )}

      <BottomNav />

      <style jsx>{`
        .fs-page {
          color: #fff;
          padding-bottom: 96px !important;
        }

        .fs-hero {
          background:
            radial-gradient(circle at top right, rgba(24, 255, 154, 0.12), transparent 34%),
            linear-gradient(180deg, rgba(14, 19, 27, 0.96) 0%, rgba(10, 14, 20, 0.96) 100%);
        }

        .fs-hero-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .fs-hero-copy {
          min-width: 0;
        }

        .fs-week-box {
          min-width: 64px;
          border-radius: 16px;
          padding: 8px 10px;
          text-align: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          flex: 0 0 auto;
        }

        .fs-week-box span {
          display: block;
          color: var(--ia-muted);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 800;
          line-height: 1;
        }

        .fs-week-box strong {
          display: block;
          color: var(--ia-neon);
          font-size: 1.25rem;
          line-height: 1;
          margin-top: 5px;
        }

        .fs-week-theme {
          border-radius: 12px;
          padding: 9px 10px;
          background: rgba(24, 255, 154, 0.08);
          border: 1px solid rgba(24, 255, 154, 0.15);
          color: #d9fff5;
          font-size: 0.84rem;
          font-weight: 650;
        }

        .fs-day-header {
          border-color: rgba(24, 255, 154, 0.15);
        }

        .fs-day-kicker {
          color: var(--ia-neon);
          font-size: 0.74rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          line-height: 1;
        }

        .fs-day-title {
          font-size: 1.12rem;
          font-weight: 900;
          line-height: 1.1;
          margin-top: 6px;
          color: #fff;
        }

        .fs-section-card {
          overflow: hidden;
        }

        .fs-section-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .fs-pill-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .fs-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          min-height: 26px;
          padding: 0 10px;
          background: rgba(24, 255, 154, 0.1);
          border: 1px solid rgba(24, 255, 154, 0.18);
          color: #d9fff5;
          font-size: 0.74rem;
          font-weight: 850;
          line-height: 1;
        }

        .fs-pill-muted {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.82);
        }

        .fs-lift-list {
          display: grid;
          gap: 10px;
        }

        .fs-lift-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(120px, 150px);
          gap: 10px;
          align-items: center;
          border-radius: 14px;
          padding: 11px;
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .fs-lift-main {
          appearance: none;
          border: none;
          background: transparent;
          color: inherit;
          text-align: left;
          padding: 0;
          min-width: 0;
          cursor: pointer;
        }

        .fs-lift-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .fs-lift-title {
          font-weight: 850;
          color: #fff;
          line-height: 1.15;
        }

        .fs-expand-icon {
          color: var(--ia-muted);
          font-size: 0.74rem;
          flex: 0 0 auto;
        }

        .fs-lift-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 7px;
          color: var(--ia-muted);
          font-size: 0.73rem;
          line-height: 1;
        }

        .fs-lift-meta span {
          border-radius: 999px;
          padding: 4px 7px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .fs-lift-action {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .fs-lift-input {
          width: 100%;
          min-height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(24, 255, 154, 0.2);
          background: rgba(0, 0, 0, 0.24);
          color: #fff;
          text-align: center;
          font-weight: 900;
          outline: none;
        }

        .fs-lift-input:focus {
          border-color: rgba(24, 255, 154, 0.45);
          box-shadow: 0 0 0 3px rgba(24, 255, 154, 0.12);
        }

        .fs-save-lift-btn {
          min-height: 36px !important;
          border-radius: 12px !important;
          width: 100%;
        }

        .fs-lift-expanded {
          grid-column: 1 / -1;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 10px;
        }

        .fs-graph-wrap {
          height: 210px;
          border-radius: 14px;
          padding: 10px;
          background: rgba(0, 0, 0, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .fs-work-list {
          display: grid;
          gap: 8px;
        }

        .fs-work-line {
          display: flex;
          gap: 9px;
          align-items: flex-start;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 9px 10px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.87rem;
          line-height: 1.35;
        }

        .fs-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--ia-neon);
          margin-top: 6px;
          flex: 0 0 auto;
          box-shadow: 0 0 10px rgba(24, 255, 154, 0.36);
        }

        .fs-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 76px;
          text-align: center;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed rgba(255, 255, 255, 0.12);
          color: var(--ia-muted);
          font-size: 0.84rem;
          padding: 12px;
        }

        .fs-alert {
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 0.84rem;
          font-weight: 750;
        }

        .fs-alert-ok {
          background: rgba(24, 255, 154, 0.1);
          border: 1px solid rgba(24, 255, 154, 0.22);
          color: #d9fff5;
        }

        .fs-alert-error {
          background: rgba(255, 95, 115, 0.1);
          border: 1px solid rgba(255, 95, 115, 0.26);
          color: #ffb8c1;
        }

        @media (max-width: 560px) {
          .fs-lift-card {
            grid-template-columns: 1fr;
          }

          .fs-lift-action {
            grid-template-columns: minmax(0, 1fr) 110px;
          }

          .fs-lift-input {
            text-align: left;
            padding-left: 12px;
          }
        }
      `}</style>
    </>
  );
}
