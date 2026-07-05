// pages/iron-acre/index.tsx
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
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
  programmedWorkouts?: SimpleWorkoutRef[];
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
  class_name?: string | null;
  coach_name?: string | null;
  start_time: string | null;
  end_time: string | null;
  price: number;
  drop_in_price?: number | null;
  max_attendance: number;
  current_attendance: number;
  gym_name: string | null;
  location: string | null;
};

type UserAccess = {
  membership_status?: string | null;
  payment_type?: string | null;
  gym_id?: string | null;

  sex?: "male" | "female" | "other" | null;
  DOB?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  bodyfat_pct?: number | null;
  goal_primary?: "lose" | "tone" | "gain" | null;
  activity_factor?: number | null;
  job_type?: "desk" | "mixed" | "manual" | "athlete" | null;

  onboarding_complete?: boolean | null;
  onboarding_started_at?: string | null;
  onboarding_completed_at?: string | null;
};

type BookingsMineResponse = {
  sessionIds?: string[];
};

type PaymentMethod = "stripe" | "pay_on_day" | "member_free";

type WorkoutItem =
  | {
      type: "Single";
      exercise_id: string;
      exercise_name?: string;
      sets?: number | null;
      reps?: string | null;
    }
  | {
      type: "Superset";
      items: {
        exercise_id: string;
        exercise_name?: string;
        reps?: string | null;
      }[];
      sets?: number | null;
    };

type Round = {
  name: string;
  order: number;
  items: WorkoutItem[];
};

type Workout = {
  workout_id: string;
  workout_name: string;
  focus?: string | null;
  notes?: string | null;
  warmup?: Round | null;
  main: Round;
  finisher?: Round | null;
};

function isIronAcreOnboardingComplete(profile?: UserAccess | null) {
  if (!profile) return false;

  const hasSex = !!String(profile.sex || "").trim();
  const hasDob = !!String(profile.DOB || "").trim();
  const hasHeight = Number(profile.height_cm || 0) > 0;
  const hasWeight = Number(profile.weight_kg || 0) > 0;
  const hasGoal = !!String(profile.goal_primary || "").trim();
  const hasActivity = Number(profile.activity_factor || 0) > 0;

  return hasSex && hasDob && hasHeight && hasWeight && hasGoal && hasActivity;
}

function HomeLoadingScreen() {
  return (
    <main className="container py-4 ia-home-loading">
      <div className="ia-tile ia-tile-pad ia-home-loading-card">
        <div className="ia-home-loading-icon">
          <i className="fas fa-spinner fa-spin" />
        </div>
        <div className="ia-page-title">Loading Iron Acre</div>
        <div className="text-dim small mt-1">Pulling in your dashboard and daily tasks.</div>
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
    <section className="ia-tile ia-tile-pad mb-2 ia-section-loading">
      <div className="d-flex justify-content-between align-items-center">
        <div className="ia-kicker">
          <i className={`fas ${icon}`} />
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

  const programmed = Array.isArray(day.programmedWorkouts) ? day.programmedWorkouts : [];
  if (programmed.length) return programmed[0] || null;

  const optional = Array.isArray(day.optionalWorkouts) ? day.optionalWorkouts : [];
  if (optional.length) return optional[0] || null;

  const ids = Array.isArray(day.workoutIds) ? day.workoutIds : [];
  if (ids.length) return { id: ids[0] };

  return null;
}

function CompactTaskRow({
  title,
  subtitle,
  badge,
  href,
  buttonLabel,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  href: string;
  buttonLabel: string;
}) {
  return (
    <div className="ia-task-row">
      <div className="ia-task-main">
        <div className="ia-task-title">{title}</div>
        <div className="text-dim small ia-task-subtitle">{subtitle}</div>
      </div>

      <div className="ia-task-actions">
        {badge ? <span className="ia-badge">{badge}</span> : null}

        <Link href={href} className="ia-btn ia-btn-primary ia-task-link-btn">
          {buttonLabel}
        </Link>
      </div>
    </div>
  );
}

function TasksCard({
  todayData,
  fridayYMD,
  fridayData,
  compactDefaultOpen = false,
}: {
  todayData?: DayOverview;
  fridayYMD: string;
  fridayData?: DayOverview;
  compactDefaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(compactDefaultOpen);

  const habitsCompleted = Number(todayData?.habitSummary?.completed || 0);
  const habitsTotal = Number(todayData?.habitSummary?.total || 5);
  const habitsDone = Boolean(todayData?.habitAllDone);

  const showWeeklyCheckIn = Boolean(todayData?.isFriday);
  const checkinDone = Boolean(fridayData?.checkinComplete);

  const taskCount = showWeeklyCheckIn ? 2 : 1;

  return (
    <section className="ia-tile ia-tile-pad mb-2">
      <div className="ia-section-header">
        <div className="ia-kicker">
          <i className="fas fa-list-check" />
          TASKS
        </div>

        <button
          type="button"
          className="ia-btn ia-btn-outline ia-task-toggle"
          onClick={() => setOpen((v) => !v)}
        >
          <i className={`fas fa-chevron-${open ? "up" : "down"}`} />
          <span>
            {taskCount} task{taskCount === 1 ? "" : "s"}
          </span>
        </button>
      </div>

      {open ? (
        <div className="ia-task-list">
          <CompactTaskRow
            title="Daily habits"
            subtitle={
              habitsDone
                ? "Completed for today."
                : `${habitsCompleted}/${habitsTotal} completed today.`
            }
            badge={`${habitsCompleted}/${habitsTotal}`}
            href="/habit"
            buttonLabel={habitsDone ? "View" : "Open"}
          />

          {showWeeklyCheckIn ? (
            <div className="ia-task-divider">
              <CompactTaskRow
                title="Weekly check-in"
                subtitle={checkinDone ? "Completed this week." : `Open for ${fridayYMD}.`}
                href="/checkin"
                buttonLabel={checkinDone ? "View" : "Open"}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-dim small ia-task-summary">
          {showWeeklyCheckIn
            ? `${habitsCompleted}/${habitsTotal} habits • weekly check-in ${checkinDone ? "done" : "open"}`
            : `${habitsCompleted}/${habitsTotal} habits logged`}
        </div>
      )}
    </section>
  );
}

export default function IronAcreHome() {
  const { data: session, status } = useSession();
  const router = useRouter();
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

  const {
    data: workoutData,
    error: workoutError,
  } = useSWR<Workout>(
    mounted && workoutId ? `/api/workouts/${encodeURIComponent(workoutId)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  const resolvedWorkout = useMemo(() => {
    if (!workoutData) return null;
    return String(workoutData?.workout_id || "") === workoutId ? workoutData : null;
  }, [workoutData, workoutId]);

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

  const profileLoaded = !profileKey || !!profile || !!profileError;

  const onboardingComplete = useMemo(() => {
    return isIronAcreOnboardingComplete(profile || null);
  }, [profile]);

  useEffect(() => {
    if (!mounted) return;
    if (status === "loading") return;
    if (!session) return;
    if (!profileLoaded) return;

    if (!onboardingComplete) {
      router.replace(`/onboarding?returnTo=${encodeURIComponent("/iron-acre")}`);
    }
  }, [mounted, status, session, profileLoaded, onboardingComplete, router]);

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
      const checkoutRes = await fetch("/api/bookings/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: json.booking_id }),
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

  const coreReady =
    mounted &&
    status !== "loading" &&
    (!session || !!homeOverview || !!homeOverviewError);

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

        <main className="container py-4 ia-auth-shell">
          <section className="futuristic-card ia-auth-card">
            <h2 className="m-0">Iron Acre Gym</h2>
            <div className="text-dim mt-2">Please sign in to view your performance dashboard.</div>
            <div className="mt-3">
              <Link
                href={`/register?callbackUrl=${cb}`}
                className="btn btn-outline-light"
                style={{ borderRadius: 24 }}
              >
                Sign in
              </Link>
            </div>
          </section>
        </main>

        <BottomNav />
      </>
    );
  }

  if (session && !profileLoaded) {
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

  if (session && profileLoaded && !onboardingComplete) {
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

  const classesLoading =
    !profileError &&
    !gymsError &&
    ((!!profileKey && !profile) ||
      (mounted && isAuthed && !gymsResp) ||
      (shouldLoadSessions && !sessionsResp) ||
      (bookingsKey && !bookingsResp));

  const strengthLoading = !strengthProfile && !strengthError;
  const workoutLoading = Boolean(workoutId) && !resolvedWorkout && !workoutError;

  return (
    <>
      <Head>
        <title>Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-2 iron-acre-home ia-home-main">
        <IronAcreHeader
          userName={userName}
          dateLabel={dateLabel}
          notificationsContent={<NotificationsBanner />}
        />

        <TasksCard
          todayData={todayData}
          fridayYMD={homeOverview?.fridayYMD || ""}
          fridayData={fridayData}
          compactDefaultOpen={false}
        />

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

        {workoutLoading ? (
          <SectionLoadingCard title="Workout" icon="fa-dumbbell" />
        ) : (
          <IronAcreWorkoutCard
            title={workoutTitle}
            workout={resolvedWorkout}
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
        )}

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
