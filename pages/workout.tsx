// pages/train.tsx
"use client";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type SimpleWorkoutRef = {
  id: string;
  name?: string;
  order?: number;
  programId?: string;
};

type CurrentProgram = {
  assignment_id: string;
  program_id: string;
  program_name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  weeks: number;
  current_week: number | null;
  is_active_today: boolean;
} | null;

type HomeDayOverview = {
  dateKey: string;
  hasWorkout?: boolean;
  workoutDone?: boolean;
  workoutIds?: string[];
  programmedWorkouts?: SimpleWorkoutRef[];
  hasRecurringToday?: boolean;
  recurringWorkouts: SimpleWorkoutRef[];
  recurringDone: boolean;
  optionalWorkouts?: SimpleWorkoutRef[];
};

type HomeOverviewResponse = {
  weekStartYMD: string;
  weekEndYMD: string;
  fridayYMD: string;
  todayYMD: string;
  days: HomeDayOverview[];
  currentProgram?: CurrentProgram;
  weeklyTotals?: {
    totalTasks: number;
    completedTasks: number;
    totalWorkoutsCompleted: number;
    totalWorkoutTime: number;
    totalCaloriesBurned: number;
  };
};

type ProgramsWeeklyResponse = {
  weekStartYMD: string;
  weekEndYMD: string;
  days: Record<string, SimpleWorkoutRef[]>;
  debug?: {
    programsMatched: number;
    programsActiveInWeek: number;
    scheduleRowsRead: number;
    uniqueWorkoutIds: number;
    assignmentsMatched?: number;
  };
};

type WeeklyOverviewDay = {
  dateKey: string;
  hasWorkout: boolean;
  workoutDone: boolean;
  workoutIds: string[];
  hasRecurringToday: boolean;
  recurringWorkouts: SimpleWorkoutRef[];
  recurringDone: boolean;
  optionalWorkouts: SimpleWorkoutRef[];
};

type WeeklyOverviewResponse = {
  weekStartYMD: string;
  weekEndYMD: string;
  fridayYMD: string;
  days: WeeklyOverviewDay[];
  weeklyTotals: {
    totalTasks: number;
    completedTasks: number;
    totalWorkoutsCompleted: number;
    totalWorkoutTime: number;
    totalCaloriesBurned: number;
  };
};

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const DAY_SHORT: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

function formatYMD(d: Date) {
  return d.toLocaleDateString("en-CA");
}

function parseYMD(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function startOfAlignedWeek(d: Date) {
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const out = new Date(d);
  out.setDate(d.getDate() - diffToMon);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function formatDisplayDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function toDateOrNull(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function getWeekStartForProgramWeek(startDate: string | null, weekNumber: number) {
  const base = toDateOrNull(startDate) || new Date();
  const shifted = addDays(base, Math.max(0, weekNumber - 1) * 7);
  return startOfAlignedWeek(shifted);
}

function getDayDateFromWeekStart(weekStartYMD: string, dayName: string) {
  const start = parseYMD(weekStartYMD);
  const idx = DAY_ORDER.indexOf(dayName as (typeof DAY_ORDER)[number]);
  if (idx < 0) return null;
  return addDays(start, idx);
}

function getHomeDayWorkouts(day?: HomeDayOverview): SimpleWorkoutRef[] {
  if (!day) return [];

  const recurring = Array.isArray(day.recurringWorkouts) ? day.recurringWorkouts : [];
  if (recurring.length) return recurring;

  const programmed = Array.isArray(day.programmedWorkouts) ? day.programmedWorkouts : [];
  if (programmed.length) return programmed;

  return [];
}

function getDayHref(workout?: SimpleWorkoutRef | null, dateYMD?: string | null) {
  if (!workout?.id) return "#";
  return `/gymworkout/${encodeURIComponent(workout.id)}${
    dateYMD ? `?date=${encodeURIComponent(dateYMD)}` : ""
  }`;
}

function compactCountLabel(count: number, singular: string, plural?: string) {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural || `${singular}s`}`;
}

function LoadingCard({ title }: { title: string }) {
  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex align-items-center justify-content-between">
        <div className="ia-card-title-compact">{title}</div>
        <i className="fas fa-spinner fa-spin text-dim" />
      </div>
    </section>
  );
}

function EmptyTrainState() {
  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="ia-card-title-compact">No active programme</div>
      <div className="text-dim small mt-1">
        Your workouts will appear here once a programme or recurring gym workouts have been
        assigned.
      </div>
      <div className="mt-3">
        <Link href="/iron-acre" className="ia-btn ia-btn-muted">
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}

export default function WorkoutHubPage() {
  const { data: session, status } = useSession();

  const [mounted, setMounted] = useState(false);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === "loading") return;

    if (!session && typeof window !== "undefined") {
      window.location.replace(`/register?callbackUrl=${encodeURIComponent("/train")}`);
    }
  }, [mounted, session, status]);

  const userEmail = String(session?.user?.email || "").trim().toLowerCase();
  const isAuthed = Boolean(userEmail);

  const currentWeekStartYMD = useMemo(() => {
    return formatYMD(startOfAlignedWeek(new Date()));
  }, []);

  const { data: currentHomeOverview, error: currentHomeErr } = useSWR<HomeOverviewResponse>(
    mounted && isAuthed
      ? `/api/iron-acre/home-overview?week=${encodeURIComponent(currentWeekStartYMD)}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  const currentProgram = currentHomeOverview?.currentProgram || null;

  useEffect(() => {
    if (!currentProgram) return;
    if (selectedWeekNumber != null) return;

    const weekNum = Math.max(1, Number(currentProgram.current_week || 1));
    setSelectedWeekNumber(weekNum);
  }, [currentProgram, selectedWeekNumber]);

  const effectiveWeekNumber = useMemo(() => {
    if (!currentProgram) return 1;

    return Math.max(
      1,
      Math.min(
        Number(selectedWeekNumber || currentProgram.current_week || 1),
        Number(currentProgram.weeks || 1)
      )
    );
  }, [currentProgram, selectedWeekNumber]);

  const selectedWeekStartYMD = useMemo(() => {
    if (!currentProgram?.start_date) return currentWeekStartYMD;
    return formatYMD(getWeekStartForProgramWeek(currentProgram.start_date, effectiveWeekNumber));
  }, [currentProgram, effectiveWeekNumber, currentWeekStartYMD]);

  const { data: selectedProgramsWeekly, error: selectedProgramsErr } =
    useSWR<ProgramsWeeklyResponse>(
      mounted && isAuthed && currentProgram
        ? `/api/programs/weekly?week=${encodeURIComponent(selectedWeekStartYMD)}`
        : null,
      fetcher,
      {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
      }
    );

  const { data: selectedWeeklyOverview, error: selectedOverviewErr } =
    useSWR<WeeklyOverviewResponse>(
      mounted && isAuthed && currentProgram
        ? `/api/weekly/overview?week=${encodeURIComponent(selectedWeekStartYMD)}`
        : null,
      fetcher,
      {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
      }
    );

  const thisWeekCards = useMemo(() => {
    const days = currentHomeOverview?.days || [];

    const cards = days
      .map((day) => {
        const workouts = getHomeDayWorkouts(day);
        if (!workouts.length) return null;

        const first = workouts[0] || null;
        const href = getDayHref(first, day.dateKey);
        const done = day.hasRecurringToday ? Boolean(day.recurringDone) : Boolean(day.workoutDone);

        return {
          dateKey: day.dateKey,
          title: first?.name || "Workout",
          extraCount: Math.max(0, workouts.length - 1),
          done,
          href,
          dayLabel: day.dateKey
            ? new Date(`${day.dateKey}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
              })
            : "",
        };
      })
      .filter(Boolean) as Array<{
      dateKey: string;
      title: string;
      extraCount: number;
      done: boolean;
      href: string;
      dayLabel: string;
    }>;

    cards.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    return cards;
  }, [currentHomeOverview]);

  const selectedWeekSchedule = useMemo(() => {
    const map = selectedProgramsWeekly?.days || {};
    const overviewByDate = new Map(
      (selectedWeeklyOverview?.days || []).map((d) => [d.dateKey, d] as const)
    );

    return DAY_ORDER.map((dayName) => {
      const date = getDayDateFromWeekStart(selectedWeekStartYMD, dayName);
      const ymd = date ? formatYMD(date) : "";
      const workouts = Array.isArray(map[ymd]) ? map[ymd] : [];
      const first = workouts[0] || null;
      const overview = overviewByDate.get(ymd);

      const done = Boolean(overview?.workoutDone);
      const isToday = ymd === formatYMD(new Date());
      const href = first ? getDayHref(first, ymd) : "#";

      return {
        dayName,
        ymd,
        workouts,
        first,
        done,
        isToday,
        href,
      };
    });
  }, [selectedProgramsWeekly, selectedWeeklyOverview, selectedWeekStartYMD]);

  const selectedWeekStats = useMemo(() => {
    const dayCards = selectedWeekSchedule.filter((d) => d.workouts.length > 0);
    const total = dayCards.length;
    const completed = dayCards.filter((d) => d.done).length;
    const remaining = Math.max(0, total - completed);
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      remaining,
      pct,
    };
  }, [selectedWeekSchedule]);

  const programmeProgressPct = useMemo(() => {
    if (!currentProgram?.weeks || !effectiveWeekNumber) return 0;
    const pct = Math.round((effectiveWeekNumber / Number(currentProgram.weeks)) * 100);
    return Math.max(0, Math.min(100, pct));
  }, [currentProgram, effectiveWeekNumber]);

  const loading = !mounted || status === "loading";
  const thisWeekLoading = isAuthed && !currentHomeOverview && !currentHomeErr;
  const scheduleLoading =
    isAuthed &&
    !!currentProgram &&
    ((!selectedProgramsWeekly && !selectedProgramsErr) ||
      (!selectedWeeklyOverview && !selectedOverviewErr));

  if (loading) {
    return (
      <>
        <Head>
          <title>Train • Iron Acre Gym</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </Head>

        <main className="container py-3 ia-train-page">
          <LoadingCard title="Loading Train" />
        </main>

        <BottomNav />
      </>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Train • Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-2 ia-train-page">
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-kicker">
            <i className="fas fa-dumbbell" />
            plan
          </div>

          <div className="d-flex justify-content-between align-items-start gap-2 mt-1">
            <div className="ia-train-header-copy">
              <div className="ia-page-title">Train</div>
              <div className="ia-page-subtitle">
                Your personalised training schedule and current programme.
              </div>
            </div>

            <div className="d-flex gap-2">
              <Link href="/workouts/freestyle" className="ia-btn ia-btn-muted">
                <i className="fas fa-plus" />
              </Link>

              <Link href="/schedule" className="ia-btn ia-btn-muted">
                <i className="fas fa-calendar-alt" />
              </Link>
            </div>
          </div>
        </section>

        {thisWeekLoading ? (
          <LoadingCard title="This week" />
        ) : (
          <section className="ia-tile ia-tile-pad mb-3">
            <div className="d-flex justify-content-between align-items-center gap-2">
              <div>
                <div className="ia-card-title-compact">This week</div>
                <div className="text-dim small mt-1">
                  {currentHomeOverview?.weekStartYMD || ""} → {currentHomeOverview?.weekEndYMD || ""}
                </div>
              </div>
            </div>

            {thisWeekCards.length === 0 ? (
              <div className="text-dim small mt-3">No workouts scheduled this week yet.</div>
            ) : (
              <div className="row g-2 mt-3">
                {thisWeekCards.map((card) => (
                  <div key={card.dateKey} className="col-6">
                    <Link href={card.href} className="ia-link-no-underline">
                      <div
                        className={`ia-train-pill-card ${
                          card.done ? "ia-train-pill-card-done" : ""
                        }`}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <span className="ia-day-pill">{card.dayLabel}</span>
                          <span className={card.done ? "ia-badge ia-badge-neon" : "ia-badge"}>
                            {card.done ? "Done" : "Open"}
                          </span>
                        </div>

                        <div className="ia-train-pill-title mt-2">{card.title}</div>

                        <div className="text-dim small mt-1">
                          {card.extraCount > 0 ? `+${card.extraCount} more` : "Scheduled"}
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {!currentProgram ? (
          <EmptyTrainState />
        ) : (
          <>
            <section className="ia-tile ia-tile-pad mb-3">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div className="ia-train-header-copy">
                  <div className="ia-card-title-compact">
                    {currentProgram.program_name || "Active programme"}
                  </div>
                  <div className="text-dim small mt-1">
                    Week {effectiveWeekNumber} of {currentProgram.weeks || 1}
                  </div>
                </div>

                <div className="ia-week-badge ia-week-badge-compact">
                  <strong>Week {effectiveWeekNumber}</strong>
                </div>
              </div>

              <div className="mt-3">
                <div className="d-flex justify-content-between align-items-center small mb-2">
                  <span className="text-dim">Programme progress</span>
                  <span className="fw-semibold">{programmeProgressPct}%</span>
                </div>

                <div className="ia-progress-track">
                  <div className="ia-progress-fill" style={{ width: `${programmeProgressPct}%` }} />
                </div>
              </div>

              <div className="row g-2 mt-2">
                <div className="col-4">
                  <div className="ia-stat-mini">
                    <div className="ia-stat-mini-value">{selectedWeekStats.completed}</div>
                    <div className="ia-stat-mini-label">Completed</div>
                  </div>
                </div>

                <div className="col-4">
                  <div className="ia-stat-mini">
                    <div className="ia-stat-mini-value">{selectedWeekStats.remaining}</div>
                    <div className="ia-stat-mini-label">Remaining</div>
                  </div>
                </div>

                <div className="col-4">
                  <div className="ia-stat-mini">
                    <div className="ia-stat-mini-value">
                      {currentProgram.end_date
                        ? formatDisplayDate(new Date(currentProgram.end_date))
                        : "—"}
                    </div>
                    <div className="ia-stat-mini-label">End date</div>
                  </div>
                </div>
              </div>
            </section>

            {Number(currentProgram.weeks || 0) > 1 ? (
              <section className="ia-tile ia-tile-pad mb-3">
                <div className="ia-kicker">
                  <i className="fas fa-layer-group" />
                  programme weeks
                </div>

                <div className="ia-week-chip-row mt-2">
                  {Array.from(
                    { length: Number(currentProgram.weeks || 0) },
                    (_, i) => i + 1
                  ).map((weekNum) => {
                    const active = weekNum === effectiveWeekNumber;

                    return (
                      <button
                        key={weekNum}
                        type="button"
                        className={active ? "ia-week-chip ia-week-chip-active" : "ia-week-chip"}
                        onClick={() => setSelectedWeekNumber(weekNum)}
                      >
                        W{weekNum}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {scheduleLoading ? (
              <LoadingCard title="Week schedule" />
            ) : (
              <section className="ia-tile ia-tile-pad mb-3">
                <div className="d-flex justify-content-between align-items-center gap-2">
                  <div>
                    <div className="ia-card-title-compact">Week {effectiveWeekNumber} schedule</div>
                    <div className="text-dim small mt-1">
                      {selectedProgramsWeekly?.weekStartYMD || selectedWeekStartYMD} →{" "}
                      {selectedProgramsWeekly?.weekEndYMD || ""}
                    </div>
                  </div>
                </div>

                <div className="row g-2 mt-2">
                  {selectedWeekSchedule.map((day) => {
                    const hasWorkout = day.workouts.length > 0;
                    const cardClasses = [
                      "ia-schedule-day-card",
                      hasWorkout ? "" : "ia-schedule-day-card-empty",
                      day.done ? "ia-schedule-day-card-done" : "",
                      day.isToday ? "ia-schedule-day-card-today" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    const title = day.first?.name || "Rest / no workout";
                    const countText = hasWorkout
                      ? compactCountLabel(day.workouts.length, "workout")
                      : "No scheduled workout";

                    const cardInner = (
                      <div className={cardClasses}>
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div>
                            <div className="ia-schedule-day-label">{DAY_SHORT[day.dayName]}</div>
                            <div className="ia-schedule-day-date">
                              {day.ymd
                                ? new Date(`${day.ymd}T00:00:00`).toLocaleDateString(undefined, {
                                    day: "numeric",
                                    month: "short",
                                  })
                                : ""}
                            </div>
                          </div>

                          {day.done ? (
                            <span className="ia-badge ia-badge-neon">Complete</span>
                          ) : day.isToday ? (
                            <span className="ia-badge">Today</span>
                          ) : null}
                        </div>

                        <div className="ia-schedule-day-title mt-2">{title}</div>
                        <div className="text-dim small mt-1">{countText}</div>

                        {hasWorkout && day.workouts.length > 1 ? (
                          <div className="text-dim small mt-1">
                            +{day.workouts.length - 1} more in this day
                          </div>
                        ) : null}

                        {hasWorkout ? (
                          <div className="mt-3">
                            <span className={day.isToday ? "ia-pill-highlight" : "ia-pill-muted"}>
                              {day.isToday ? "Today" : day.done ? "Review" : "Open"}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );

                    return (
                      <div key={`${day.dayName}-${day.ymd}`} className="col-12 col-md-6">
                        {hasWorkout ? (
                          <Link href={day.href} className="ia-link-no-underline">
                            {cardInner}
                          </Link>
                        ) : (
                          cardInner
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-center gap-2">
            <div>
              <div className="ia-card-title-compact">Exercise library</div>
              <div className="text-dim small mt-1">
                Browse movement guidance, exercise options and reference material.
              </div>
            </div>

            <Link href="/exercise-library" className="ia-btn ia-btn-primary">
              Open library
            </Link>
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
