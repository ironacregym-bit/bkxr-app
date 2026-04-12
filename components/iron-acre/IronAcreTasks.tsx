import { useRouter } from "next/router";
import useSWR from "swr";
import IronAcreTaskCard from "./IronAcreTaskCard";
import IronAcreWorkoutCard from "./IronAcreWorkoutCard";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type SimpleWorkoutRef = { id: string; name?: string };

type DayOverview = {
  dateKey: string;
  isFriday: boolean;
  checkinComplete: boolean;

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

type WorkoutApi = {
  workout_id: string;
  workout_name: string;
  focus?: string | null;
  notes?: string | null;
  warmup?: any;
  main: any;
  finisher?: any;
};

export default function IronAcreTasks({
  todayKey,
  fridayYMD,
  todayData,
  fridayData,
  weekDays,
  weekStartYMD,
  weekEndYMD,
  weeklyTotals,
}: {
  todayKey: string;
  fridayYMD: string;
  todayData?: DayOverview;
  fridayData?: DayOverview;
  weekDays: DayOverview[];
  weekStartYMD: string;
  weekEndYMD: string;
  weeklyTotals?: WeeklyTotals;
}) {
  const router = useRouter();

  const checkinDone = Boolean(fridayData?.checkinComplete);
  const isFriday = Boolean(todayData?.isFriday);
  const checkinTargetDate = fridayYMD || todayKey;

  const checkinSubtitle = isFriday
    ? checkinDone
      ? "Completed"
      : "Complete your weekly check-in"
    : checkinDone
    ? `Completed for ${fridayYMD}`
    : `Next check-in: ${fridayYMD || "Friday"}`;

  // pick workout for the card:
  // 1) today recurring
  // 2) next upcoming recurring in week
  // 3) most recent recurring in week
  const picked = (() => {
    const daysWith = (weekDays || []).filter((d) => (d.recurringWorkouts || []).length > 0);

    const todayHit = daysWith.find((d) => d.dateKey === todayKey);
    if (todayHit) return { day: todayHit, ref: todayHit.recurringWorkouts[0] };

    const next = daysWith.find((d) => d.dateKey >= todayKey);
    if (next) return { day: next, ref: next.recurringWorkouts[0] };

    const last = daysWith.length ? daysWith[daysWith.length - 1] : undefined;
    if (last) return { day: last, ref: last.recurringWorkouts[0] };

    return { day: undefined as any, ref: undefined as any };
  })();

  const sessionId: string = picked?.ref?.id || "";
  const sessionDone = Boolean(picked?.day?.recurringDone);

  const durationMinutes =
    typeof picked?.day?.workoutSummary?.duration === "number"
      ? picked.day.workoutSummary.duration
      : null;

  const { data: workoutData } = useSWR<WorkoutApi>(
    sessionId ? `/api/workouts/${encodeURIComponent(sessionId)}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  return (
    <div className="mb-3">
      <IronAcreTaskCard
        title="Weekly check-in"
        subtitle={checkinSubtitle}
        ctaLabel={checkinDone ? "View" : "Open"}
        rightMeta={checkinDone ? "✓" : undefined}
        onCta={() => router.push(`/checkin?date=${encodeURIComponent(checkinTargetDate)}`)}
        variant="neon"
      />

      <IronAcreWorkoutCard
        title="Today’s workout"
        workout={workoutData || null}
        workoutId={sessionId}
        done={sessionDone}
        durationMinutes={durationMinutes}
        dateKey={picked?.day?.dateKey || todayKey}
        weekDays={weekDays}
        weekStartYMD={weekStartYMD}
        weekEndYMD={weekEndYMD}
        weeklyTotals={weeklyTotals}
      />

      <IronAcreTaskCard
        title="Update your 1RMs"
        subtitle="Keep your maxes current so % loads stay accurate"
        ctaLabel="1RMs"
        onCta={() => router.push("/iron-acre/strength")}
        variant="neon"
      />

      {!sessionId && (
        <div className="text-dim small mt-2">
          No recurring gym sessions found for this week.
        </div>
      )}
    </div>
  );
}
