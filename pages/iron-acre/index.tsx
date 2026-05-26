import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import BottomNav from "../../components/BottomNav";
import IronAcreHeader from "../../components/iron-acre/IronAcreHeader";
import IronAcreTasks from "../../components/iron-acre/IronAcreTasks";
import IronAcreStrengthSummary from "../../components/iron-acre/IronAcreStrengthSummary";
import IronAcreRecentSessions from "../../components/iron-acre/IronAcreRecentSessions";
import IronAcreClassesList from "../../components/iron-acre/IronAcreClassesList";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function formatYMD(d: Date) {
  return d.toLocaleDateString("en-CA");
}
function startOfAlignedWeek(d: Date) {
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s;
}

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

type WeeklyOverviewResponse = {
  weekStartYMD: string;
  weekEndYMD: string;
  fridayYMD: string;
  days: DayOverview[];
  weeklyTotals?: {
    totalTasks: number;
    completedTasks: number;
    totalWorkoutsCompleted: number;
    totalWorkoutTime: number;
    totalCaloriesBurned: number;
  };
};

export default function IronAcreHome() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const userName = (session?.user?.name || session?.user?.email || "Athlete").toString();

  const now = useMemo(() => new Date(), []);
  const dateLabel = useMemo(() => {
    try {
      return now.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } catch {
      return now.toDateString();
    }
  }, [now]);

  const weekStartKey = useMemo(() => (mounted ? formatYMD(startOfAlignedWeek(new Date())) : ""), [mounted]);

  const { data: weeklyOverview } = useSWR<WeeklyOverviewResponse>(
    mounted && weekStartKey ? `/api/weekly/overview?week=${encodeURIComponent(weekStartKey)}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const todayKey = useMemo(() => formatYMD(new Date()), []);

  const effectiveTodayKey = useMemo(() => {
    const days = weeklyOverview?.days || [];
    if (days.some((d) => d.dateKey === todayKey)) return todayKey;
    // If the API week isn’t the current week (testing / time mismatch),
    // fall back to the first day of the returned week so the UI still shows workouts.
    return weeklyOverview?.weekStartYMD || todayKey;
  }, [weeklyOverview, todayKey]);

  const todayData = useMemo(() => {
    const days = weeklyOverview?.days || [];
    return days.find((d) => d.dateKey === effectiveTodayKey);
  }, [weeklyOverview, effectiveTodayKey]);

  const fridayData = useMemo(() => {
    const fridayYMD = weeklyOverview?.fridayYMD || "";
    if (!fridayYMD) return undefined;
    const days = weeklyOverview?.days || [];
    return days.find((d) => d.dateKey === fridayYMD);
  }, [weeklyOverview]);

  const { data: strengthProfile } = useSWR(mounted ? "/api/strength/profile/get" : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  if (!mounted) return null;

  if (status === "loading") {
    return (
      <main className="container py-4" style={{ color: "#fff" }}>
        Loading…
      </main>
    );
  }

  if (!session) {
    const cb = encodeURIComponent("/iron-acre");
    return (
      <>
        <Head>
          <title>Iron Acre Gym</title>
        </Head>

        <main className="container py-4" style={{ color: "#fff", paddingBottom: 90 }}>
          <section className="futuristic-card p-3">
            <h2 className="m-0">Iron Acre Gym</h2>
            <div className="text-dim mt-2">Please sign in to view your performance dashboard.</div>
            <div className="mt-3">
              <Link href={`/register?callbackUrl=${cb}`} className="btn btn-outline-light" style={{ borderRadius: 24 }}>
                Sign in
              </Link>
            </div>
          </section>
        </main>

        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <IronAcreHeader userName={userName} dateLabel={dateLabel} />

        <IronAcreTasks
          todayKey={effectiveTodayKey}
          todayData={todayData}
          fridayYMD={weeklyOverview?.fridayYMD || ""}
          fridayData={fridayData}
          weekDays={weeklyOverview?.days || []}
          weekStartYMD={weeklyOverview?.weekStartYMD || ""}
          weekEndYMD={weeklyOverview?.weekEndYMD || ""}
          weeklyTotals={weeklyOverview?.weeklyTotals}
        />

        <IronAcreClassesList />

        <div className="row g-2">
          <div className="col-12 col-lg-6">
            <IronAcreStrengthSummary profile={strengthProfile?.profile} />
          </div>

          <div className="col-12 col-lg-6">
            <IronAcreRecentSessions />
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
