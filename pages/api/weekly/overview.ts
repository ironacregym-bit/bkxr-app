
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
// Local YYYY-MM-DD to avoid timezone drift vs ISO
function formatYMD(d: Date): string {
  return d.toLocaleDateString("en-CA");
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
// Parse YYYY-MM-DD safely as local date
function parseYMD(ymd: string): Date {
  const [y, m, dd] = ymd.split("-").map(Number);
  return new Date(y, m - 1, dd, 0, 0, 0, 0);
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

    // Use local parsing to avoid ISO/Z off-by-one in BST
    const weekDate = parseYMD(weekQ);
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

    // HABITS (top-level doc per day using buildDocId)
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

    // CHECK-IN (this Friday + last Friday)
    const checkinDocRef = firestore.collection(CHECKINS_COLLECTION).doc(buildDocId(userEmail, fridayYMD));
    const checkinSnap = await checkinDocRef.get();
    const checkinComplete = checkinSnap.exists;
    const currentCheckin = checkinSnap.exists ? checkinSnap.data() : null;

    const lastCheckinRef = firestore.collection(CHECKINS_COLLECTION).doc(buildDocId(userEmail, lastFridayYMD));
    const lastCheckinSnap = await lastCheckinRef.get();
    const lastCheckin = lastCheckinSnap.exists ? lastCheckinSnap.data() : null;

    // NUTRITION (presence/results per day)
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
          calories += Number(data.calories || data.total_calories || 0);
          protein += Number(data.protein || data.total_protein || 0);
        });
        nutritionMap[ymd] = { logged: true, calories, protein };
      }
    }

    // WORKOUTS for the week (scope to user)
    const workoutsSnap = await firestore
      .collection(WORKOUTS_COLLECTION)
      .where("user_email", "==", userEmail)
      .where("date", ">=", weekStart)
      .where("date", "<=", weekEnd)
      .get();

    const workoutsByDay = new Map<string, { id: string; name?: string }[]>();
    workoutsSnap.docs.forEach((doc) => {
      const w = doc.data() as any;
      const d = w.date?.toDate ? w.date.toDate() : new Date(w.date);
      const dk = formatYMD(d);
      const id = String(w.workout_id || w.id || doc.id);
      const name = typeof w.workout_name === "string" ? w.workout_name : undefined;
      const arr = workoutsByDay.get(dk) || [];
      arr.push({ id, name });
      workoutsByDay.set(dk, arr);
    });

    // COMPLETIONS for the week (tolerate both completed_date and date_completed)
    // Try completed_date first; if empty, fallback to date_completed
    const completionsPrimaryQ = firestore
      .collection(COMPLETIONS_COLLECTION)
      .where("user_email", "==", userEmail)
      .where("completed_date", ">=", weekStart)
      .where("completed_date", "<=", weekEnd);

    let completionsSnap = await completionsPrimaryQ.get();

    if (completionsSnap.empty) {
      const completionsFallbackQ = firestore
        .collection(COMPLETIONS_COLLECTION)
        .where("user_email", "==", userEmail)
        .where("date_completed", ">=", weekStart)
        .where("date_completed", "<=", weekEnd);
      completionsSnap = await completionsFallbackQ.get();
    }

    const completionsByWorkoutId = new Map<
      string,
      { calories_burned?: number; duration?: number; weight_completed_with?: string | number; completedAt?: Date }
    >();

    completionsSnap.docs.forEach((doc) => {
      const c = doc.data() as any;
      const id = String(c.workout_id || "");
      if (!id) return;
      const completedAt: Date | undefined =
        c.completed_date?.toDate?.() ||
        c.date_completed?.toDate?.() ||
        undefined;
      completionsByWorkoutId.set(id, {
        calories_burned: typeof c.calories_burned === "number" ? c.calories_burned : undefined,
        duration: typeof c.duration === "number" ? c.duration : undefined,
        weight_completed_with:
          c.weight_completed_with ??
          c.weight_compelted_with ?? // tolerate legacy typo
          c.weight_used ??
          undefined,
        completedAt
      });
    });

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
      const habitInfo = habitMap[ymd] || { allDone: false, completed: 0, total: 5 };

      // Nutrition
      const nutritionInfo = nutritionMap[ymd] || { logged: false, calories: 0, protein: 0 };

      // Workouts
      const todaysWorkouts = workoutsByDay.get(ymd) || [];
      const workoutIds = todaysWorkouts.map((w) => w.id);
      const hasWorkout = todaysWorkouts.length > 0;

      // Workout completion by workout_id join (reliable vs date equality)
      const completion = workoutIds.map((id) => completionsByWorkoutId.get(id)).find(Boolean);
      const workoutDone = hasWorkout && !!completion;

      // Workout summary
      let workoutCalories = 0;
      let workoutDuration = 0;
      let weightUsed: string | undefined = undefined;

      if (completion) {
        workoutCalories += Number(completion.calories_burned || 0);
        workoutDuration += Number(completion.duration || 0);
        if (completion.weight_completed_with != null) {
          weightUsed =
            typeof completion.weight_completed_with === "number"
              ? `${completion.weight_completed_with}kg`
              : String(completion.weight_completed_with);
        }
        totalWorkoutsCompleted += 1;
        totalWorkoutTime += workoutDuration;
        totalCaloriesBurned += workoutCalories;
      }

      // Check-in for Friday only
      const checkinForFriday = isFriday && (currentCheckin?.weight != null || currentCheckin?.bodyFat != null);
      const checkinCompleteForDay = isFriday ? Boolean(checkinComplete && checkinForFriday) : false;

      const weightChange =
        currentCheckin?.weight != null && lastCheckin?.weight != null
          ? ((currentCheckin.weight - lastCheckin.weight) / lastCheckin.weight) * 100
          : undefined;
      const bfChange =
        currentCheckin?.bodyFat != null && lastCheckin?.bodyFat != null
          ? currentCheckin.bodyFat - lastCheckin.bodyFat
          : undefined;

      // Day tasks: nutrition + habit + (hasWorkout?1:0) + (isFriday?1:0)
      const dayTasks = 1 + 1 + (hasWorkout ? 1 : 0) + (isFriday ? 1 : 0);
      totalTasks += dayTasks;

      // Day completes: same booleans used in UI
      const dayCompleted =
        (nutritionInfo.logged ? 1 : 0) +
        (habitInfo.allDone ? 1 : 0) +
        (hasWorkout && workoutDone ? 1 : 0) +
        (isFriday && checkinCompleteForDay ? 1 : 0);
      completedTasks += dayCompleted;

      return {
        dateKey: ymd,
        isFriday,
        nutritionLogged: nutritionInfo.logged,
        nutritionSummary: { calories: nutritionInfo.calories, protein: nutritionInfo.protein },
        habitAllDone: habitInfo.allDone,
        habitSummary: { completed: habitInfo.completed, total: habitInfo.total },
        checkinComplete: checkinCompleteForDay,
        checkinSummary:
          isFriday && checkinCompleteForDay
            ? {
                weight: currentCheckin?.weight || 0,
                bodyFat: currentCheckin?.bodyFat || 0,
                weightChange,
                bfChange
              }
            : undefined,
        hasWorkout,
        workoutDone,
        workoutIds,
        workoutSummary: workoutDone
          ? { calories: workoutCalories, duration: workoutDuration, weightUsed }
          : undefined
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
