
import React from "react";
import Link from "next/link";

type Props = {
  dayLabel: string;

  nutritionSummary?: { calories: number; protein: number };
  nutritionLogged: boolean;

  workoutSummary?: { calories: number; duration: number; weightUsed?: string };
  hasWorkout: boolean;
  workoutDone: boolean;

  habitSummary?: { completed: number; total: number };
  habitAllDone: boolean;

  checkinSummary?: { weight: number; bodyFat: number; weightChange?: number; bfChange?: number };
  checkinComplete: boolean;

  hrefs: {
    nutrition: string;
    workout: string;
    habit: string;
    checkin: string;
    freestyle?: string;    // new optional
  };

  userCalorieTarget?: number;
  userProteinTarget?: number;

  freestyleLogged?: boolean; 
  freestyleSummary?: { activity?: string; duration?: number; calories?: number };
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
  hrefs,
  userCalorieTarget = 2000,
  userProteinTarget = 150,
  freestyleLogged = false,
  freestyleSummary
}: Props) {
  const isFriday = dayLabel.toLowerCase().startsWith("fri");

  const workoutLocked = hrefs.workout === "#"; 
  const habitsLocked = hrefs.habit === "#";

  const rowStyle = (
    done: boolean,
    accent: string,
    locked?: boolean
  ): React.CSSProperties => ({
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
    boxShadow: done
      ? "0 0 12px rgba(100,195,122,0.5)"
      : `0 0 10px ${accent}33`,
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

  const valueStyle: React.CSSProperties = {
    opacity: 0.9,
    fontWeight: 600,
  };

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

  const RowWrapper: React.FC<{ href: string; locked?: boolean; children: React.ReactNode }> = ({
    href,
    locked,
    children,
  }) => {
    if (locked || href === "#") {
      return (
        <div aria-disabled="true" role="button" tabIndex={-1}>
          {children}
        </div>
      );
    }
    return <Link href={href}>{children as any}</Link>;
  };

  const freestyleHref = hrefs.freestyle ?? "/workouts/freestyle";

  const freestyleValue = (() => {
    if (!freestyleLogged) return "Optional · Not logged";
    const parts: string[] = [];
    if (freestyleSummary?.calories) parts.push(`${freestyleSummary.calories} kcal`);
    if (freestyleSummary?.duration) parts.push(`${freestyleSummary.duration} min`);
    if (freestyleSummary?.activity) parts.push(freestyleSummary.activity);
    return parts.join(" · ") || "Logged";
  })();

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: 12 }}>
        {dayLabel} Tasks
      </div>

      {/* Nutrition (always available) */}
      <RowWrapper href={hrefs.nutrition}>
        <div style={rowStyle(nutritionLogged, "#4fa3a5")}>
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

      {/* Workout (premium-locked for some users) */}
      {hasWorkout && (
        <RowWrapper href={hrefs.workout} locked={workoutLocked}>
          <div style={rowStyle(workoutDone, "#5b7c99", workoutLocked)}>
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
                  }${workoutSummary?.weightUsed ? ` · ${workoutSummary.weightUsed}` : ""}`
                : workoutLocked
                ? "Locked"
                : "Pending"}
            </span>
          </div>
        </RowWrapper>
      )}

      {/* Freestyle Session — OPTIONAL — never locked — never counts towards streak */}
      <RowWrapper href={freestyleHref}>
        <div style={rowStyle(freestyleLogged, "#ff7f32")}>
          <span style={iconWrap}>
            <i className="fas fa-stopwatch" style={{ color: "#ff7f32" }} />
            <span>Freestyle Session</span>
          </span>
          <span style={valueStyle}>{freestyleValue}</span>
        </div>
      </RowWrapper>

      {/* Habits */}
      <RowWrapper href={hrefs.habit} locked={habitsLocked}>
        <div style={rowStyle(habitAllDone, "#9b6fa3", habitsLocked)}>
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
            {habitSummary
              ? `${habitSummary.completed}/${habitSummary.total} tasks`
              : habitsLocked
              ? "Locked"
              : "Not started"}
          </span>
        </div>
      </RowWrapper>

      {/* Weekly Check‑In */}
      {isFriday && (
        <RowWrapper href={hrefs.checkin}>
          <div style={rowStyle(checkinComplete, "#c9a34e")}>
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
