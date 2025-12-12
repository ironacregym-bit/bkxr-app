
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
  hrefs: { nutrition: string; workout: string; habit: string; checkin: string };
  userCalorieTarget?: number;
  userProteinTarget?: number;
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
  userProteinTarget = 150
}: Props) {
  const isFriday = typeof dayLabel === "string" && dayLabel.toLowerCase().startsWith("fri");

  const rowStyle = (done: boolean, accent: string): React.CSSProperties => ({
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
      ? "0 0 12px rgba(100,195,122,0.5), 0 4px 20px rgba(0,0,0,0.35)"
      : `0 0 10px ${accent}33, 0 4px 16px rgba(0,0,0,0.35)`,
    cursor: "pointer",
    transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease"
  });

  const iconWrap: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 600
  };

  const valueStyle: React.CSSProperties = {
    opacity: 0.9,
    fontWeight: 600
  };

  const onHover = (e: React.MouseEvent<HTMLDivElement>) => {
    (e.currentTarget.style.transform as any) = "scale(1.02)";
  };
  const onLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    (e.currentTarget.style.transform as any) = "scale(1)";
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: 12, letterSpacing: 0.2 }}>
        {dayLabel} Tasks
      </div>

      {/* Nutrition */}
      <Link href={hrefs.nutrition} aria-label="Open Nutrition">
        <div
          style={rowStyle(nutritionLogged, "#4fa3a5")}
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
          className="futuristic-card"
        >
          <span style={iconWrap}>
            <i className="fas fa-utensils" style={{ color: "#4fa3a5" }} />
            <span>Nutrition</span>
          </span>
          <span style={valueStyle}>
            {nutritionSummary
              ? `${nutritionSummary.calories} / ${userCalorieTarget} kcal  |  ${nutritionSummary.protein} / ${userProteinTarget} p`
              : "Not logged"}
          </span>
        </div>
      </Link>

      {/* Workout */}
      {hasWorkout && (
        <Link href={hrefs.workout} aria-label="Open Workout">
          <div
            style={rowStyle(workoutDone, "#5b7c99")}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
            className="futuristic-card"
          >
            <span style={iconWrap}>
              <i className="fas fa-dumbbell" style={{ color: "#5b7c99" }} />
              <span>Workout</span>
            </span>
            <span style={valueStyle}>
              {workoutDone
                ? `${workoutSummary?.calories || 0} kcal${workoutSummary?.duration ? ` · ${Math.round(workoutSummary.duration)} min` : ""}${workoutSummary?.weightUsed ? ` · ${workoutSummary.weightUsed}` : ""}`
                : "Pending"}
            </span>
          </div>
        </Link>
      )}

      {/* Habits */}
      <Link href={hrefs.habit} aria-label="Open Daily Habit">
        <div
          style={rowStyle(habitAllDone, "#9b6fa3")}
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
          className="futuristic-card"
        >
          <span style={iconWrap}>
            <i className="fas fa-check-circle" style={{ color: "#9b6fa3" }} />
            <span>Daily Habit</span>
          </span>
          <span style={valueStyle}>
            {habitSummary ? `${habitSummary.completed}/${habitSummary.total} tasks` : "Not started"}
          </span>
        </div>
      </Link>

      {/* Weekly Check-In */}
      {isFriday && (
        <Link href={hrefs.checkin} aria-label="Open Weekly Check-In">
          <div
            style={rowStyle(checkinComplete, "#c9a34e")}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
            className="futuristic-card"
          >
            <span style={iconWrap}>
              <i className="fas fa-clipboard-list" style={{ color: "#c9a34e" }} />
              <span>Check-In</span>
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
        </Link>
      )}
    </div>
  );
}
