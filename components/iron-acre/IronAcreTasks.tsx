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
  const sessionTitle = sessionRef?.name || "Today’s gym session";

  const sessionDone = Boolean(hasRecurringToday ? todayData?.recurringDone : todayData?.workoutDone);

  const sessionSub = useMemo(() => {
    if (!hasRecurringToday) return "No recurring gym session assigned today";
    if (sessionDone) return "Completed this week";
    const s = todayData?.workoutSummary;
    if (s && (s.duration || s.calories || s.weightUsed)) {
      const parts = [];
      if (s.duration) parts.push(`${s.duration} min`);
      if (s.calories) parts.push(`${s.calories} kcal`);
      if (s.weightUsed) parts.push(`${s.weightUsed}`);
      return parts.join(" • ");
    }
    return "Start your programmed strength session";
  }, [hasRecurringToday, sessionDone, todayData?.workoutSummary]);

  const isFriday = Boolean(todayData?.isFriday);
  const checkinDone = Boolean(fridayData?.checkinComplete);
  const checkinTargetDate = fridayYMD || todayKey;

  const checkinTitle = "Weekly check-in";
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
        title={checkinTitle}
        subtitle={checkinSubtitle}
        ctaLabel={checkinDone ? "View" : "Open"}
        rightMeta={checkinDone ? "✓" : undefined}
        onCta={() => router.push(`/checkin?date=${encodeURIComponent(checkinTargetDate)}`)}
      />

      <IronAcreTaskCard
        title={sessionTitle}
        subtitle={sessionSub}
        ctaLabel={sessionDone ? "View" : "Start"}
        rightMeta={hasRecurringToday ? "Gym" : "—"}
        muted={!hasRecurringToday}
        onCta={() => {
          if (!sessionId) return;
          router.push(`/gymworkout/${encodeURIComponent(sessionId)}`);
        }}
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
