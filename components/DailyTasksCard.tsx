import React from "react";
import Link from "next/link";

const ACCENT = "#FF8A2A";

type SimpleWorkoutRef = { id: string; name?: string };

type Props = {
  dayLabel: string;

  // Nutrition
  nutritionSummary?: { calories: number; protein: number };
  nutritionLogged: boolean;

  // Mandatory workout (summary for the main/mandatory track)
  workoutSummary?: { calories: number; duration: number; weightUsed?: string };
  hasWorkout: boolean;
  workoutDone: boolean;

  // Habits
  habitSummary?: { completed: number; total: number };
  habitAllDone: boolean;

  // Weekly check-in
  checkinSummary?: { weight: number; bodyFat: number; weightChange?: number; bfChange?: number };
  checkinComplete: boolean;

  // Recurring vs Optional split
  hasRecurringToday?: boolean;
  recurringDone?: boolean;
  recurringWorkouts?: SimpleWorkoutRef[];
  optionalWorkouts?: SimpleWorkoutRef[];

  // NEW: Optional completion state/summary
  optionalDone?: boolean;
  optionalSummary?: { calories: number; duration: number; weightUsed?: string };

  // Hrefs
  hrefs: {
    nutrition: string;
    workout: string; // used only when no recurring
    habit: string;
    checkin: string;
    freestyle?: string;
    recurring?: string; // kept for back-compat; we compute per-item hrefs now
    optionalWorkout?: string; // kept for back-compat; we compute per-item hrefs now
  };

  // Targets
  userCalorieTarget?: number;
  userProteinTarget?: number;

  // Freestyle
  freestyleLogged?: boolean;
  freestyleSummary?: {
    activity_type?: string | null;
    duration?: number | null;
    calories_burned?: number | null;
    weight_completed_with?: number | null;
  };
};

export default function DailyTasksCard({
  dayLabel,
  nutritionSummary,
  nutritionLogged,

  workoutSummary,
  hasWorkout,
  workoutDone,

  habitSummary,
  habitAllDone,

  checkinSummary,
  checkinComplete,

  hasRecurringToday = false,
  recurringDone = false,
  recurringWorkouts = [],
  optionalWorkouts = [],

  optionalDone = false,
  optionalSummary,

  hrefs,

  userCalorieTarget = 2000,
  userProteinTarget = 150,

  freestyleLogged = false,
  freestyleSummary,
}: Props) {
  const isFriday = dayLabel.toLowerCase().startsWith("fri");
  const workoutLocked = hrefs.workout === "#";
  const habitsLocked = hrefs.habit === "#";

  const rowStyle = (done: boolean, accent: string, locked?: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 18px",
    marginBottom: 10,
    borderRadius: 12,
    background: done ? "rgba(100,195,122,0.12)" : "rgba(255,255,255,0.06)",
    backdropFilter: "blur(8px)",
    border: `1px solid ${done ? "rgba(100,195,122,0.35)" : "rgba(255,255,255,0.12)"}`,
    color: "#fff",
    boxShadow: done ? "0 0 12px rgba(100,195,122,0.5)" : `0 0 10px ${accent}33`,
    cursor: locked ? "not-allowed" : "pointer",
    transition: "transform .18s ease, box-shadow .18s ease",
    opacity: locked ? 0.85 : 1,
  });

  const iconWrap: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 600,
  };

  const valueStyle: React.CSSProperties = { opacity: 0.9, fontWeight: 600 };

  const premiumTag = (accent: string): JSX.Element => (
    <span
      style={{
        marginLeft: 8,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: "0.7rem",
        fontWeight: 700,
        color: "#0a0a0c",
        background: accent,
        boxShadow: `0 0 8px ${accent}77`,
      }}
    >
      Premium
    </span>
  );

  const RowWrapper: React.FC<{ href: string; locked?: boolean; children: React.ReactNode; ariaLabel?: string }> = ({
    href,
    locked,
    children,
    ariaLabel,
  }) => {
    if (locked || href === "#") {
      return (
        <div aria-disabled="true" role="button" tabIndex={-1} aria-label={ariaLabel}>
          {children}
        </div>
      );
    }
    return (
      <Link href={href} aria-label={ariaLabel ?? "Open task"}>
        {children as any}
      </Link>
    );
  };

  const freestyleHref = hrefs.freestyle ?? "/workouts/freestyle";

  const freestyleValue = (() => {
    if (!freestyleLogged) return "Optional · Not logged";
    const parts: string[] = [];
    if (freestyleSummary?.activity_type) parts.push(freestyleSummary.activity_type);
    if (typeof freestyleSummary?.duration === "number") parts.push(`${freestyleSummary.duration} min`);
    if (typeof freestyleSummary?.calories_burned === "number") parts.push(`${freestyleSummary.calories_burned} kcal`);
    return parts.join(" · ") || "Logged";
  })();

  // ---------- Resolve completion states from boolean or summaries ----------
  const hasWorkoutSummary =
    typeof workoutSummary?.calories === "number" ||
    typeof workoutSummary?.duration === "number" ||
    (workoutSummary?.weightUsed && workoutSummary.weightUsed.length > 0);

  const hasOptionalSummary =
    typeof optionalSummary?.calories === "number" ||
    typeof optionalSummary?.duration === "number" ||
    (optionalSummary?.weightUsed && optionalSummary.weightUsed.length > 0);

  const recurringDoneResolved = Boolean(recurringDone || hasWorkoutSummary);
  const optionalDoneResolved = Boolean(optionalDone || hasOptionalSummary);

  // Precompute per-item href creators (we derive per-item now rather than using single hrefs)
  const recurringHrefFor = (id: string) => `/gymworkout/${encodeURIComponent(id)}`;
  const optionalHrefFor = (id: string) => `/workout/${encodeURIComponent(id)}`;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: 12 }}>
        {dayLabel} Tasks
      </div>

      {/* Nutrition */}
      <RowWrapper href={hrefs.nutrition} ariaLabel="Open nutrition">
        <div style={rowStyle(nutritionLogged, "#4fa3a5")} aria-live="polite" aria-label="Nutrition">
          <span style={iconWrap}>
            <i className="fas fa-utensils" style={{ color: "#4fa3a5" }} />
            <span>Nutrition</span>
          </span>
          <span style={valueStyle}>
            {nutritionSummary
              ? `${nutritionSummary.calories} / ${userCalorieTarget} kcal | ${nutritionSummary.protein} / ${userProteinTarget} p`
              : "Not logged"}
          </span>
        </div>
      </RowWrapper>

      {/* Recurring Workouts (MANDATORY) — render ALL recurring items */}
      {hasRecurringToday && Array.isArray(recurringWorkouts) && recurringWorkouts.length > 0 && (
        <>
          {recurringWorkouts.map((w, idx) => {
            const name = (w?.name ?? "Recurring Workout").trim();
            const href = recurringHrefFor(String(w.id));
            return (
              <RowWrapper
                key={`${w.id}-${idx}`}
                href={href}
                ariaLabel={`Open mandatory workout: ${name}`}
              >
                <div
                  style={rowStyle(recurringDoneResolved, "#5b7c99")}
                  aria-label="Recurring workout (mandatory)"
                  aria-live="polite"
                >
                  <span style={iconWrap}>
                    <i className="fas fa-dumbbell" style={{ color: "#5b7c99" }} />
                    <span>{name}</span>
                    <span
                      className="ms-2"
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "#0a0a0c",
                        background: ACCENT,
                        boxShadow: `0 0 8px ${ACCENT}77`,
                      }}
                      title="Counts towards your daily tasks"
                    >
                      Mandatory
                    </span>
                  </span>
                  <span style={valueStyle}>
                    {recurringDoneResolved
                      ? `${workoutSummary?.calories ?? 0} kcal${
                          workoutSummary?.duration ? ` · ${Math.round(workoutSummary.duration)} min` : ""
                        }${workoutSummary?.weightUsed ? ` · ${workoutSummary.weightUsed}` : ""}`
                      : "Pending"}
                  </span>
                </div>
              </RowWrapper>
            );
          })}
        </>
      )}

      {/* Planned Workout when NO recurring (single row; unchanged) */}
      {!hasRecurringToday && hasWorkout && (
        <RowWrapper href={hrefs.workout} locked={workoutLocked} ariaLabel="Open planned workout">
          <div style={rowStyle(Boolean(workoutDone), "#5b7c99", workoutLocked)} aria-label="Planned workout" aria-live="polite">
            <span style={iconWrap}>
              {workoutLocked ? (
                <i className="fas fa-lock" style={{ color: "#5b7c99" }} />
              ) : (
                <i className="fas fa-dumbbell" style={{ color: "#5b7c99" }} />
              )}
              <span>Workout</span>
              {workoutLocked && premiumTag("#5b7c99")}
            </span>
            <span style={valueStyle}>
              {workoutDone
                ? `${workoutSummary?.calories || 0} kcal${
                    workoutSummary?.duration ? ` · ${Math.round(workoutSummary.duration)} min` : ""
                  }${workoutSummary?.weightUsed ? ` · ${workoutSummary?.weightUsed}` : ""}`
                : workoutLocked
                ? "Locked"
                : "Pending"}
            </span>
          </div>
        </RowWrapper>
      )}

      {/* BXKR Optional Workouts — render ALL optional items */}
      {hasRecurringToday && Array.isArray(optionalWorkouts) && optionalWorkouts.length > 0 && (
        <>
          {optionalWorkouts.map((w, idx) => {
            const name = (w?.name ?? "BXKR Workout").trim();
            const href = optionalHrefFor(String(w.id));
            return (
              <RowWrapper
                key={`${w.id}-${idx}`}
                href={href}
                ariaLabel={`Open optional BXKR workout: ${name}`}
              >
                <div
                  style={rowStyle(optionalDoneResolved, "#7a8793")}
                  aria-label="Optional BXKR workout"
                  aria-live="polite"
                  title="Optional session — does not affect your daily task count"
                >
                  <span style={iconWrap}>
                    <i className="fas fa-dumbbell" style={{ color: "#7a8793" }} />
                    <span>{name}</span>
                    <span
                      className="ms-2"
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        color: "#0a0a0c",
                        background: "rgba(255,255,255,0.65)",
                      }}
                    >
                      Optional
                    </span>
                  </span>
                  <span style={valueStyle}>
                    {optionalDoneResolved
                      ? `${optionalSummary?.calories || 0} kcal${
                          optionalSummary?.duration ? ` · ${Math.round(optionalSummary.duration)} min` : ""
                        }${optionalSummary?.weightUsed ? ` · ${optionalSummary.weightUsed}` : ""}`
                      : "Pending"}
                  </span>
                </div>
              </RowWrapper>
            );
          })}
        </>
      )}

      {/* Freestyle */}
      <RowWrapper href={freestyleHref} ariaLabel="Open freestyle session">
        <div style={rowStyle(!!freestyleLogged, "#ff7f32")} aria-label="Freestyle session" aria-live="polite">
          <span style={iconWrap}>
            <i className="fas fa-stopwatch" style={{ color: "#ff7f32" }} />
            <span>Freestyle Session</span>
          </span>
          <span style={valueStyle}>{freestyleValue}</span>
        </div>
      </RowWrapper>

      {/* Habits */}
      <RowWrapper href={hrefs.habit} locked={habitsLocked} ariaLabel="Open daily habit">
        <div style={rowStyle(habitAllDone, "#9b6fa3", habitsLocked)} aria-label="Daily habit" aria-live="polite">
          <span style={iconWrap}>
            {habitsLocked ? (
              <i className="fas fa-lock" style={{ color: "#9b6fa3" }} />
            ) : (
              <i className="fas fa-check-circle" style={{ color: "#9b6fa3" }} />
            )}
            <span>Daily Habit</span>
            {habitsLocked && premiumTag("#9b6fa3")}
          </span>
          <span style={valueStyle}>
            {habitSummary ? `${habitSummary.completed}/${habitSummary.total} tasks` : habitsLocked ? "Locked" : "Not started"}
          </span>
        </div>
      </RowWrapper>

      {/* Check‑In */}
      {isFriday && (
        <RowWrapper href={hrefs.checkin} ariaLabel="Open check-in">
          <div style={rowStyle(checkinComplete, "#c9a34e")} aria-label="Weekly check-in" aria-live="polite">
            <span style={iconWrap}>
              <i className="fas fa-clipboard-list" style={{ color: "#c9a34e" }} />
              <span>Check‑In</span>
            </span>
            <span style={valueStyle}>
              {checkinSummary
                ? (() => {
                    const w = `W: ${checkinSummary.weight}kg`;
                    const wchg =
                      typeof checkinSummary.weightChange === "number"
                        ? ` (${checkinSummary.weightChange.toFixed(1)}%)`
                        : "";
                    const bf = ` | BF: ${checkinSummary.bodyFat}%`;
                    return `${w}${wchg}${bf}`;
                  })()
                : "Not done"}
            </span>
          </div>
        </RowWrapper>
      )}
    </div>
  );
}
