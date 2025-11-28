
import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function getWeek() {
  const today = new Date();
  const day = today.getDay();
  const diffToMon = (day + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function Home() {
  const { data: session, status } = useSession();

  // Fetch workouts for current week
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  // Fetch completion history for logged-in user with range
  const [range, setRange] = useState<"week" | "month" | "all">("week");
  const { data: completionData } = useSWR(
    session?.user?.email
      ? `/api/completions/history?email=${encodeURIComponent(session.user.email)}&range=${range}`
      : null,
    fetcher
  );

  const completedIds =
    completionData?.history?.map((h: any) => h.workout_id) || [];

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      fetch("/api/users/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.user.email,
          name: session.user.name || "",
          image: session.user.image || "",
        }),
      }).catch(() => {});
    }
  }, [status, session?.user?.email]);

  const weekDays = getWeek();
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  const hour = today.getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const getDayName = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "long" });

  const selectedDayName = getDayName(selectedDay);

  // Filter workouts for selected day using day_name
  const selectedWorkouts = (data?.workouts || []).filter(
    (w: any) => (w.day_name || "").toLowerCase() === selectedDayName.toLowerCase()
  );

  // Compute stats from completionData
  const now = new Date();
  let startDate: Date;
  if (range === "week") {
    startDate = new Date();
    startDate.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
    startDate.setHours(0, 0, 0, 0);
  } else if (range === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    startDate = new Date(2000, 0, 1);
  }

  const filteredCompletions = (completionData?.history || []).filter((c: any) => {
    const completedAt = new Date(c.completed_date); // ✅ use completed_date
    return completedAt >= startDate && completedAt <= now;
  });

  const workoutsCompleted = filteredCompletions.length;
  const caloriesBurned = filteredCompletions.reduce(
    (sum: number, c: any) => sum + (c.calories_burned || 0),
    0
  );
  const setsCompleted = filteredCompletions.reduce(
    (sum: number, c: any) => sum + (c.sets_completed || 0),
    0
  );

  // Determine which days have workouts using day_name
  const daysWithWorkout = weekDays.map((d) => {
    const dayName = getDayName(d);
    return (data?.workouts || []).some(
      (w: any) => (w.day_name || "").toLowerCase() === dayName.toLowerCase()
    );
  });

  return (
    <>
      <Head>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
      </Head>
      <main className="container py-3" style={{ paddingBottom: "70px" }}>
        <h2 className="mb-4 text-center">
          {greeting}, {session?.user?.name || "Athlete"}
        </h2>

        {/* Range Filter Buttons */}
        <div className="d-flex justify-content-center gap-2 mb-3">
          {["week", "month", "all"].map((r) => (
