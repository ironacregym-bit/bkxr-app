
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

// ===== Helpers =====
function isYMD(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
// Local YYYY-MM-DD to avoid ISO/BST drift
function formatYMD(d: Date): string {
  return d.toLocaleDateString("en-CA");
}
function parseYMD(ymd: string): Date {
  const [y, m, dd] = ymd.split("-").map(Number);
  return new Date(y, m - 1, dd, 0, 0, 0, 0);
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
function inRange(day: Date, start: Date, end: Date) {
  return day >= start && day <= end;
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
      d.setHours(0, 0, 0, 0);
      return d;
    });

    // ===== Habits (daily doc by buildDocId) =====
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

    // ===== Check-ins (Friday only, with last Friday deltas) =====
    const checkinDocRef = firestore.collection(CHECKINS_COLLECTION).doc(buildDocId(userEmail, fridayYMD));
    const checkinSnap = await checkinDocRef.get();
    const currentCheckin = checkinSnap.exists ? checkinSnap.data() : null;

    const lastCheckinRef = firestore.collection(CHECKINS_COLLECTION).doc(buildDocId(userEmail, lastFridayYMD));
    const lastCheckinSnap = await lastCheckinRef.get();
    const lastCheckin = lastCheckinSnap.exists ? lastCheckinSnap.data() : null;

    // ===== Nutrition (presence + totals per day) =====
    const nutritionMap: Record<string, { logged: boolean; calories: number; protein: number }> = {};
    for (const d of weekDays) {
      const ymd = formatYMD(d);
      const snap = await firestore.collection(NUTRITION_COLLECTION).doc(userEmail).collection(ymd).get();
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

    // ===== Workouts for the week (scope to user; range fallback if index missing) =====
    let workoutsSnap: any;
    try {
      workoutsSnap = await firestore
        .collection(WORKOUTS_COLLECTION)
        .where("user_email", "==", userEmail)
        .where("date", ">=", weekStart)
        .where("date", "<=", weekEnd)
        .get();
    } catch (e) {
      // fallback: filter in memory
      const allByUser = await firestore.collection(WORKOUTS_COLLECTION).where("user_email", "==", userEmail).get();
      const filteredDocs = allByUser.docs.filter((doc) => {
        const w = doc.data() as any;
        const dt = w.date?.toDate ? w.date.toDate() : new Date(w.date);
        return inRange(dt, weekStart, weekEnd);
      });
      workoutsSnap = { docs: filteredDocs };
    }

    const workoutsByDay = new Map<string, { id: string; name?: string }[]>();
    const allWeekWorkoutIds: string[] = [];
    (workoutsSnap.docs || []).forEach((doc: any) => {
      const w = doc.data() as any;
      const d = w.date?.toDate ? w.date.toDate() : new Date(w.date);
      const dk = formatYMD(d);
      const id = String(w.workout_id || w.id || doc.id);
      const name = typeof w.workout_name === "string" ? w.workout_name : undefined;
      const arr = workoutsByDay.get(dk) || [];
      arr.push({ id, name });
      workoutsByDay.set(dk, arr);
      if (id) allWeekWorkoutIds.push(id);
    });

    // ===== Completions for THIS WEEK (for weekly totals only) =====
    let completionsWeekSnap: any;
    try {
      completionsWeekSnap = await firestore
        .collection(COMPLETIONS_COLLECTION)
        .where("user_email", "==", userEmail)
        .where("completed_date", ">=", weekStart)
        .where("completed_date", "<=", weekEnd)
        .get();

      if (completionsWeekSnap.empty) {
        completionsWeekSnap = await firestore
          .collection(COMPLETIONS_COLLECTION)
          .where("user_email", "==", userEmail)
          .where("date_completed", ">=", weekStart)
          .where("date_completed", "<=", weekEnd)
          .get();
      }
    } catch (e) {
      const allByUser = await firestore.collection(COMPLETIONS_COLLECTION).where("user_email", "==", userEmail).get();
      const filteredDocs = allByUser.docs.filter((doc) => {
        const c = doc.data() as any;
        const dt = c.completed_date?.toDate?.() || c.date_completed?.toDate?.() || null;
        return dt ? inRange(dt, weekStart, weekEnd) : false;
      });
      completionsWeekSnap = { docs: filteredDocs };
    }

    // ===== Completions by workout_id (ANY DAY) for “done” state =====
    // We don’t apply a date range here — if a workout has a completion anywhere in history, it’s counted done.
    // For efficiency, we still filter by user_email.
    const completionsAllUserSnap = await firestore
      .collection(COMPLETIONS_COLLECTION)
      .where("user_email", "==", userEmail)
      .get();

    const completionsByWorkoutIdAnyDay = new Map<
      string,
      { calories_burned?: number; duration?: number; weight_completed_with?: string | number; completedAt?: Date }[]
    >();

    (completionsAllUserSnap.docs || []).forEach((doc: any) => {
      const c = doc.data() as any;
      const id = String(c.workout_id || "");
      if (!id) return;
      const completedAt: Date | undefined =
        c.completed_date?.toDate?.() || c.date_completed?.toDate?.() || undefined;
      const row = {
        calories_burned: typeof c.calories_burned === "number" ? c.calories_burned : undefined,
        duration: typeof c.duration === "number" ? c.duration : undefined,
        weight_completed_with:
          c.weight_completed_with ??
          c.weight_compelted_with /* legacy typo */ ??
          c.weight_used ??
          undefined,
        completedAt
      };
      const arr = completionsByWorkoutIdAnyDay.get(id) || [];
      arr.push(row);
      completionsByWorkoutIdAnyDay.set(id, arr);
    });

    // ===== Aggregate weekly totals =====
    let totalTasks = 0;
    let completedTasks = 0;
    let totalWorkoutsCompleted = 0;
    let totalWorkoutTime = 0;
    let totalCaloriesBurned = 0;

    // Precompute weekly sums from THIS WEEK completions
    (completionsWeekSnap.docs || []).forEach((doc: any) => {
      const c = doc.data() as any;
      totalWorkoutsCompleted += 1;
      totalWorkoutTime += Number(c.duration || 0);
      totalCaloriesBurned += Number(c.calories_burned || 0);
    });

    const days: DayOverview[] = weekDays.map((d) => {
      const ymd = formatYMD(d);
      const isFriday = d.getDay() === 5;

      // Habits
      const habitInfo = habitMap[ymd] || { allDone: false, completed: 0, total: 5 };

      // Nutrition
      const nutritionInfo = nutritionMap[ymd] || { logged: false, calories: 0, protein: 0 };

      // Workouts scheduled on this day
      const todaysWorkouts = workoutsByDay.get(ymd) || [];
      const workoutIds = todaysWorkouts.map((w) => w.id);
      const hasWorkout = todaysWorkouts.length > 0;

      // === WorkoutDone: ANY-DAY completion by workout_id ===
      const anyDayCompletionArray = workoutIds
        .map((id) => completionsByWorkoutIdAnyDay.get(id))
        .filter(Boolean) as Array<
        { calories_burned?: number; duration?: number; weight_completed_with?: string | number; completedAt?: Date }[]
      >;

      const workoutDone = hasWorkout && anyDayCompletionArray.length > 0;

      // Choose the most recent completion (if any) to surface in the summary
      let workoutCalories = 0;
      let workoutDuration = 0;
      let weightUsed: string | undefined;
      if (workoutDone) {
        const flat = ([] as any[]).concat(...anyDayCompletionArray);
        flat.sort((a, b) => {
          const ta = a.completedAt?.getTime?.() ?? 0;
          const tb = b.completedAt?.getTime?.() ?? 0;
          return tb - ta;
        });
        const latest = flat[0] || {};
        workoutCalories = Number(latest.calories_burned || 0);
        workoutDuration = Number(latest.duration || 0);
        if (latest.weight_completed_with != null) {
          weightUsed =
            typeof latest.weight_completed_with === "number"
              ? `${latest.weight_completed_with}kg`
              : String(latest.weight_completed_with);
        }
      }

      // Check-in (Friday only)
      const checkinCompleteForDay = isFriday && (currentCheckin?.weight != null || currentCheckin?.bodyFat != null);
      const weightChange =
        currentCheckin?.weight != null && lastCheckin?.weight != null
          ? ((currentCheckin.weight - lastCheckin.weight) / lastCheckin.weight) * 100
          : undefined;
      const bfChange =
        currentCheckin?.bodyFat != null && lastCheckin?.bodyFat != null
          ? currentCheckin.bodyFat - lastCheckin.bodyFat
          : undefined;

      // Tasks & completes — EXACTLY what UI shows
      const dayTasks = 1 /* nutrition */ + 1 /* habit */ + (hasWorkout ? 1 : 0) + (isFriday ? 1 : 0);
      totalTasks += dayTasks;

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
