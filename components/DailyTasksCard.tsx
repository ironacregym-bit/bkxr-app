
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
  userCalorieTarget?: number; // ✅ Add user targets
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
  userCalorieTarget = 2000, // ✅ Default target
  userProteinTarget = 150
}: Props) {
  const rowStyle = (done: boolean, accent: string) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: done ? "rgba(100,195,122,0.15)" : "#1e1e1e",
    color: "#fff",
    boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
  });

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: "1.2rem", marginBottom: 12 }}>{dayLabel} Tasks</div>

      {/* Nutrition */}
      <Link href={hrefs.nutrition}>
        <div style={rowStyle(nutritionLogged, "#4fa3a5")}>
          <span><i className="fas fa-utensils" style={{ marginRight: 8, color: "#4fa3a5" }} /> Nutrition</span>
          <span>
            {nutritionSummary
              ? `${nutritionSummary.calories} / ${userCalorieTarget} kcal | ${nutritionSummary.protein} / ${userProteinTarget} p`
              : "Not logged"}
          </span>
        </div>
      </Link>

      {/* Workout */}
      {hasWorkout && (
        <Link href={hrefs.workout}>
          <div style={rowStyle(workoutDone, "#5b7c99")}>
            <span><i className="fas fa-dumbbell" style={{ marginRight: 8, color: "#5b7c99" }} /> Workout</span>
            <span>
              {workoutDone
                ? `Completed - ${workoutSummary?.calories || 0} kcal - ${workoutSummary?.weightUsed || ""}`
                : "Pending"}
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
