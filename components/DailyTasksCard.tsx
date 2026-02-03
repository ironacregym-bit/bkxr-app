// components/DailyTasksCard.tsx
import React from "react";
import Link from "next/link";

const ACCENT = "#FF8A2A";

type SimpleWorkoutRef = { id: string; name?: string };

type Props = {
  dayLabel: string;

  // Nutrition
  nutritionSummary?: { calories: number; protein: number };
  nutritionLogged: boolean;

  // Mandatory workout
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
    workout: string;   // used only when no recurring
    habit: string;
    checkin: string;
    freestyle?: string;
    recurring?: string;
    optionalWorkout?: string;
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
  freestyleSummary
}: Props) {
  const isFriday = dayLabel.toLowerCase().startsWith("fri");
  const workoutLocked = hrefs.workout === "#";
  const habitsLocked = hrefs.habit === "#";

  const firstRecurring = Array.isArray(recurringWorkouts) && recurringWorkouts[0] ? recurringWorkouts[0] : null;
  const firstOptional = Array.isArray(optionalWorkouts) && optionalWorkouts[0] ? optionalWorkouts[0] : null;

  const recurringHref = hrefs.recurring ?? (firstRecurring ? `/gymworkout/${encodeURIComponent(firstRecurring.id)}` : "#");
  const optionalHref = hrefs.optionalWorkout ?? (firstOptional ? `/workout/${encodeURIComponent(firstOptional.id)}` : "#");

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
    ariaLabel
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

  const optionalWorkoutLabel = (() => {
    const base = firstOptional?.name?.trim() || "BXKR Workout";
    const extra = optionalWorkouts.length > 1 ? ` (+${optionalWorkouts.length - 1} more)` : "";
    return base + extra;
  })();

  const recurringWorkoutLabel = (() => {
    const base = firstRecurring?.name?.trim() || "Recurring Workout";
    const extra = recurringWorkouts.length > 1 ? ` (+${recurringWorkouts.length - 1} more)` : "";
    return base + extra;
  })();

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

      {/* Recurring Workout (MANDATORY) */}
      {hasRecurringToday && firstRecurring && (
        <RowWrapper href={recurringHref} ariaLabel="Open recurring workout (mandatory)">
          <div style={rowStyle(Boolean(recurringDone), "#5b7c99")} aria-label="Recurring workout (mandatory)" aria-live="polite">
            <span style={iconWrap}>
              <i className="fas fa-dumbbell" style={{ color: "#5b7c99" }} />
              <span>{recurringWorkoutLabel}</span>
              <span
                className="ms-2"
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: "0.7rem",
                  fontWeight: 800,
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
              {recurringDone
                ? `${workoutSummary?.calories || 0} kcal${
                    workoutSummary?.duration ? ` · ${Math.round(workoutSummary.duration)} min` : ""
                  }${workoutSummary?.weightUsed ? ` · ${workoutSummary.weightUsed}` : ""}`
                : "Pending"}
            </span>
          </div>
        </RowWrapper>
      )}

      {/* Planned Workout when NO recurring */}
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

      {/* BXKR Optional Workout — now reflects completion */}
      {hasRecurringToday && firstOptional && (
        <RowWrapper href={optionalHref} ariaLabel="Open optional BXKR workout">
          <div
            style={rowStyle(Boolean(optionalDone), "#7a8793")}
            aria-label="Optional BXKR workout"
            aria-live="polite"
            title="Optional session — does not affect your daily task count"
          >
            <span style={iconWrap}>
              <i className="fas fa-dumbbell" style={{ color: "#7a8793" }} />
              <span>{optionalWorkoutLabel}</span>
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
              {optionalDone
                ? `${optionalSummary?.calories || 0} kcal${
                    optionalSummary?.duration ? ` · ${Math.round(optionalSummary.duration)} min` : ""
                  }${optionalSummary?.weightUsed ? ` · ${optionalSummary.weightUsed}` : ""}`
                : "Optional · Pending"}
            </span>
          </div>
        </RowWrapper>
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
