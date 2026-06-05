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

  habitAllDone: boolean;
  habitSummary?: { completed: number; total: number };

  checkinComplete: boolean;

  hasWorkout: boolean;
  workoutDone: boolean;
  workoutIds: string[];

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

  const recurring = day.recurringWorkouts || [];
  if (recurring.length) return recurring[0] || null;

  const optional = day.optionalWorkouts || [];
  if (optional.length) return optional[0] || null;

  const ids = day.workoutIds || [];
  if (ids.length) return { id: ids[0] };

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
    <section className="ia-tile ia-tile-pad mb-2">
      <div className="d-flex justify-content-between align-items-center gap-2">
        <div>
          <div className="ia-kicker">
            <i className="fas fa-clipboard-check" />
            WEEKLY CHECK-IN
          </div>

          <div className="ia-page-title">
            {complete ? "Weekly check-in completed" : "Weekly check-in open"}
          </div>

          <div className="text-dim small">
            {complete
              ? "Already submitted this week."
              : `Complete check-in for ${fridayYMD}.`}
          </div>
        </div>

        <Link
          href="/check-in"
          className={complete ? "ia-btn ia-btn-outline ia-task-link-btn" : "ia-btn ia-btn-primary ia-task-link-btn"}
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

  const durationMinutes = Number(todayData?.workoutDone ? todayData?.workoutDone : 0) || null;

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
