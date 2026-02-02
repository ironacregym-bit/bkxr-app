import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole } from "../../../lib/rbac";

/** ===== Types ===== */
type SimpleWorkoutRef = { id: string; name?: string };

type DayOverview = {
  dateKey: string;
  isFriday: boolean;

  // Nutrition
  nutritionLogged: boolean;
  nutritionSummary?: { calories: number; protein: number };

  // Habits
  habitAllDone: boolean;
  habitSummary?: { completed: number; total: number };

  // Weekly check-in
  checkinComplete: boolean;
  checkinSummary?: { weight: number; body_fat_pct: number; weightChange?: number; bfChange?: number };

  // Mandatory workout (recurring if present; else BXKR/programmed)
  hasWorkout: boolean;
  workoutDone: boolean;
  workoutIds: string[];
  workoutSummary?: { calories: number; duration: number; weightUsed?: string };

  // Recurring vs Optional split
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
  weeklyTotals: {
    totalTasks: number;
    completedTasks: number;
    totalWorkoutsCompleted: number;
    totalWorkoutTime: number;
    totalCaloriesBurned: number;
  };
};

/** ===== Collections ===== */
const HABITS_COLLECTION = "habitLogs";
const CHECKINS_COLLECTION = "check_ins";
const NUTRITION_COLLECTION = "nutrition_logs";
const WORKOUTS_COLLECTION = "workouts";
const COMPLETIONS_COLLECTION = "workoutCompletions";
const ASSIGNMENTS_COLLECTION = "workout_assignments"; // Recurring assignments

/** ===== Helpers ===== */
function isYMD(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function formatYMD(d: Date): string {
  // 'en-CA' yields YYYY-MM-DD
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
function inRange(day: Date, start: Date, end: Date) {
  return day >= start && day <= end;
}
function numOrUndefined(v: any): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toDate(v: any): Date | null {
  try {
    if (!v) return null;
    if (typeof v.toDate === "function") return v.toDate();
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WeeklyOverviewResponse | { error: string }>
) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: "Not signed in" });
    if (!hasRole(session, ["user", "gym", "admin"])) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const userEmailRaw: string | undefined = (session.user as any)?.email;
    if (!userEmailRaw) return res.status(400).json({ error: "Unable to resolve user email" });
    const userEmail = userEmailRaw.toLowerCase();

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

    /** ===== HABITS ===== */
    const habitDocRefs = weekDays.map((d) =>
      firestore.collection(HABITS_COLLECTION).doc(`${userEmail}__${formatYMD(d)}`)
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

    /** ===== CHECK-INS ===== */
    const checkinSnap = await firestore.collection(CHECKINS_COLLECTION).doc(`${userEmail}__${fridayYMD}`).get();
    const currentCheckin = checkinSnap.exists ? checkinSnap.data() : null;

    const lastCheckinSnap = await firestore.collection(CHECKINS_COLLECTION).doc(`${userEmail}__${lastFridayYMD}`).get();
    const lastCheckin = lastCheckinSnap.exists ? lastCheckinSnap.data() : null;

    const currentWeight = numOrUndefined(currentCheckin?.weight);
    const lastWeight = numOrUndefined(lastCheckin?.weight);
    const currentBodyFat = numOrUndefined(currentCheckin?.body_fat_pct);
    const lastBodyFat = numOrUndefined(lastCheckin?.body_fat_pct);

    /** ===== NUTRITION ===== */
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

    /** ===== PROGRAMMED WORKOUTS (explicit date) ===== */
    let workoutsSnap: any;
    try {
      workoutsSnap = await firestore
        .collection(WORKOUTS_COLLECTION)
        .where("date", ">=", weekStart)
        .where("date", "<=", weekEnd)
        .get();
    } catch {
      const all = await firestore.collection(WORKOUTS_COLLECTION).get();
      const filtered = all.docs.filter((doc: any) => {
        const w = doc.data() as any;
        const dt = w.date?.toDate ? w.date.toDate() : new Date(w.date);
        return inRange(dt, weekStart, weekEnd);
      });
      workoutsSnap = { docs: filtered };
    }

    const programmedByDay = new Map<string, SimpleWorkoutRef[]>();
    (workoutsSnap.docs || []).forEach((doc: any) => {
      const w = doc.data() as any;
      const when = w.date?.toDate ? w.date.toDate() : new Date(w.date);
      const dk = formatYMD(when);
      const id = String(w.workout_id || w.id || doc.id);
      const name = typeof w.workout_name === "string" ? w.workout_name : undefined;
      const arr = programmedByDay.get(dk) || [];
      arr.push({ id, name });
      programmedByDay.set(dk, arr);
    });

    /** ===== RECURRING (assignments) ===== */
    const recurringByDay = new Map<string, SimpleWorkoutRef[]>();

    type AssignmentDoc = {
      assignment_id: string;
      user_email: string;
      workout_id: string;
      recurring_day: string; // "Monday"..."Sunday"
      start_date?: any;
      end_date?: any;
      status?: string;
    };

    let assignments: AssignmentDoc[] = [];
    try {
      const q = firestore
        .collection(ASSIGNMENTS_COLLECTION)
        .where("user_email", "==", userEmail)
        .where("status", "==", "active")
        .where("start_date", "<=", endOfAlignedWeek(weekDate));
      const snap = await q.get();
      assignments = snap.docs.map((d: any) => ({ assignment_id: d.id, ...(d.data() || {}) }));
    } catch {
      const alt = await firestore.collection(ASSIGNMENTS_COLLECTION).where("user_email", "==", userEmail).get();
      assignments = alt.docs
        .map((d: any) => ({ assignment_id: d.id, ...(d.data() || {}) }))
        .filter((a) => String(a?.status || "").toLowerCase() === "active");
    }

    const overlapping = assignments.filter((a) => {
      const s = toDate(a.start_date) || new Date(0);
      const e = toDate(a.end_date) || new Date(8640000000000000);
      return !(e < weekStart || s > weekEnd);
    });

    const assignIds = Array.from(new Set(overlapping.map((a) => String(a.workout_id || "").trim()).filter(Boolean)));
    const nameByWorkoutId = new Map<string, string | undefined>();
    if (assignIds.length) {
      const docSnaps = await Promise.all(
        assignIds.map((wid) => firestore.collection(WORKOUTS_COLLECTION).doc(wid).get())
      );
      docSnaps.forEach((snap) => {
        if (!snap.exists) return;
        const wid = snap.id;
        const w = snap.data() as any;
        const name = typeof w?.workout_name === "string" ? w.workout_name : undefined;
        nameByWorkoutId.set(wid, name);
      });
    }

    for (const a of overlapping) {
      const recDayName = String(a.recurring_day || "").trim();
      const s = toDate(a.start_date) || new Date(0);
      const e = toDate(a.end_date) || new Date(8640000000000000);
      const wid = String(a.workout_id || "").trim();
      const wname = nameByWorkoutId.get(wid);
      if (!wid || !recDayName) continue;

      weekDays.forEach((d) => {
        if (!inRange(d, s, e)) return;
        const ymd = formatYMD(d);
        const dayName = DAY_NAMES[d.getDay()];
        if (dayName === recDayName) {
          const arr = recurringByDay.get(ymd) || [];
          arr.push({ id: wid, name: wname });
          recurringByDay.set(ymd, arr);
        }
      });
    }

    /** ===== LEGACY RECURRING (now supports assigned_to: string[]) ===== */
    try {
      const arrSnap = await firestore
        .collection(WORKOUTS_COLLECTION)
        .where("recurring", "==", true)
        .where("assigned_to", "array-contains", userEmail)
        .get();

      const strSnap = await firestore
        .collection(WORKOUTS_COLLECTION)
        .where("recurring", "==", true)
        .where("assigned_to", "==", userEmail)
        .get();

      const seen = new Set<string>();
      const legacyDocs = [...(arrSnap.docs || []), ...(strSnap.docs || [])].filter((d) => {
        if (!d) return false;
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      });

      legacyDocs.forEach((doc: any) => {
        const w = doc.data() as any;
        // Safety filter: include if assigned_to contains user (array) OR equals user (string)
        const assigned = w?.assigned_to;
        const isMine = Array.isArray(assigned)
          ? assigned.map((x: any) => String(x || "").toLowerCase()).includes(userEmail)
          : String(assigned || "").toLowerCase() === userEmail;

        if (!isMine) return;

        const id = String(w.workout_id || w.id || doc.id);
        const name = typeof w.workout_name === "string" ? w.workout_name : undefined;

        const recDayName = String(w.recurring_day || "").trim();
        const startTs = w.recurring_start?.toDate?.() || (w.recurring_start ? new Date(w.recurring_start) : null);
        const endTs = w.recurring_end?.toDate?.() || (w.recurring_end ? new Date(w.recurring_end) : null);

        weekDays.forEach((d) => {
          const ymd = formatYMD(d);
          const dayName = DAY_NAMES[d.getDay()];
          const withinWindow = (!startTs || d >= startTs) && (!endTs || d <= endTs);
          if (withinWindow && dayName === recDayName) {
            const arr = recurringByDay.get(ymd) || [];
            arr.push({ id, name });
            recurringByDay.set(ymd, arr);
          }
        });
      });
    } catch {
      // Soft‑fail; legacy recurring may not exist or need index. Already covered by assignments model.
    }

    /** ===== COMPLETIONS (THIS WEEK only) — per‑week done state ===== */
    let completionsWeek: any[] = [];
    try {
      const c1 = await firestore
        .collection(COMPLETIONS_COLLECTION)
        .where("user_email", "==", userEmail)
        .where("completed_date", ">=", weekStart)
        .where("completed_date", "<=", weekEnd)
        .get();
      completionsWeek = c1.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
      if (completionsWeek.length === 0) {
        const c1b = await firestore
          .collection(COMPLETIONS_COLLECTION)
          .where("user_email", "==", userEmail)
          .where("date_completed", ">=", weekStart)
          .where("date_completed", "<=", weekEnd)
          .get();
        completionsWeek = c1b.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
      }
    } catch {
      const allByUser = await firestore.collection(COMPLETIONS_COLLECTION).where("user_email", "==", userEmail).get();
      completionsWeek = allByUser.docs
        .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
        .filter((c: any) => {
          const dt =
            c.completed_date?.toDate?.() ||
            c.date_completed?.toDate?.() ||
            (c.completed_date ? new Date(c.completed_date) : c.date_completed ? new Date(c.date_completed) : null);
          return dt ? inRange(dt, weekStart, weekEnd) : false;
        });
    }

    /** Per-week completion sets (done + latest summary by workout_id) */
    const doneInWeek = new Set<string>();
    const latestInWeekById = new Map<
      string,
      { calories_burned?: number; duration?: number; weight_completed_with?: string | number; completedAt?: Date }
    >();

    for (const c of completionsWeek) {
      const wid = String(c.workout_id || "");
      if (!wid) continue;

      const completedAt: Date | undefined =
        c.completed_date?.toDate?.() ||
        c.date_completed?.toDate?.() ||
        (c.completed_at?.toDate?.() || undefined);
      if (!completedAt || isNaN(completedAt.getTime?.() || NaN)) continue;

      doneInWeek.add(wid);

      const row = {
        calories_burned: typeof c.calories_burned === "number" ? c.calories_burned : undefined,
        duration:
          typeof c.duration === "number"
            ? c.duration
            : typeof c.duration_minutes === "number"
            ? c.duration_minutes
            : undefined,
        weight_completed_with:
          c.weight_completed_with ??
          c.weight_compelted_with /* legacy typo */ ??
          c.weight_used ??
          undefined,
        completedAt,
      };
      const prev = latestInWeekById.get(wid);
      if (!prev || (row.completedAt?.getTime?.() ?? 0) > (prev.completedAt?.getTime?.() ?? 0)) {
        latestInWeekById.set(wid, row);
      }
    }

    /** Build days (done state is per‑week) */
    let totalTasks = 0;
    let completedTasks = 0;
    let totalWorkoutsCompleted = 0;
    let totalWorkoutTime = 0;
    let totalCaloriesBurned = 0;

    completionsWeek.forEach((c: any) => {
      totalWorkoutsCompleted += 1;
      totalWorkoutTime += Number(c.duration || c.duration_minutes || 0);
      totalCaloriesBurned += Number(c.calories_burned || 0);
    });

    const days: DayOverview[] = weekDays.map((d) => {
      const ymd = formatYMD(d);
      const isFriday = d.getDay() === 5;

      const habitInfo = habitMap[ymd] || { allDone: false, completed: 0, total: 5 };
      const nutritionInfo = nutritionMap[ymd] || { logged: false, calories: 0, protein: 0 };

      const todaysRecurring = recurringByDay.get(ymd) || [];
      const todaysProgrammed = programmedByDay.get(ymd) || [];
      const hasRecurringToday = todaysRecurring.length > 0;

      // Mandatory set = Recurring when present; else Programmed
      const mandatorySet = hasRecurringToday ? todaysRecurring : todaysProgrammed;
      const optionalSet = hasRecurringToday ? todaysProgrammed : [];

      const workoutIds = mandatorySet.map((w) => w.id);
      const hasWorkout = mandatorySet.length > 0;

      const recurringDone =
        hasRecurringToday && todaysRecurring.some((w) => doneInWeek.has(w.id));
      const workoutDone =
        hasWorkout && workoutIds.some((id) => doneInWeek.has(id));

      // Per‑week summary (latest completion this week among mandatory IDs)
      let workoutCalories = 0;
      let workoutDuration = 0;
      let weightUsed: string | undefined;

      if (workoutDone) {
        let latest:
          | { calories_burned?: number; duration?: number; weight_completed_with?: string | number; completedAt?: Date }
          | null = null;

        for (const id of workoutIds) {
          const row = latestInWeekById.get(id);
          if (!row) continue;
          if (!latest || (row.completedAt?.getTime?.() ?? 0) > (latest.completedAt?.getTime?.() ?? 0)) {
            latest = row;
          }
        }
        if (latest) {
          workoutCalories = Number(latest.calories_burned || 0);
          workoutDuration = Number(latest.duration || 0);
          if (latest.weight_completed_with != null) {
            weightUsed =
              typeof latest.weight_completed_with === "number"
                ? `${latest.weight_completed_with}kg`
                : String(latest.weight_completed_with);
          }
        }
      }

      const checkinCompleteForDay = isFriday && currentBodyFat !== undefined;

      const weightChange =
        currentWeight !== undefined && lastWeight !== undefined
          ? ((currentWeight - lastWeight) / lastWeight) * 100
          : undefined;

      const bfChange =
        currentBodyFat !== undefined && lastBodyFat !== undefined
          ? currentBodyFat - lastBodyFat
          : undefined;

      const dayTasks = 1 + 1 + (hasWorkout ? 1 : 0) + (isFriday ? 1 : 0);
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
                weight: currentWeight ?? 0,
                body_fat_pct: currentBodyFat ?? 0,
                weightChange,
                bfChange,
              }
            : undefined,

        hasWorkout,
        workoutDone,
        workoutIds,
        workoutSummary: workoutDone
          ? { calories: workoutCalories, duration: workoutDuration, weightUsed }
          : undefined,

        hasRecurringToday,
        recurringWorkouts: todaysRecurring,
        recurringDone,
        optionalWorkouts: optionalSet,
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
        totalCaloriesBurned,
      },
    };

    return res.status(200).json(payload);
  } catch (err: any) {
    console.error("[weekly/overview] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to build weekly overview" });
  }
}
