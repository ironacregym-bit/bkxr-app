
import React from "react";
import Link from "next/link";

export default function DailyTasksCard({ dayLabel, nutritionSummary, nutritionLogged, workoutSummary, hasWorkout, workoutDone, habitSummary, habitAllDone, checkinSummary, checkinComplete, hrefs }: any) {
  return (
    <div className="bxkr-tasks">
      <h3 className="tasks-title">{dayLabel} Rounds</h3>

      <Link href={hrefs.nutrition} className="task-card">
        <div>
          <img src="/icons/plate.svg" alt="Nutrition" className="task-icon" />
          <span className="task-title">Fuel Up</span>
        </div>
        <span className="task-status">{nutritionLogged ? `${nutritionSummary?.calories} kcal` : "Not logged"}</span>
      </Link>

      {hasWorkout && (
        <Link href={hrefs.workout} className="task-card">
          <div>
            <img src="/icons/kettlebell.svg" alt="Workout" className="task-icon" />
            <span className="task-title">Hit the Bag</span>
          </div>
          <span className="task-status">{workoutDone ? "Completed" : "Pending"}</span>
        </Link>
      )}

      <Link href={hrefs.habit} className="task-card">
        <div>
          <img src="/icons/check.svg" alt="Habits" className="task-icon" />
          <span className="task-title">Round Complete</span>
        </div>
        <span className="task-status">{habitAllDone ? "Done" : `${habitSummary?.completed}/${habitSummary?.total}`}</span>
      </Link>

      <Link href={hrefs.checkin} className="task-card">
        <div>
          <img src="/icons/scale.svg" alt="Check-In" className="task-icon" />
          <span className="task-title">Weigh-In</span>
        </div>
        <span className="task-status">{checkinComplete ? "Done" : "Not done"}</span>
      </Link>
    </div>
  );
}
