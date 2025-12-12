
import Head from "next/head";
import useSWR from "swr";
import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import AddToHomeScreen from "../components/AddToHomeScreen";
import DailyTasksCard from "../components/DailyTasksCard";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function Home() {
  const { data: session, status } = useSession();
  const [selectedDay, setSelectedDay] = useState(new Date());

  const greeting = new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 18 ? "Good Afternoon" : "Good Evening";

  const weekDays = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, []);

  const weekStartKey = useMemo(() => new Date().toLocaleDateString("en-CA"), []);
  const { data: weeklyOverview } = useSWR(`/api/weekly/overview?week=${weekStartKey}`, fetcher);

  const selectedDateKey = selectedDay.toLocaleDateString("en-CA");
  const selectedDayData = weeklyOverview?.days?.find((d: any) => d.dateKey === selectedDateKey);

  return (
    <>
      <Head>
        <title>BXKR</title>
      </Head>

      <main className="bxkr-container">
        {/* Hero Section */}
        <section className="bxkr-hero">
          <h1 className="hero-title">Your Fight Week Progress</h1>
          <div className="hero-stats">
            <div className="hero-stat">
              <span>Workouts</span>
              <strong>{weeklyOverview?.weeklyTotals?.totalWorkoutsCompleted ?? 0}</strong>
            </div>
            <div className="hero-stat">
              <span>Calories Burned</span>
              <strong>{weeklyOverview?.weeklyTotals?.totalCaloriesBurned ?? 0}</strong>
            </div>
            <div className="hero-stat">
              <span>Time</span>
              <strong>{weeklyOverview?.weeklyTotals?.totalWorkoutTime ?? 0} min</strong>
            </div>
          </div>
        </section>

        {/* Greeting */}
        <h2 className="bxkr-greeting">{greeting}</h2>

        {/* Calendar */}
        <div className="bxkr-calendar">
          {weekDays.map((d, i) => (
            <div key={i} className="calendar-day" onClick={() => setSelectedDay(d)}>
              <div className="calendar-label">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</div>
              <div className="calendar-icon">
                <img src="/icons/boxing-pad.svg" alt="Day Icon" />
              </div>
            </div>
          ))}
        </div>

        {/* Daily Tasks */}
        {selectedDayData && (
          <DailyTasksCard
            dayLabel={`${selectedDay.toLocaleDateString(undefined, { weekday: "long" })}, ${selectedDay.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
            nutritionSummary={selectedDayData.nutritionSummary}
            nutritionLogged={Boolean(selectedDayData.nutritionLogged)}
            workoutSummary={selectedDayData.workoutSummary}
            hasWorkout={Boolean(selectedDayData.hasWorkout)}
            workoutDone={Boolean(selectedDayData.workoutDone)}
            habitSummary={selectedDayData.habitSummary}
            habitAllDone={Boolean(selectedDayData.habitAllDone)}
            checkinSummary={selectedDayData.checkinSummary}
            checkinComplete={Boolean(selectedDayData.checkinComplete)}
            hrefs={{
              nutrition: `/nutrition?date=${selectedDateKey}`,
              workout: `/workout/${selectedDayData.workoutIds?.[0] ?? "#"}`,
              habit: `/habit?date=${selectedDateKey}`,
              checkin: `/checkin`,
            }}
          />
        )}
      </main>

      {/* Floating Bottom Navigation */}
      <BottomNav />
      <AddToHomeScreen />
    </>
  );
}
