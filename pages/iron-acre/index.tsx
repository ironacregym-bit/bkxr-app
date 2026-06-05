// pages/iron-acre/index.tsx
import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import BottomNav from "../../components/BottomNav";
import PushSubscribeButton from "../../components/PushSubscribeButton";
import NotificationsBanner from "../../components/NotificationsBanner";
import IronAcreHeader from "../../components/iron-acre/IronAcreHeader";
import IronAcreWorkoutCard from "../../components/iron-acre/IronAcreWorkoutCard";
import IronAcreNutritionCard from "../../components/iron-acre/IronAcreNutritionCard";
import IronAcreStrengthSummary from "../../components/iron-acre/IronAcreStrengthSummary";
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

function endOfTwoWeekWindow(d: Date) {
  const s = startOfAlignedWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 13);
  e.setHours(23, 59, 59, 999);
  return e;
}

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

type IronAcreHomeOverviewResponse = {
  weekStartYMD: string;
  weekEndYMD: string;
  fridayYMD: string;
  todayYMD: string;
  days: DayOverview[];
  weeklyTotals?: {
    totalTasks: number;
    completedTasks: number;
    totalWorkoutsCompleted: number;
    totalWorkoutTime: number;
    totalCaloriesBurned: number;
  };
  currentProgram?: {
    assignment_id: string;
    program_id: string;
    program_name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    weeks: number;
    current_week: number | null;
    is_active_today: boolean;
  } | null;
  todaysWorkouts: SimpleWorkoutRef[];
  nutritionToday: {
    logged: boolean;
    entriesCount: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
};

type Gym = {
  id: string;
  name: string;
  location?: string | null;
};

type SessionItem = {
  id: string;
  class_id: string | null;
  coach_name?: string | null;
  start_time: string | null;
  end_time: string | null;
  price: number;
  max_attendance: number;
  current_attendance: number;
  gym_name: string | null;
  location: string | null;
};

type UserAccess = {
  membership_status?: string | null;
  payment_type?: string | null;
  gym_id?: string | null;
};

type BookingsMineResponse = {
  sessionIds?: string[];
};

type PaymentMethod = "stripe" | "pay_on_day" | "member_free";

function HomeLoadingScreen() {
  return (
    <main
      className="container py-4"
      style={{
        color: "#fff",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 90,
      }}
    >
      <div
        className="ia-tile ia-tile-pad"
        style={{
          width: "100%",
          maxWidth: 420,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 14px",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "rgba(22, 219, 170, 0.10)",
            border: "1px solid rgba(22, 219, 170, 0.24)",
            boxShadow: "0 0 24px rgba(22, 219, 170, 0.12)",
          }}
        >
          <i
            className="fas fa-spinner fa-spin"
            style={{
              fontSize: 24,
              color: "#16dbaa",
            }}
          />
        </div>

        <div className="ia-page-title" style={{ fontSize: "1.2rem" }}>
          Loading Iron Acre
        </div>

        <div className="text-dim small mt-1">
          Pulling in your dashboard, classes and daily tasks.
        </div>
      </div>
    </main>
  );
}

function SectionLoadingCard({
  title,
  icon,
}: {
  title: string;
  icon: string;
}) {
  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center">
        <div className="ia-kicker">
          <i className={`fas ${icon}`} style={{ color: "var(--ia-neon)" }} />
          {title.toUpperCase()}
        </div>

        <i className="fas fa-spinner fa-spin text-dim" />
      </div>

      <div className="text-dim small mt-2">Loading {title.toLowerCase()}…</div>
    </section>
  );
}

function firstWorkoutRefForDay(day?: DayOverview): SimpleWorkoutRef | null {
  if (!day) return null;

  const recurring = Array.isArray(day.recurringWorkouts) ? day.recurringWorkouts : [];
  if (recurring.length) return recurring[0] || null;

  const optional = Array.isArray(day.optionalWorkouts) ? day.optionalWorkouts : [];
  if (optional.length) return optional[0] || null;

  const ids = Array.isArray(day.workoutIds) ? day.workoutIds : [];
  if (ids.length) return { id: ids[0] };

  return null;
}

function DailyHabitsCard({ todayData }: { todayData?: DayOverview }) {
  const completed = Number(todayData?.habitSummary?.completed || 0);
  const total = Number(todayData?.habitSummary?.total || 5);
  const allDone = Boolean(todayData?.habitAllDone);

  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center gap-2">
        <div>
          <div className="ia-kicker">
            <i className="fas fa-check-circle" style={{ color: "var(--ia-neon)" }} />
            DAILY HABITS
          </div>

          <div className="ia-page-title" style={{ fontSize: "1.15rem" }}>
            {allDone ? "Daily habits completed" : "Daily habits are open"}
          </div>

          <div className="text-dim small mt-1">
            {allDone
              ? "Your daily habits are all logged for today."
              : `Complete your daily habits for today (${completed}/${total}).`}
          </div>
        </div>

        <Link
          href="/habits"
          className={allDone ? "ia-btn ia-btn-outline" : "ia-btn ia-btn-primary"}
          style={{ textTransform: "none" }}
        >
          {allDone ? "View" : "Open"}
        </Link>
      </div>
    </section>
  );
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
          style={{ textTransform: "none" }}
        >
          {complete ? "View" : "Open"}
        </Link>
      </div>
    </section>
  );
}

export default function IronAcreHome() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const userName = (session?.user?.name || session?.user?.email || "Athlete").toString();
  const authedEmail = String(session?.user?.email || "").trim().toLowerCase();
  const isAuthed = Boolean(authedEmail);

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

  const weekStartKey = useMemo(() => {
    if (!mounted) return "";
    return formatYMD(startOfAlignedWeek(new Date()));
  }, [mounted]);

  const {
    data: homeOverview,
    error: homeOverviewError,
  } = useSWR<IronAcreHomeOverviewResponse>(
    mounted && weekStartKey ? `/api/iron-acre/home-overview?week=${encodeURIComponent(weekStartKey)}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const todayKey = useMemo(() => formatYMD(new Date()), []);
  const effectiveTodayKey = useMemo(() => {
    const days = homeOverview?.days || [];
    if (days.some((d) => d.dateKey === todayKey)) return todayKey;
    return homeOverview?.weekStartYMD || todayKey;
  }, [homeOverview, todayKey]);

  const todayData = useMemo(() => {
    const days = homeOverview?.days || [];
    return days.find((d) => d.dateKey === effectiveTodayKey);
  }, [homeOverview, effectiveTodayKey]);

  const fridayData = useMemo(() => {
    const fridayYMD = homeOverview?.fridayYMD || "";
    if (!fridayYMD) return undefined;
    const days = homeOverview?.days || [];
    return days.find((d) => d.dateKey === fridayYMD);
  }, [homeOverview]);

  const showWeeklyCheckIn = Boolean(todayData?.isFriday);

  const workoutRef = useMemo(() => firstWorkoutRefForDay(todayData), [todayData]);
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

  const { data: strengthProfile, error: strengthError } = useSWR(
    mounted ? "/api/strength/profile/get" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  const { data: gymsResp, error: gymsError } = useSWR(
    mounted && isAuthed ? "/api/gyms/list" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  const gyms: Gym[] = Array.isArray(gymsResp?.gyms) ? gymsResp.gyms : [];

  const profileKey = mounted && isAuthed ? `/api/profile?email=${encodeURIComponent(authedEmail)}` : null;
  const {
    data: profile,
    mutate: mutateProfile,
    error: profileError,
  } = useSWR<UserAccess>(profileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const selectedGym = useMemo(() => {
    const userGymId = String(profile?.gym_id || "").trim();
    if (!userGymId) return null;
    return gyms.find((g) => g.id === userGymId) || null;
  }, [profile?.gym_id, gyms]);

  const twoWeekFromISO = useMemo(() => {
    const s = startOfAlignedWeek(new Date());
    return s.toISOString();
  }, []);

  const twoWeekToISO = useMemo(() => {
    const e = endOfTwoWeekWindow(new Date());
    return e.toISOString();
  }, []);

  const shouldLoadSessions = Boolean(selectedGym?.location);

  const {
    data: sessionsResp,
    mutate: mutateSessions,
    error: sessionsError,
  } = useSWR(
    mounted && shouldLoadSessions
      ? `/api/schedule/upcoming?location=${encodeURIComponent(selectedGym?.location || "")}&from=${encodeURIComponent(
          twoWeekFromISO
        )}&to=${encodeURIComponent(twoWeekToISO)}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  const sessions: SessionItem[] = Array.isArray(sessionsResp?.sessions) ? sessionsResp.sessions : [];

  const bookingsKey =
    mounted && isAuthed && shouldLoadSessions
      ? `/api/bookings/mine?from=${encodeURIComponent(twoWeekFromISO)}&to=${encodeURIComponent(twoWeekToISO)}`
      : null;

  const {
    data: bookingsResp,
    mutate: mutateBookings,
    error: bookingsError,
  } = useSWR<BookingsMineResponse>(bookingsKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
  });

  const bookedSessionIds = Array.isArray(bookingsResp?.sessionIds) ? bookingsResp.sessionIds : [];

  async function handleJoinGym(gymId: string) {
    const res = await fetch("/api/profile/join-gym", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym_id: gymId }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json?.error || "Failed to join gym");
    }

    await mutateProfile();
  }

  async function handleBook(sessionId: string, paymentMethod: PaymentMethod) {
    const res = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, payment_method: paymentMethod }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || "Booking failed");
    }

    if (json.status === "pending_payment") {
      const checkoutRes = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "class_booking", booking_id: json.booking_id }),
      });

      const checkoutJson = await checkoutRes.json().catch(() => ({}));

      if (!checkoutRes.ok) {
        throw new Error(checkoutJson?.error || "Stripe error");
      }

      if (!checkoutJson?.url) {
        throw new Error("Stripe checkout created but no URL returned");
      }

      window.location.href = checkoutJson.url;
      return;
    }

    await Promise.allSettled([mutateSessions?.(), mutateBookings?.()]);
  }

  const coreReady = mounted && status !== "loading" && (!session || !!homeOverview || !!homeOverviewError);

  if (!mounted || !coreReady) {
    return (
      <>
        <Head>
          <title>Iron Acre Gym</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </Head>
        <HomeLoadingScreen />
        <BottomNav />
      </>
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

  const classesLoading =
    !profileError &&
    !gymsError &&
    ((!!profileKey && !profile) ||
      (mounted && isAuthed && !gymsResp) ||
      (shouldLoadSessions && !sessionsResp) ||
      (bookingsKey && !bookingsResp));

  const strengthLoading = !strengthProfile && !strengthError;

  return (
    <>
      <Head>
        <title>Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <IronAcreHeader
          userName={userName}
          dateLabel={dateLabel}
          notificationsContent={<NotificationsBanner />}
        />

        <DailyHabitsCard todayData={todayData} />

        {showWeeklyCheckIn ? (
          <WeeklyCheckInCard
            fridayYMD={homeOverview?.fridayYMD || ""}
            fridayData={fridayData}
          />
        ) : null}

        {classesLoading ? (
          <SectionLoadingCard title="Classes" icon="fa-calendar-alt" />
        ) : (
          <IronAcreClassesList
            isAuthed={isAuthed}
            authedEmail={authedEmail}
            gyms={gyms}
            profile={profile || null}
            sessions={sessions}
            bookedSessionIds={bookedSessionIds}
            onJoinGym={handleJoinGym}
            onBook={handleBook}
          />
        )}

        <IronAcreWorkoutCard
          title={workoutTitle}
          workout={null}
          workoutId={workoutId}
          done={workoutDone}
          durationMinutes={durationMinutes}
          dateKey={effectiveTodayKey}
          weekDays={homeOverview?.days || []}
          weekStartYMD={homeOverview?.weekStartYMD || ""}
          weekEndYMD={homeOverview?.weekEndYMD || ""}
          weeklyTotals={homeOverview?.weeklyTotals}
          hasWorkoutToday={hasWorkoutToday}
        />

        <IronAcreNutritionCard
          nutritionToday={
            homeOverview?.nutritionToday || {
              logged: false,
              entriesCount: 0,
              calories: 0,
              protein_g: 0,
              carbs_g: 0,
              fat_g: 0,
            }
          }
        />

        {strengthLoading ? (
          <SectionLoadingCard title="Strength" icon="fa-dumbbell" />
        ) : (
          <IronAcreStrengthSummary profile={strengthProfile?.profile} />
        )}
      </main>

      <PushSubscribeButton
        variant="toast"
        title="Turn on Iron Acre notifications"
        message="Get class reminders, weekly booking alerts, gym updates and important notices straight to your device."
      />

      <BottomNav />
    </>
  );
}
