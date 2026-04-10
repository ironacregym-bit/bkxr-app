import { useMemo } from "react";
import { useRouter } from "next/router";
import IronAcreTaskCard from "./IronAcreTaskCard";

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

export default function IronAcreTasks({
  todayKey,
  fridayYMD,
  todayData,
}: {
  todayKey: string;
  fridayYMD: string;
  todayData?: DayOverview;
}) {
  const router = useRouter();

  const sessionTitle = useMemo(() => {
    const first = todayData?.recurringWorkouts?.[0];
    return first?.name || "Today’s gym session";
  }, [todayData]);

  const sessionId = useMemo(() => {
    const first = todayData?.recurringWorkouts?.[0];
    return first?.id || "";
  }, [todayData]);

  const sessionDone = Boolean(todayData?.hasRecurringToday ? todayData?.recurringDone : todayData?.workoutDone);

  const isFriday = Boolean(todayData?.isFriday);
  const checkinDone = Boolean(todayData?.checkinComplete);
  const checkinLabel = isFriday ? "Check in" : "Weekly check-in";
  const checkinSub = isFriday
    ? (checkinDone ? "Completed" : "Complete your weekly check-in")
    : (fridayYMD ? `Next check-in: ${fridayYMD}` : "Weekly check-in is on Friday");

  return (
    <div className="mb-3">
      <IronAcreTaskCard
        title={checkinLabel}
        subtitle={checkinSub}
        ctaLabel={checkinDone ? "Done" : "Open"}
        onCta={() => {
          const target = fridayYMD || todayKey;
          router.push(`/checkin?date=${encodeURIComponent(target)}`);
        }}
        rightMeta={checkinDone ? "✓" : undefined}
      />

      <IronAcreTaskCard
        title={sessionTitle}
        subtitle={
          todayData?.hasRecurringToday
            ? (sessionDone ? "Completed this week" : "Start your programmed strength session")
            : "No recurring gym session assigned today"
        }
        ctaLabel={sessionDone ? "View" : "Start"}
        onCta={() => {
          if (!sessionId) return;
          router.push(`/gymworkout/${encodeURIComponent(sessionId)}`);
        }}
        rightMeta={todayData?.hasRecurringToday ? "Gym" : "—"}
      />

      <IronAcreTaskCard
        title="Update your 1RMs"
        subtitle="Keep your maxes current so % loads stay accurate"
        ctaLabel="1RMs"
        onCta={() => router.push("/iron-acre/strength")}
      />
    </div>
  );
}
