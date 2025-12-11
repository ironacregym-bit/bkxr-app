
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
  hrefs
}: Props) {
  const rowStyle = (done: boolean, accent: string) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    backgroundColor: done ? "rgba(100,195,122,0.15)" : "transparent",
    color: "#fff"
  });

  return (
    <div style={{ background: "#1e1e1e", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "14px 16px", fontWeight: 700, fontSize: "1.1rem" }}>{dayLabel} Tasks</div>

      {/* Nutrition */}
      <Link href={hrefs.nutrition}>
        <div style={rowStyle(nutritionLogged, "#4fa3a5")}>
          <span><i className="fas fa-utensils" style={{ marginRight: 8, color: "#4fa3a5" }} /> Nutrition</span>
          <span>{nutritionSummary ? `${nutritionSummary.calories} kcal - ${nutritionSummary.protein}g protein` : "Not logged"}</span>
        </div>
      </Link>

      {/* Workout (only if hasWorkout) */}
      {hasWorkout && (
        <Link href={hrefs.workout}>
          <div style={rowStyle(workoutDone, "#5b7c99")}>
            <span><i className="fas fa-dumbbell" style={{ marginRight: 8, color: "#5b7c99" }} /> Workout</span>
            <span>
              {workoutDone ? `Completed - ${workoutSummary?.calories || 0} kcal - ${workoutSummary?.weightUsed || ""}` : "Pending"}
            </span>
          </div>
        </Link>
      )}

      {/* Habits */}
      <Link href={hrefs.habit}>
        <div style={rowStyle(habitAllDone, "#9b6fa3")}>
          <span><i className="fas fa-check-circle" style={{ marginRight: 8, color: "#9b6fa3" }} /> Daily Habit</span>
          <span>{habitSummary ? `${habitSummary.completed}/${habitSummary.total} tasks` : "Not started"}</span>
        </div>
      </Link>

      {/* Check-in */}
      <Link href={hrefs.checkin}>
        <div style={rowStyle(checkinComplete, "#c9a34e")}>
          <span><i className="fas fa-clipboard-list" style={{ marginRight: 8, color: "#c9a34e" }} /> Check-In</span>
          <span>
            {checkinSummary
              ? `W: ${checkinSummary.weight}kg ${checkinSummary.weightChange ? `(${checkinSummary.weightChange.toFixed(1)}%)` : ""} | BF: ${checkinSummary.bodyFat}%`
              : "Not done"}
          </span>
        </div>
      </Link>
    </div>
  );
}
