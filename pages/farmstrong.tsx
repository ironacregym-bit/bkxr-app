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
  weeks?: WeekPlan[];
  tracked_strength_exercises?: Array<{
    exercise_name: string;
    strength_exercise_id: string;
    weekNumber: number;
    dayName: WorkoutDayName;
  }>;
};

type LiftHistoryRow = {
  value: number;
  recorded_at: string | null;
};

type LiftSummary = {
  exerciseId: string;
  exerciseName: string;
  current: number;
  best: number;
  history: LiftHistoryRow[];
};

type DashboardResponse = {
  ok: boolean;
  activeBlock?: ActiveBlock | null;
  currentWeek?: WeekPlan | null;
  currentWeekNumber?: number | null;
  lifts?: LiftSummary[];
  weightHistory?: Array<{
    weight_kg: number;
    date: string | null;
  }>;
};

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

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

function getSectionLabel(section?: ProgrammeSection, fallback?: string) {
  if (section?.schemeLabel) return section.schemeLabel;
  if (section?.scheme) return section.scheme;
  return fallback || "";
}

function sectionLines(section?: ProgrammeSection, fallback?: string[]) {
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

  if (!lines.length && Array.isArray(fallback)) return fallback.filter(Boolean);

  return lines;
}

function parseReps(value: string | null | undefined): number | null {
  if (!value) return null;

  const match = String(value).match(/(\d+(\.\d+)?)/);
  if (!match) return null;

  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatKg(value: any) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n}kg`;
}

function makeFarmStrongWorkoutId(blockId: string, weekNumber: number, dayName: string) {
  const safeBlock = String(blockId || "farmstrong").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeDay = String(dayName || "day").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `farmstrong_${safeBlock}_w${weekNumber}_${safeDay}`;
}

function findLift(lifts: LiftSummary[], idOrName?: string | null) {
  if (!idOrName) return null;

  const target = String(idOrName).trim().toLowerCase();

  return (
    lifts.find((lift) => String(lift.exerciseId || "").trim().toLowerCase() === target) ||
    lifts.find((lift) => String(lift.exerciseName || "").trim().toLowerCase() === target) ||
    null
  );
}

function SectionCard({
  title,
  section,
  fallback,
  icon,
  scoreLabel,
  scoreValue,
  onScoreChange,
}: {
  title: string;
  section?: ProgrammeSection;
  fallback?: string[];
  icon: string;
  scoreLabel?: string;
  scoreValue?: string;
  onScoreChange?: (value: string) => void;
}) {
  const label = getSectionLabel(section);
  const lines = sectionLines(section, fallback);

  if (!label && !lines.length && !scoreLabel) return null;

  return (
    <section className="ia-tile ia-tile-pad mb-2 fs-section-card">
      <div className="fs-section-head">
        <div>
          <div className="ia-kicker">
            <i className={`fas ${icon}`} />
            {title}
          </div>

          {label ? <div className="fs-scheme-pill mt-2">{label}</div> : null}
        </div>

        {section?.durationMinutes ? (
          <div className="fs-duration-pill">{section.durationMinutes} min</div>
        ) : null}
      </div>

      {lines.length ? (
        <div className="fs-work-list mt-3">
          {lines.map((line, index) => (
            <div key={`${title}-${index}`} className="fs-work-row">
              <span className="fs-work-dot" />
              <span>{line}</span>
            </div>
          ))}
        </div>
      ) : null}

      {scoreLabel && onScoreChange ? (
        <div className="mt-3">
          <label className="fs-label">{scoreLabel}</label>
          <input
            className="fs-input"
            value={scoreValue || ""}
            onChange={(e) => onScoreChange(e.target.value)}
            placeholder="e.g. completed, 6:42, 8 rounds, notes"
          />
        </div>
      ) : null}
    </section>
  );
}

function StrengthLogCard({
  day,
  lifts,
  values,
  onChange,
}: {
  day: WorkoutDay;
  lifts: LiftSummary[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const strength = day.sections?.strength;
  const exercises = Array.isArray(strength?.exercises) ? strength!.exercises! : [];
  const tracked = exercises.filter((ex) => ex.tracked);

  if (!tracked.length) {
    const fallbackLines = sectionLines(strength, day.strength || []);

    return (
      <section className="ia-tile ia-tile-pad mb-2 fs-section-card">
        <div className="ia-kicker">
          <i className="fas fa-dumbbell" />
          STRENGTH
        </div>

        {getSectionLabel(strength) ? <div className="fs-scheme-pill mt-2">{getSectionLabel(strength)}</div> : null}

        <div className="fs-work-list mt-3">
          {fallbackLines.map((line, index) => (
            <div key={`strength-line-${index}`} className="fs-work-row">
              <span className="fs-work-dot" />
              <span>{line}</span>
            </div>
          ))}
        </div>

        <div className="fs-empty-note mt-3">
          No tracked strength lifts have been set for this day yet.
        </div>
      </section>
    );
  }

  return (
    <section className="ia-tile ia-tile-pad mb-2 fs-section-card fs-strength-card">
      <div className="fs-section-head">
        <div>
          <div className="ia-kicker">
            <i className="fas fa-dumbbell" />
            STRENGTH
          </div>

          {getSectionLabel(strength) ? <div className="fs-scheme-pill mt-2">{getSectionLabel(strength)}</div> : null}
        </div>

        {strength?.durationMinutes ? (
          <div className="fs-duration-pill">{strength.durationMinutes} min</div>
        ) : null}
      </div>

      <div className="fs-track-list mt-3">
        {tracked.map((exercise, index) => {
          const key = exercise.strength_exercise_id || exercise.name || String(index);
          const lift = findLift(lifts, exercise.strength_exercise_id || exercise.name);
          const previous = lift?.current || 0;
          const best = lift?.best || 0;

          return (
            <div key={`${key}-${index}`} className="fs-track-row">
              <div className="fs-track-main">
                <div className="fs-track-title">{exercise.name}</div>
                <div className="fs-track-meta">
                  {exercise.reps ? <span>{exercise.reps}</span> : null}
                  <span>Previous {formatKg(previous)}</span>
                  <span>Best {formatKg(best)}</span>
                </div>
              </div>

              <div className="fs-track-input-wrap">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  className="fs-track-input"
                  value={values[key] || ""}
                  onChange={(e) => onChange(key, e.target.value)}
                  placeholder="kg"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function FarmStrongPage() {
  const { data: session, status } = useSession();

  const [emailValue, setEmailValue] = useState("");
  const [selectedDay, setSelectedDay] = useState<WorkoutDayName>("Monday");
  const [strengthValues, setStrengthValues] = useState<Record<string, string>>({});
  const [capacityScore, setCapacityScore] = useState("");
  const [athleticScore, setAthleticScore] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [selectedLiftId, setSelectedLiftId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    return Array.isArray(currentWeek?.days) ? currentWeek!.days : [];
  }, [currentWeek]);

  useEffect(() => {
    if (!days.length) return;

    const existing = days.find((day) => day.dayName === selectedDay);
    if (!existing) {
      setSelectedDay(normaliseDayName(days[0]?.dayName));
    }
  }, [days, selectedDay]);

  useEffect(() => {
    if (!selectedLiftId && lifts.length) {
      setSelectedLiftId(lifts[0].exerciseId);
    }
  }, [lifts, selectedLiftId]);

  useEffect(() => {
    setStrengthValues({});
    setCapacityScore("");
    setAthleticScore("");
    setSessionNotes("");
    setSaveOk(null);
    setSaveError(null);
  }, [selectedDay, currentWeekNumber, activeBlock?.id, activeBlock?.block_id]);

  const activeDay = useMemo(() => {
    return days.find((day) => day.dayName === selectedDay) || days[0] || null;
  }, [days, selectedDay]);

  const selectedLift = useMemo(() => {
    return lifts.find((lift) => lift.exerciseId === selectedLiftId) || lifts[0] || null;
  }, [lifts, selectedLiftId]);

  const weightChart = useMemo(() => {
    const rows = data?.weightHistory || [];

    if (!rows.length) return null;

    return {
      data: {
        labels: rows.map((x: any) => shortDate(x.date)),
        datasets: [
          {
            label: "Weight",
            data: rows.map((x: any) => x.weight_kg),
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
  }, [data]);

  const liftChart = useMemo(() => {
    if (!selectedLift?.history?.length) return null;

    return {
      data: {
        labels: selectedLift.history.map((x: any) => shortDate(x.recorded_at)),
        datasets: [
          {
            label: selectedLift.exerciseName,
            data: selectedLift.history.map((x: any) => x.value),
            borderColor: "#18ff9a",
            backgroundColor: "rgba(24,255,154,.12)",
            tension: 0.35,
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
  }, [selectedLift]);

  async function emailLogin() {
    if (!emailValue) return;

    await signIn("email", {
      email: emailValue,
      callbackUrl: "/farmstrong",
    });
  }

  function updateStrengthValue(key: string, value: string) {
    setStrengthValues((prev) => ({
      ...prev,
      value,
    }));
  }

  async function saveSession() {
    if (!activeBlock || !activeDay) return;

    setSaving(true);
    setSaveOk(null);
    setSaveError(null);

    try {
      const blockId = String(activeBlock.block_id || activeBlock.id || "");
      const workoutId = makeFarmStrongWorkoutId(blockId, currentWeekNumber, activeDay.dayName);
      const strengthExercises = activeDay.sections?.strength?.exercises || [];

      const sets = strengthExercises
        .filter((exercise) => exercise.tracked)
        .map((exercise, index) => {
          const key = exercise.strength_exercise_id || exercise.name || String(index);
          const weight = Number(strengthValues[key]);
          const reps = parseReps(exercise.reps);

          if (!Number.isFinite(weight) || weight <= 0) return null;

          return {
            exercise_id: exercise.strength_exercise_id || exercise.name,
            set: 1,
            weight,
            reps,
            movement_key: exercise.strength_exercise_id || exercise.name,
          };
        })
        .filter(Boolean);

      const notesParts = [
        capacityScore ? `Capacity: ${capacityScore}` : "",
        athleticScore ? `Athletic: ${athleticScore}` : "",
        sessionNotes ? `Notes: ${sessionNotes}` : "",
      ].filter(Boolean);

      const res = await fetch("/api/completions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workout_id: workoutId,
          activity_type: "Farm Strong",
          notes: notesParts.join("\n"),
          sets,
          farmstrong_block_id: blockId,
          farmstrong_week_number: currentWeekNumber,
          farmstrong_day_name: activeDay.dayName,
          capacity_score: capacityScore || null,
          athletic_score: athleticScore || null,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save session");
      }

      setSaveOk("Session saved.");
      setStrengthValues({});
      setCapacityScore("");
      setAthleticScore("");
      setSessionNotes("");

      await mutate();
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save session");
    } finally {
      setSaving(false);
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

      {!session && (
        <div className="ia-modal-backdrop">
          <div className="ia-modal-card" style={{ maxWidth: 460 }}>
            <div className="ia-kicker">
              <i className="fas fa-tractor" />
              FARM STRONG
            </div>

            <div className="ia-page-title mt-2">Member Login</div>

            <div className="ia-page-subtitle mt-2">
              Access your block, today’s training and strength progress.
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
      )}

      {session && (
        <main className="container py-2 iron-acre-home fs-page">
          <section className="ia-tile ia-tile-pad mb-2 fs-hero-card">
            <div className="ia-kicker">
              <i className="fas fa-tractor" />
              FARM STRONG
            </div>

            <div className="fs-hero-row mt-2">
              <div>
                <div className="ia-page-title">
                  {activeBlock?.title || activeBlock?.name || "Farm Strong"}
                </div>

                <div className="ia-page-subtitle">{activeBlock?.focus || "Block training and progress."}</div>
              </div>

              <div className="fs-week-badge">
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
                No Farm Strong workout block is active yet. Set an active block in admin to show member programming here.
              </div>
            </section>
          ) : null}

          {activeBlock && !activeDay ? (
            <section className="ia-tile ia-tile-pad mb-2">
              <div className="ia-card-title-compact">No week programming found</div>
              <div className="text-dim small mt-2">
                The active block is loaded, but the current week has no days to display.
              </div>
            </section>
          ) : null}

          {activeDay ? (
            <>
              <section className="ia-tile ia-tile-pad mb-2">
                <div className="ia-card-title-compact">This week</div>

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

              <section className="ia-tile ia-tile-pad mb-2 fs-session-header">
                <div className="fs-session-day">{activeDay.dayName}</div>
                <div className="fs-session-title">{activeDay.theme || "Farm Strong Session"}</div>
                <div className="text-dim small mt-1">
                  Complete the programmed strength, log the tracked lifts, then add your capacity and athletic scores.
                </div>
              </section>

              <StrengthLogCard
                day={activeDay}
                lifts={lifts}
                values={strengthValues}
                onChange={updateStrengthValue}
              />

              <SectionCard
                title="Capacity"
                icon="fa-fire"
                section={activeDay.sections?.capacity}
                fallback={activeDay.capacity || []}
                scoreLabel="Capacity score"
                scoreValue={capacityScore}
                onScoreChange={setCapacityScore}
              />

              <SectionCard
                title="Athletic"
                icon="fa-bolt"
                section={activeDay.sections?.athletic}
                fallback={activeDay.athletic || []}
                scoreLabel="Athletic score"
                scoreValue={athleticScore}
                onScoreChange={setAthleticScore}
              />

              <SectionCard
                title="Notes"
                icon="fa-clipboard"
                section={activeDay.sections?.notes}
                fallback={activeDay.notes || []}
              />

              <section className="ia-tile ia-tile-pad mb-2 fs-complete-card">
                <label className="fs-label">Session notes</label>
                <textarea
                  className="fs-textarea"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="How did it feel? Anything to remember for next week?"
                />

                {saveError ? <div className="fs-alert fs-alert-error mt-3">{saveError}</div> : null}
                {saveOk ? <div className="fs-alert fs-alert-ok mt-3">{saveOk}</div> : null}

                <button className="ia-btn-primary w-100 mt-3 fs-complete-btn" disabled={saving} onClick={saveSession}>
                  {saving ? "Saving..." : "Complete session"}
                </button>
              </section>
            </>
          ) : null}

          <section className="ia-tile ia-tile-pad mb-2">
            <div className="ia-card-title-compact">Strength progress</div>

            {lifts.length ? (
              <>
                <div className="ia-week-chip-row mt-2">
                  {lifts.map((lift) => (
                    <button
                      key={lift.exerciseId}
                      type="button"
                      className={selectedLift?.exerciseId === lift.exerciseId ? "ia-week-chip ia-week-chip-active" : "ia-week-chip"}
                      onClick={() => setSelectedLiftId(lift.exerciseId)}
                    >
                      {lift.exerciseName}
                    </button>
                  ))}
                </div>

                {selectedLift ? (
                  <>
                    <div className="row g-2 mt-2">
                      <div className="col-6">
                        <div className="ia-stat-mini">
                          <div className="ia-stat-mini-value">{formatKg(selectedLift.current)}</div>
                          <div className="ia-stat-mini-label">Current</div>
                        </div>
                      </div>

                      <div className="col-6">
                        <div className="ia-stat-mini">
                          <div className="ia-stat-mini-value">{formatKg(selectedLift.best)}</div>
                          <div className="ia-stat-mini-label">Best ever</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ height: 240, marginTop: 14 }}>
                      {liftChart ? (
                        <Line data={liftChart.data} options={liftChart.options} />
                      ) : (
                        <div className="fs-empty-chart">No strength history yet.</div>
                      )}
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className="text-dim small mt-2">
                Tracked lifts will appear here once the active block has tracked strength movements.
              </div>
            )}
          </section>

          <section className="ia-tile ia-tile-pad mb-2">
            <div className="ia-card-title-compact">Weight progress</div>

            <div style={{ height: 220, marginTop: 12 }}>
              {weightChart ? (
                <Line data={weightChart.data} options={weightChart.options} />
              ) : (
                <div className="fs-empty-chart">No weight history yet.</div>
              )}
            </div>
          </section>
        </main>
      )}

      <BottomNav />

      <style jsx>{`
        .fs-page {
          color: #fff;
          padding-bottom: 96px !important;
        }

        .fs-hero-card {
          background:
            radial-gradient(circle at top right, rgba(24, 255, 154, 0.12), transparent 34%),
            linear-gradient(180deg, rgba(14, 19, 27, 0.96) 0%, rgba(10, 14, 20, 0.96) 100%);
        }

        .fs-hero-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .fs-week-badge {
          min-width: 68px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 8px 10px;
          text-align: center;
        }

        .fs-week-badge span {
          display: block;
          color: var(--ia-muted);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 800;
        }

        .fs-week-badge strong {
          display: block;
          color: var(--ia-neon);
          font-size: 1.25rem;
          line-height: 1;
          margin-top: 4px;
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

        .fs-session-header {
          border-color: rgba(24, 255, 154, 0.14);
        }

        .fs-session-day {
          color: var(--ia-neon);
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 900;
        }

        .fs-session-title {
          font-size: 1.2rem;
          line-height: 1.1;
          font-weight: 900;
          margin-top: 4px;
        }

        .fs-section-card {
          overflow: hidden;
        }

        .fs-section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .fs-scheme-pill,
        .fs-duration-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 6px 10px;
          background: rgba(24, 255, 154, 0.09);
          border: 1px solid rgba(24, 255, 154, 0.18);
          color: #d9fff5;
          font-size: 0.76rem;
          font-weight: 850;
          line-height: 1;
        }

        .fs-duration-pill {
          flex: 0 0 auto;
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .fs-work-list {
          display: grid;
          gap: 8px;
        }

        .fs-work-row {
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

        .fs-work-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--ia-neon);
          margin-top: 6px;
          flex: 0 0 auto;
          box-shadow: 0 0 10px rgba(24, 255, 154, 0.36);
        }

        .fs-track-list {
          display: grid;
          gap: 10px;
        }

        .fs-track-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 92px;
          gap: 10px;
          align-items: center;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 11px;
        }

        .fs-track-title {
          color: #fff;
          font-weight: 800;
          line-height: 1.15;
        }

        .fs-track-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 6px;
          color: var(--ia-muted);
          font-size: 0.74rem;
          line-height: 1;
        }

        .fs-track-meta span {
          border-radius: 999px;
          padding: 4px 7px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .fs-track-input {
          width: 100%;
          min-height: 44px;
          border: 1px solid rgba(24, 255, 154, 0.18);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.25);
          color: #fff;
          font-weight: 900;
          text-align: center;
          outline: none;
        }

        .fs-track-input:focus,
        .fs-input:focus,
        .fs-textarea:focus {
          border-color: rgba(24, 255, 154, 0.42);
          box-shadow: 0 0 0 3px rgba(24, 255, 154, 0.12);
        }

        .fs-label {
          display: block;
          color: rgba(255, 255, 255, 0.84);
          font-size: 0.8rem;
          font-weight: 800;
          margin-bottom: 7px;
        }

        .fs-input,
        .fs-textarea {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.24);
          color: #fff;
          padding: 11px 12px;
          outline: none;
          font-size: 0.9rem;
        }

        .fs-textarea {
          min-height: 92px;
          resize: vertical;
        }

        .fs-complete-card {
          border-color: rgba(24, 255, 154, 0.14);
        }

        .fs-complete-btn {
          min-height: 44px !important;
          font-size: 0.92rem !important;
          border-radius: 14px !important;
        }

        .fs-alert {
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 0.86rem;
          font-weight: 700;
        }

        .fs-alert-error {
          background: rgba(255, 95, 115, 0.1);
          border: 1px solid rgba(255, 95, 115, 0.26);
          color: #ffb8c1;
        }

        .fs-alert-ok {
          background: rgba(24, 255, 154, 0.1);
          border: 1px solid rgba(24, 255, 154, 0.22);
          color: #d9fff5;
        }

        .fs-empty-note,
        .fs-empty-chart {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 78px;
          text-align: center;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed rgba(255, 255, 255, 0.12);
          color: var(--ia-muted);
          font-size: 0.84rem;
          padding: 12px;
        }

        @media (max-width: 520px) {
          .fs-hero-row {
            align-items: stretch;
          }

          .fs-week-badge {
            min-width: 62px;
          }

          .fs-track-row {
            grid-template-columns: 1fr;
          }

          .fs-track-input-wrap {
            width: 100%;
          }

          .fs-track-input {
            text-align: left;
            padding-left: 12px;
          }
        }
      `}</style>
    </>
  );
}
