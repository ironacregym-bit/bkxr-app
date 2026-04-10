import { useMemo } from "react";
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

type WorkoutApi = {
  workout_id: string;
  workout_name: string;
  warmup?: any;
  main: any;
  finisher?: any;
};

export default function IronAcreTasks({
  todayKey,
  fridayYMD,
  todayData,
  fridayData,
}: {
  todayKey: string;
  fridayYMD: string;
  todayData?: DayOverview;
  fridayData?: DayOverview;
}) {
  const router = useRouter();

  const hasRecurringToday = Boolean(todayData?.hasRecurringToday);
  const sessionRef = todayData?.recurringWorkouts?.[0];
  const sessionId = sessionRef?.id || "";
  const sessionDone = Boolean(hasRecurringToday ? todayData?.recurringDone : todayData?.workoutDone);

  const durationMinutes = typeof todayData?.workoutSummary?.duration === "number" ? todayData!.workoutSummary!.duration : null;

  const { data: workoutData } = useSWR<WorkoutApi>(
    sessionId ? `/api/workouts/${encodeURIComponent(sessionId)}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const isFriday = Boolean(todayData?.isFriday);
  const checkinDone = Boolean(fridayData?.checkinComplete);
  const checkinTargetDate = fridayYMD || todayKey;

  const checkinSubtitle = isFriday
    ? checkinDone
      ? "Completed"
      : "Complete your weekly check-in"
    : checkinDone
    ? `Completed for ${fridayYMD}`
    : `Next check-in: ${fridayYMD || "Friday"}`;

  return (
    <div className="mb-3">
      <IronAcreTaskCard
        title="Weekly check-in"
        subtitle={checkinSubtitle}
        ctaLabel={checkinDone ? "View" : "Open"}
        rightMeta={checkinDone ? "✓" : undefined}
        onCta={() => router.push(`/checkin?date=${encodeURIComponent(checkinTargetDate)}`)}
      />

      <IronAcreWorkoutCard
        title="Today’s workout"
        workout={workoutData || null}
        workoutId={sessionId}
        done={sessionDone}
        durationMinutes={durationMinutes}
      />

      <IronAcreTaskCard
        title="Update your 1RMs"
        subtitle="Keep your maxes current so % loads stay accurate"
        ctaLabel="1RMs"
        onCta={() => router.push("/iron-acre/strength")}
      />

      {!hasRecurringToday && (
        <div className="text-dim small mt-2">
          No recurring gym session assigned today. If you want, we can fall back to the most recent session.
        </div>
      )}
    </div>
  );
}
