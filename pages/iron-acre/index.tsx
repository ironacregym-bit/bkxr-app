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
import IronAcreTasks from "../../components/iron-acre/IronAcreTasks";
import IronAcreNutritionCard from "../../components/iron-acre/IronAcreNutritionCard";
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

  const { data: homeOverview } = useSWR<IronAcreHomeOverviewResponse>(
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

  const { data: strengthProfile } = useSWR(
    mounted ? "/api/strength/profile/get" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  const { data: gymsResp } = useSWR(
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
        <IronAcreHeader
          userName={userName}
          dateLabel={dateLabel}
          notificationsContent={<NotificationsBanner />}
        />

        <IronAcreTasks
          todayKey={effectiveTodayKey}
          todayData={todayData}
          fridayYMD={homeOverview?.fridayYMD || ""}
          fridayData={fridayData}
          weekDays={homeOverview?.days || []}
          weekStartYMD={homeOverview?.weekStartYMD || ""}
          weekEndYMD={homeOverview?.weekEndYMD || ""}
          weeklyTotals={homeOverview?.weeklyTotals}
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

        <div className="row g-2">
          <div className="col-12 col-lg-6">
            <IronAcreStrengthSummary profile={strengthProfile?.profile} />
          </div>

          <div className="col-12 col-lg-6">
            <IronAcreRecentSessions />
          </div>
        </div>
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
