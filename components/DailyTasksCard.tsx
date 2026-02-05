import React from "react";
import Link from "next/link";
import dayjs from "dayjs";

const ACCENT = "#FF8A2A";

type SimpleWorkoutRef = { id: string; name?: string };

type CompletedWorkout = {
  workout_id: string;
  completedAt: string; // ISO string
  calories?: number;
  duration?: number;
  weightUsed?: string;
};

type Props = {
  dayLabel: string;

  // Nutrition
  nutritionSummary?: { calories: number; protein: number };
  nutritionLogged: boolean;

  // Habits
  habitSummary?: { completed: number; total: number };
  habitAllDone: boolean;

  // Weekly check-in
  checkinSummary?: { weight: number; bodyFat: number; weightChange?: number; bfChange?: number };
  checkinComplete: boolean;

  // Workouts
  recurringWorkouts?: SimpleWorkoutRef[];
  optionalWorkouts?: SimpleWorkoutRef[];
  completedWorkouts?: CompletedWorkout[];

  // Hrefs
  hrefs: {
    nutrition: string;
    habit: string;
    checkin: string;
    recurring?: string;
    optionalWorkout?: string;
  };

  // Targets
  userCalorieTarget?: number;
  userProteinTarget?: number;
};

export default function DailyTasksCard({
  dayLabel,
  nutritionSummary,
  nutritionLogged,
  habitSummary,
  habitAllDone,
  checkinSummary,
  checkinComplete,
  recurringWorkouts = [],
  optionalWorkouts = [],
  completedWorkouts = [],
  hrefs,
  userCalorieTarget = 2000,
  userProteinTarget = 150,
}: Props) {
  const isFriday = dayLabel.toLowerCase().startsWith("fri");

  // ---------- Utility: check if a workout is completed this week ----------
  const isCompletedThisWeek = (workoutId: string): CompletedWorkout | undefined => {
    const startOfWeek = dayjs().startOf("week");
    const endOfWeek = dayjs().endOf("week");

    return completedWorkouts?.find(cw => {
      return (
        cw.workout_id === workoutId &&
        dayjs(cw.completedAt).isBetween(startOfWeek, endOfWeek, null, "[]")
      );
    });
  };

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

  const badgeStyle = (bg: string): React.CSSProperties => ({
    marginLeft: 8,
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: "0.7rem",
    fontWeight: 600, // tone down font weight to match optional
    color: "#0a0a0c",
    background: bg,
  });

  const RowWrapper: React.FC<{ href: string; locked?: boolean; children: React.ReactNode }> = ({
    href,
    locked,
    children,
  }) => {
    if (locked || href === "#") {
      return <div aria-disabled="true">{children}</div>;
    }
    return <Link href={href}>{children as any}</Link>;
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: 12 }}>
        {dayLabel} Tasks
      </div>

      {/* Nutrition */}
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

      {/* Recurring Workouts */}
      {recurringWorkouts.map(workout => {
        const completed = isCompletedThisWeek(workout.id);
        const href = hrefs.recurring ?? "#";
        return (
          <RowWrapper key={workout.id} href={href}>
            <div style={rowStyle(!!completed, "#5b7c99")}>
              <span style={iconWrap}>
                <i className="fas fa-dumbbell" style={{ color: "#5b7c99" }} />
                <span>{workout.name || "Recurring Workout"}</span>
                <span style={badgeStyle(ACCENT)}>Mandatory</span>
              </span>
              <span style={valueStyle}>
                {completed
                  ? `${completed.calories || 0} kcal${completed.duration ? ` · ${Math.round(completed.duration)} min` : ""}${
                      completed.weightUsed ? ` · ${completed.weightUsed}` : ""
                    }`
                  : "Pending"}
              </span>
            </div>
          </RowWrapper>
        );
      })}

      {/* Optional Workouts */}
      {optionalWorkouts.map(workout => {
        const completed = isCompletedThisWeek(workout.id);
        const href = hrefs.optionalWorkout ?? "#";
        return (
          <RowWrapper key={workout.id} href={href}>
            <div style={rowStyle(!!completed, "#7a8793")}>
              <span style={iconWrap}>
                <i className="fas fa-dumbbell" style={{ color: "#7a8793" }} />
                <span>{workout.name || "BXKR Workout"}</span>
                <span style={badgeStyle("rgba(255,255,255,0.65)")}>Optional</span>
              </span>
              <span style={valueStyle}>
                {completed
                  ? `${completed.calories || 0} kcal${completed.duration ? ` · ${Math.round(completed.duration)} min` : ""}${
                      completed.weightUsed ? ` · ${completed.weightUsed}` : ""
                    }`
                  : "Pending"}
              </span>
            </div>
          </RowWrapper>
        );
      })}

      {/* Habits */}
      <RowWrapper href={hrefs.habit}>
        <div style={rowStyle(habitAllDone, "#9b6fa3")}>
          <span style={iconWrap}>
            <i className="fas fa-check-circle" style={{ color: "#9b6fa3" }} />
            <span>Daily Habit</span>
          </span>
          <span style={valueStyle}>
            {habitSummary ? `${habitSummary.completed}/${habitSummary.total} tasks` : "Not started"}
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