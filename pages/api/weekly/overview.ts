
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole } from "../../../lib/rbac";

type DayOverview = {
  dateKey: string;
  isFriday: boolean;
  nutritionLogged: boolean;
  nutritionSummary?: { calories: number; protein: number };
  habitAllDone: boolean;
  habitSummary?: { completed: number; total: number };
  checkinComplete: boolean;
  checkinSummary?: { weight: number; bodyFat: number; weightChange?: number; bfChange?: number };
  hasWorkout: boolean;
  workoutDone: boolean;
  workoutIds: string[];
  workoutSummary?: { calories: number; duration: number; weightUsed?: string };
};

type WeeklyOverviewResponse = {
  weekStartYMD: string;
  weekEndYMD: string;
  fridayYMD: string;
  days: DayOverview[];
  weeklyTotals: {
    totalTasks: number;
    completedTasks: number;
    totalWorkoutsCompleted: number;
    totalWorkoutTime: number; // minutes
    totalCaloriesBurned: number;
  };
};

// Collections
const HABITS_COLLECTION = "habitLogs";
const CHECKINS_COLLECTION = "check_ins";
const NUTRITION_COLLECTION = "nutrition_logs";
const WORKOUTS_COLLECTION = "workouts";
const COMPLETIONS_COLLECTION = "workoutCompletions";

// Helpers
function isYMD(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function formatYMD(d: Date): string {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n.toISOString().slice(0, 10);
}
function startOfAlignedWeek(d: Date): Date {
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s;
}
function endOfAlignedWeek(d: Date): Date {
  const s = startOfAlignedWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function fridayOfWeek(d: Date): Date {
  const s = startOfAlignedWeek(d);
  const f = new Date(s);
  f.setDate(s.getDate() + 4);
  f.setHours(0, 0, 0, 0);
  return f;
}
function buildDocId(email: string, ymd: string): string {
  return `${email}__${ymd}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: "Not signed in" });
    if (!hasRole(session, ["user", "gym", "admin"])) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const userEmail: string | undefined = (session.user as any)?.email;
    if (!userEmail) return res.status(400).json({ error: "Unable to resolve user email" });

    const weekQ = String(req.query.week || formatYMD(new Date()));
    if (!isYMD(weekQ)) return res.status(400).json({ error: "Invalid week format. Use YYYY-MM-DD." });

    const weekDate = new Date(`${weekQ}T00:00:00Z`);
    const weekStart = startOfAlignedWeek(weekDate);
    const weekEnd = endOfAlignedWeek(weekDate);
    const friday = fridayOfWeek(weekDate);

    const weekStartYMD = formatYMD(weekStart);
    const weekEndYMD = formatYMD(weekEnd);
    const fridayYMD = formatYMD(friday);

    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastFriday = fridayOfWeek(lastWeekStart);
    const lastFridayYMD = formatYMD(lastFriday);

    const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });

    // HABITS
    const habitDocRefs = weekDays.map((d) =>
      firestore.collection(HABITS_COLLECTION).doc(buildDocId(userEmail, formatYMD(d)))
    );
    const habitSnaps = await firestore.getAll(...habitDocRefs);
    const habitMap: Record<string, { allDone: boolean; completed: number; total: number }> = {};
    habitSnaps.forEach((snap) => {
      const ymd = snap.id.split("__")[1] || "";
      if (!snap.exists) {
        habitMap[ymd] = { allDone: false, completed: 0, total: 5 };
      } else {
        const data = snap.data() || {};
        const completedCount = [
          data["2l_water"],
          data.assigned_workouts_completed,
          data.macros_filled,
          data.step_count,
          data.time_outside,
        ].filter(Boolean).length;
        habitMap[ymd] = { allDone: completedCount === 5, completed: completedCount, total: 5 };
      }
    });

    // CHECK-IN (current + last week)
    const checkinDocRef = firestore.collection(CHECKINS_COLLECTION).doc(buildDocId(userEmail, fridayYMD));
    const checkinSnap = await checkinDocRef.get();
    const checkinComplete = checkinSnap.exists;
    const currentCheckin = checkinSnap.exists ? checkinSnap.data() : null;

    const lastCheckinRef = firestore.collection(CHECKINS_COLLECTION).doc(buildDocId(userEmail, lastFridayYMD));
    const lastCheckinSnap = await lastCheckinRef.get();
    const lastCheckin = lastCheckinSnap.exists ? lastCheckinSnap.data() : null;

    // NUTRITION
    const nutritionMap: Record<string, { logged: boolean; calories: number; protein: number }> = {};
    for (const d of weekDays) {
      const ymd = formatYMD(d);
      const snap = await firestore
        .collection(NUTRITION_COLLECTION)
        .doc(userEmail)
        .collection(ymd)
        .get();
      if (snap.empty) {
        nutritionMap[ymd] = { logged: false, calories: 0, protein: 0 };
      } else {
        let calories = 0;
        let protein = 0;
        snap.docs.forEach((doc) => {
          const data = doc.data();
          calories += Number(data.calories || 0);
          protein += Number(data.protein || 0);
        });
        nutritionMap[ymd] = { logged: true, calories, protein };
      }
    }

    // WORKOUTS for the week
    const workoutsSnap = await firestore
      .collection(WORKOUTS_COLLECTION)
      .where("date", ">=", weekStart)
      .where("date", "<=", weekEnd)
      .get();
    const workouts = workoutsSnap.docs.map(doc => doc.data());

    // COMPLETIONS for the week
    const completionsSnap = await firestore
      .collection(COMPLETIONS_COLLECTION)
      .where("user_email", "==", userEmail)
      .where("date_completed", ">=", weekStart)
      .where("date_completed", "<=", weekEnd)
      .get();
    const completions = completionsSnap.docs.map(doc => doc.data());

    // Aggregate weekly totals
    let totalTasks = 0;
    let completedTasks = 0;
    let totalWorkoutsCompleted = 0;
    let totalWorkoutTime = 0;
    let totalCaloriesBurned = 0;

    const days: DayOverview[] = weekDays.map((d) => {
      const ymd = formatYMD(d);
      const isFriday = d.getDay() === 5;

      // Habits
      const habitInfo = habitMap[ymd];

      // Nutrition
      const nutritionInfo = nutritionMap[ymd];

      // Workouts
      const dayWorkouts = workouts.filter(w => {
        const workoutDate = formatYMD(w.date?.toDate ? w.date.toDate() : new Date(w.date));
        return workoutDate === ymd;
      });
      const hasWorkout = dayWorkouts.length > 0;
      const workoutIds = dayWorkouts.map(w => w.workout_id);

      // Completions
      const dayCompletions = completions.filter(c => {
        const completedDate = formatYMD(c.date_completed?.toDate ? c.date_completed.toDate() : new Date(c.date_completed));
        return completedDate === ymd;
      });
      const workoutDone = dayCompletions.length > 0;

      // Workout summary
      let workoutCalories = 0;
      let workoutDuration = 0;
      let weightUsed = "";
      dayCompletions.forEach(c => {
        workoutCalories += Number(c.calories_burned || 0);
        workoutDuration += Number(c.duration || 0);
        if (c.weight_completed_with) weightUsed = c.weight_completed_with;
      });

      // Weekly totals aggregation
      const dayTasks = 1 + 1 + 1 + (isFriday ? 1 : 0); // nutrition + habits + workout + check-in if Friday
      totalTasks += dayTasks;
      let dayCompleted = 0;
      if (nutritionInfo.logged) dayCompleted++;
      if (habitInfo.allDone) dayCompleted++;
      if (!hasWorkout || workoutDone) dayCompleted++;
      if (isFriday && checkinComplete) dayCompleted++;
      completedTasks += dayCompleted;

      if (workoutDone) {
        totalWorkoutsCompleted += dayCompletions.length;
        totalWorkoutTime += workoutDuration;
        totalCaloriesBurned += workoutCalories;
      }

      return {
        dateKey: ymd,
        isFriday,
        nutritionLogged: nutritionInfo.logged,
        nutritionSummary: { calories: nutritionInfo.calories, protein: nutritionInfo.protein },
        habitAllDone: habitInfo.allDone,
        habitSummary: { completed: habitInfo.completed, total: habitInfo.total },
        checkinComplete: isFriday ? checkinComplete : false,
        checkinSummary: isFriday && currentCheckin ? {
          weight: currentCheckin.weight || 0,
          bodyFat: currentCheckin.bodyFat || 0,
          weightChange: lastCheckin ? ((currentCheckin.weight - lastCheckin.weight) / lastCheckin.weight) * 100 : undefined,
          bfChange: lastCheckin ? ((currentCheckin.bodyFat - lastCheckin.bodyFat) / lastCheckin.bodyFat) * 100 : undefined
        } : undefined,
        hasWorkout,
        workoutDone,
        workoutIds,
        workoutSummary: workoutDone ? { calories: workoutCalories, duration: workoutDuration, weightUsed } : undefined
      };
    });

    res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");

    const payload: WeeklyOverviewResponse = {
      weekStartYMD,
      weekEndYMD,
      fridayYMD,
      days,
      weeklyTotals: {
        totalTasks,
        completedTasks,
        totalWorkoutsCompleted,
        totalWorkoutTime,
        totalCaloriesBurned
      }
    };

    return res.status(200).json(payload);
  } catch (err: any) {
    console.error("[weekly/overview] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to build weekly overview" });
  }
}
