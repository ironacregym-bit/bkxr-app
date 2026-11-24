// components/iron-acre/IronAcreTasks.tsx
"use client";

import Link from "next/link";
import IronAcreWorkoutCard from "./IronAcreWorkoutCard";

type SimpleWorkoutRef = {
  id: string;
  name?: string;
  order?: number;
  programId?: string;
};

type DayOverview = {
  dateKey: string;
  isFriday: boolean;

  nutritionLogged: boolean;
  nutritionSummary?: {
    calories: number;
    protein: number;
    carbs?: number;
    fat?: number;
  };

  habitAllDone: boolean;
  habitSummary?: { completed: number; total: number };

  checkinComplete: boolean;
  checkinSummary?: {
    weight: number;
    body_fat_pct: number;
    weightChange?: number;
    bfChange?: number;
  };

  hasWorkout: boolean;
  workoutDone: boolean;
  workoutIds: string[];
  workoutSummary?: { calories: number; duration: number; weightUsed?: string };

  hasRecurringToday: boolean;
  recurringWorkouts: SimpleWorkoutRef[];
  recurringDone: boolean;
  optionalWorkouts: SimpleWorkoutRef[];
};

type WeeklyTotals = {
  totalTasks: number;
  completedTasks: number;
  totalWorkoutsCompleted: number;
  totalWorkoutTime: number;
  totalCaloriesBurned: number;
};

type IronAcreTasksProps = {
  todayKey: string;
  todayData?: DayOverview;
  fridayYMD: string;
  fridayData?: DayOverview;
  weekDays: DayOverview[];
  weekStartYMD: string;
  weekEndYMD: string;
  weeklyTotals?: WeeklyTotals;
};

function firstWorkoutRefForDay(day?: DayOverview): SimpleWorkoutRef | null {
  if (!day) return null;

  const recurring = Array.isArray(day.recurringWorkouts) ? day.recurringWorkouts : [];
  if (recurring.length) return recurring[0] || null;

  const optional = Array.isArray(day.optionalWorkouts) ? day.optionalWorkouts : [];
  if (optional.length) return optional[0] || null;

  const ids = Array.isArray(day.workoutIds) ? day.workoutIds : [];
  if (ids.length) {
    return { id: ids[0] };
  }

  return null;
}

function WeeklyCheckInCard({
  fridayYMD,
  fridayData,
}: {
  fridayYMD: string;
  fridayData?: DayOverview;
}) {
  const complete = Boolean(fridayData?.checkinComplete);

  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center gap-2">
        <div>
          <div className="ia-kicker">
            <i className="fas fa-clipboard-check" style={{ color: "var(--ia-neon)" }} />
            WEEKLY CHECK-IN
          </div>

          <div className="ia-page-title" style={{ fontSize: "1.15rem" }}>
            {complete ? "Weekly check-in completed" : "Weekly check-in is open"}
          </div>

          <div className="text-dim small mt-1">
            {complete
              ? "Your Friday check-in has already been submitted for this week."
              : `Complete your Friday check-in for ${fridayYMD}.`}
          </div>
        </div>

        <Link
          href="/check-in"
          className={complete ? "ia-btn ia-btn-outline" : "ia-btn ia-btn-primary"}
        >
          {complete ? "View" : "Open"}
        </Link>
      </div>
    </section>
  );
}

export default function IronAcreTasks({
  todayKey,
  todayData,
  fridayYMD,
  fridayData,
  weekDays,
  weekStartYMD,
  weekEndYMD,
  weeklyTotals,
}: IronAcreTasksProps) {
  const workoutRef = firstWorkoutRefForDay(todayData);

  const workoutId = String(workoutRef?.id || "");
  const workoutTitle = workoutRef?.name || "Today’s session";

  const hasWorkoutToday =
    Boolean(todayData?.hasWorkout) ||
    Boolean(todayData?.hasRecurringToday) ||
    Boolean(workoutRef);

  const workoutDone = todayData?.hasRecurringToday
    ? Boolean(todayData?.recurringDone)
    : Boolean(todayData?.workoutDone);

  const durationMinutes = Number(todayData?.workoutSummary?.duration || 0) || null;

  const showWeeklyCheckIn = Boolean(todayData?.isFriday);

  return (
    <>
      {showWeeklyCheckIn ? (
        <WeeklyCheckInCard fridayYMD={fridayYMD} fridayData={fridayData} />
      ) : null}

      <IronAcreWorkoutCard
        title={workoutTitle}
        workout={null}
        workoutId={workoutId}
        done={workoutDone}
        durationMinutes={durationMinutes}
        dateKey={todayKey}
        weekDays={weekDays}
        weekStartYMD={weekStartYMD}
        weekEndYMD={weekEndYMD}
        weeklyTotals={weeklyTotals}
        hasWorkoutToday={hasWorkoutToday}
      />
    </>
  );
}
