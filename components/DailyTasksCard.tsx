
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
  const rowStyle = (done: boolean) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    backgroundColor: done ? "rgba(100,195,122,0.15)" : "transparent",
    color: "#fff"
  });

  return (
    <div style={{ background: "#1e1e1e", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "12px 16px", fontWeight: 700, fontSize: "1.1rem" }}>{dayLabel} Tasks</div>

      {/* Nutrition */}
      <Link href={hrefs.nutrition}>
        <div style={rowStyle(nutritionLogged)}>
          <span><i className="fas fa-utensils" style={{ marginRight: 8 }} /> Nutrition</span>
          <span>{nutritionSummary ? `${nutritionSummary.calories} kcal - ${nutritionSummary.protein}g protein` : "Not logged"}</span>
        </div>
      </Link>

      {/* Workout */}
      <Link href={hrefs.workout}>
        <div style={rowStyle(workoutDone)}>
          <span><i className="fas fa-dumbbell" style={{ marginRight: 8 }} /> Workout</span>
          <span>
            {hasWorkout ? (workoutDone ? `Completed - ${workoutSummary?.calories || 0} kcal - ${workoutSummary?.weightUsed || ""}` : "Pending") : "No workout"}
          </span>
        </div>
      </Link>

      {/* Habits */}
      <Link href={hrefs.habit}>
        <div style={rowStyle(habitAllDone)}>
          <span><i className="fas fa-check-circle" style={{ marginRight: 8 }} /> Daily Habit</span>
          <span>{habitSummary ? `${habitSummary.completed}/${habitSummary.total} tasks` : "Not started"}</span>
        </div>
      </Link>

      {/* Check-in */}
      <Link href={hrefs.checkin}>
        <div style={rowStyle(checkinComplete)}>
          <span><i className="fas fa-clipboard-list" style={{ marginRight: 8 }} /> Check-In</span>
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
