// pages/api/iron-acre/home-overview.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole } from "../../../lib/rbac";

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

type CurrentProgramSummary = {
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

type IronAcreHomeOverviewResponse = {
  weekStartYMD: string;
  weekEndYMD: string;
  fridayYMD: string;
  todayYMD: string;

  days: DayOverview[];

  weeklyTotals: {
    totalTasks: number;
    completedTasks: number;
    totalWorkoutsCompleted: number;
    totalWorkoutTime: number;
    totalCaloriesBurned: number;
  };

  currentProgram: CurrentProgramSummary;

  todaysWorkouts: SimpleWorkoutRef[];

  nutritionToday: {
    logged: boolean;
    entriesCount: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };

  debug: {
    assignmentsMatched: number;
    programsActiveInWeek: number;
    scheduleRowsRead: number;
    uniqueWorkoutIds: number;
    recurringAssignmentsMatched: number;
  };
};

/** ===== Collections ===== */
const HABITS_COLLECTION = "habitLogs";
const CHECKINS_COLLECTION = "check_ins";
const NUTRITION_COLLECTION = "nutrition_logs";
const WORKOUTS_COLLECTION = "workouts";
const COMPLETIONS_COLLECTION = "workoutCompletions";
const ASSIGNMENTS_COLLECTION = "workout_assignments";
const PROGRAMS_COLLECTION = "programs";
const PROGRAM_ASSIGNMENTS_COLLECTION = "program_assignments";

/** ===== Helpers ===== */
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function isYMD(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

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

function toDate(v: any): Date | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function normaliseDayName(v: any): string {
  const s = String(v || "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  const match = DAY_NAMES.find((dn) => dn.toLowerCase() === lower);
  return match || "";
}

function candidateIdsFromCompletion(c: any): string[] {
  const fields = [
    "workout_id",
    "gym_workout_id",
    "recurring_workout_id",
    "recurring_id",
    "assigned_workout_id",
    "plan_workout_id",
    "rx_id",
  ];

  const out: string[] = [];
  for (const f of fields) {
    const v = c?.[f];
    if (v != null && String(v).trim() !== "") out.push(String(v).trim());
  }

  return Array.from(new Set(out));
}

function calcCurrentWeek(startDate: Date, today: Date, totalWeeks: number): number | null {
  const start = startOfDay(startDate);
  const now = startOfDay(today);

  if (now < start) return null;

  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  const week = Math.floor(diffDays / 7) + 1;

  if (week < 1) return null;
  if (week > totalWeeks) return totalWeeks;

  return week;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IronAcreHomeOverviewResponse | { error: string }>
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
    if (!isYMD(weekQ)) {
      return res.status(400).json({ error: "Invalid week format. Use YYYY-MM-DD." });
    }

    const weekDate = parseYMD(weekQ);
    const weekStart = startOfAlignedWeek(weekDate);
    const weekEnd = endOfAlignedWeek(weekDate);
    const friday = fridayOfWeek(weekDate);
    const today = startOfDay(new Date());

    const weekStartYMD = formatYMD(weekStart);
    const weekEndYMD = formatYMD(weekEnd);
    const fridayYMD = formatYMD(friday);
    const todayYMD = formatYMD(today);

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

    /** ===== NUTRITION TODAY ===== */
    const nutritionTodaySnap = await firestore
      .collection(NUTRITION_COLLECTION)
      .doc(userEmail)
      .collection(todayYMD)
      .get();

    let nutritionTodayCalories = 0;
    let nutritionTodayProtein = 0;
    let nutritionTodayCarbs = 0;
    let nutritionTodayFat = 0;

    nutritionTodaySnap.docs.forEach((doc) => {
      const data = doc.data() as any;
      nutritionTodayCalories += Number(data.calories || data.total_calories || 0);
      nutritionTodayProtein += Number(data.protein || data.total_protein || 0);
      nutritionTodayCarbs += Number(data.carbs || data.total_carbs || 0);
      nutritionTodayFat += Number(data.fat || data.total_fat || 0);
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

    /** ===== NUTRITION FOR WEEK ===== */
    const nutritionMap: Record<string, { logged: boolean; calories: number; protein: number; carbs: number; fat: number }> = {};
    for (const d of weekDays) {
      const ymd = formatYMD(d);
      const snap = await firestore.collection(NUTRITION_COLLECTION).doc(userEmail).collection(ymd).get();

      if (snap.empty) {
        nutritionMap[ymd] = { logged: false, calories: 0, protein: 0, carbs: 0, fat: 0 };
      } else {
        let calories = 0;
        let protein = 0;
        let carbs = 0;
        let fat = 0;

        snap.docs.forEach((doc) => {
          const data = doc.data() as any;
          calories += Number(data.calories || data.total_calories || 0);
          protein += Number(data.protein || data.total_protein || 0);
          carbs += Number(data.carbs || data.total_carbs || 0);
          fat += Number(data.fat || data.total_fat || 0);
        });

        nutritionMap[ymd] = { logged: true, calories, protein, carbs, fat };
      }
    }

    /** ===== PROGRAM ASSIGNMENTS → PROGRAM SCHEDULE ===== */
    let assignmentsMatched = 0;
    let programsActiveInWeek = 0;
    let scheduleRowsRead = 0;

    const programmedByDay = new Map<string, SimpleWorkoutRef[]>();
    const placements: Array<{ ymd: string; workoutId: string; order: number; programId: string }> = [];
    const workoutIds = new Set<string>();

    const assignmentsSnap = await firestore
      .collection(PROGRAM_ASSIGNMENTS_COLLECTION)
      .where("user_email", "==", userEmail)
      .where("status", "==", "active")
      .get();

    assignmentsMatched = assignmentsSnap.docs.length;

    let currentProgram: CurrentProgramSummary = null;

    for (const assignmentDoc of assignmentsSnap.docs) {
      const assignment = assignmentDoc.data() as any;

      const programId = String(assignment?.program_id || "").trim();
      const programName = String(assignment?.program_name || programId).trim();
      const assignmentStartRaw = toDate(assignment?.start_date);
      const assignmentEndRaw = toDate(assignment?.end_date);
      const assignmentWeeks = Number(assignment?.weeks || 0);
      const status = String(assignment?.status || "active");

      if (!programId || !assignmentStartRaw) continue;

      const assignmentStart = startOfDay(assignmentStartRaw);
      let assignmentEndExclusive: Date | null = null;

      if (assignmentEndRaw) {
        assignmentEndExclusive = addDays(startOfDay(assignmentEndRaw), 1);
      } else if (assignmentWeeks > 0) {
        assignmentEndExclusive = startOfDay(addDays(assignmentStart, assignmentWeeks * 7));
      }

      if (!assignmentEndExclusive) continue;

      const isActiveToday = today >= assignmentStart && today < assignmentEndExclusive;
      if (isActiveToday && !currentProgram) {
        currentProgram = {
          assignment_id: String(assignment?.assignment_id || assignmentDoc.id),
          program_id: programId,
          program_name: programName,
          status,
          start_date: assignmentStart.toISOString(),
          end_date: assignmentEndRaw ? startOfDay(assignmentEndRaw).toISOString() : null,
          weeks: assignmentWeeks || 0,
          current_week: assignmentWeeks > 0 ? calcCurrentWeek(assignmentStart, today, assignmentWeeks) : null,
          is_active_today: true,
        };
      }

      if (assignmentEndExclusive <= weekStart || assignmentStart > weekEnd) continue;

      const programDoc = await firestore.collection(PROGRAMS_COLLECTION).doc(programId).get();
      if (!programDoc.exists) continue;

      programsActiveInWeek += 1;

      const scheduleSnap = await programDoc.ref.collection("schedule").get();
      scheduleRowsRead += scheduleSnap.size;

      const scheduleRows = scheduleSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() || {}) }))
        .map((row: any) => {
          const workoutId = String(row.workout_id || "").trim();
          const dayOfWeekRaw = row.day_of_week;
          const order = Number(row.order ?? 0);

          let targetDayName = "";
          if (typeof dayOfWeekRaw === "number" && Number.isFinite(dayOfWeekRaw)) {
            targetDayName = DAY_NAMES[dayOfWeekRaw] || "";
          } else {
            targetDayName = normaliseDayName(dayOfWeekRaw);
          }

          return { workoutId, dayName: targetDayName, order, id: String(row.id || "") };
        })
        .filter((r) => r.workoutId && r.dayName);

      const dayIndex = new Map<string, number>(DAY_NAMES.map((dn, idx) => [dn, idx]));
      scheduleRows.sort((a, b) => {
        const da = dayIndex.get(a.dayName) ?? 999;
        const db = dayIndex.get(b.dayName) ?? 999;
        if (da !== db) return da - db;
        if (a.order !== b.order) return a.order - b.order;
        return String(a.id).localeCompare(String(b.id));
      });

      for (const row of scheduleRows) {
        for (const day of weekDays) {
          const dayName = DAY_NAMES[day.getDay()];
          if (dayName !== row.dayName) continue;

          if (day < assignmentStart || day >= assignmentEndExclusive) continue;

          const ymd = formatYMD(day);
          placements.push({
            ymd,
            workoutId: row.workoutId,
            order: row.order,
            programId,
          });
          workoutIds.add(row.workoutId);
        }
      }
    }

    /** ===== RECURRING ASSIGNMENTS ===== */
    const recurringByDay = new Map<string, SimpleWorkoutRef[]>();
    let recurringAssignmentsMatched = 0;

    type AssignmentDoc = {
      assignment_id: string;
      user_email: string;
      workout_id: string;
      recurring_day: string;
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

    const overlappingRecurring = assignments.filter((a) => {
      const s = toDate(a.start_date) || new Date(0);
      const e = toDate(a.end_date) || new Date(8640000000000000);
      return !(e < weekStart || s > weekEnd);
    });

    recurringAssignmentsMatched = overlappingRecurring.length;

    const recurringIds = Array.from(
      new Set(overlappingRecurring.map((a) => String(a.workout_id || "").trim()).filter(Boolean))
    );

    const recurringNameByWorkoutId = new Map<string, string | undefined>();
    if (recurringIds.length) {
      const docSnaps = await Promise.all(
        recurringIds.map((wid) => firestore.collection(WORKOUTS_COLLECTION).doc(wid).get())
      );

      docSnaps.forEach((snap) => {
        if (!snap.exists) return;
        const w = snap.data() as any;
        const name =
          typeof w?.workout_name === "string"
            ? w.workout_name
            : typeof w?.name === "string"
            ? w.name
            : undefined;
        recurringNameByWorkoutId.set(snap.id, name);
      });
    }

    for (const a of overlappingRecurring) {
      const recDayName = String(a.recurring_day || "").trim();
      const s = toDate(a.start_date) || new Date(0);
      const e = toDate(a.end_date) || new Date(8640000000000000);
      const wid = String(a.workout_id || "").trim();
      const wname = recurringNameByWorkoutId.get(wid);
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

    /** ===== WORKOUT NAME LOOKUP ===== */
    if (workoutIds.size) {
      const ids = Array.from(workoutIds);
      const snaps = await Promise.all(ids.map((id) => firestore.collection(WORKOUTS_COLLECTION).doc(id).get()));
      snaps.forEach((snap) => {
        if (!snap.exists) return;
        const w = snap.data() as any;
        const name =
          typeof w?.workout_name === "string"
            ? w.workout_name
            : typeof w?.name === "string"
            ? w.name
            : undefined;

        const existing = programmedByDay.get("__nameMap__") || [];
        programmedByDay.set(
          "__nameMap__",
          [...existing, { id: snap.id, name }]
        );
      });
    }

    const workoutNameById = new Map<string, string | undefined>();
    (programmedByDay.get("__nameMap__") || []).forEach((w) => {
      workoutNameById.set(w.id, w.name);
    });
    programmedByDay.delete("__nameMap__");

    /** ===== APPLY PROGRAMMED PLACEMENTS TO DAYS ===== */
    const perDay = new Map<string, Map<string, number>>();
    const perDayProgram = new Map<string, Map<string, string>>();

    for (const p of placements) {
      const byId = perDay.get(p.ymd) || new Map<string, number>();
      const byProgram = perDayProgram.get(p.ymd) || new Map<string, string>();

      const prev = byId.get(p.workoutId);
      if (prev == null || p.order < prev) {
        byId.set(p.workoutId, p.order);
        byProgram.set(p.workoutId, p.programId);
      }

      perDay.set(p.ymd, byId);
      perDayProgram.set(p.ymd, byProgram);
    }

    for (const [ymd, byId] of perDay.entries()) {
      const byProg = perDayProgram.get(ymd) || new Map<string, string>();

      const ordered = Array.from(byId.entries())
        .map(([workoutId, order]) => ({
          id: workoutId,
          name: workoutNameById.get(workoutId),
          order,
          programId: byProg.get(workoutId),
        }))
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

      programmedByDay.set(ymd, ordered);
    }

    /** ===== COMPLETIONS THIS WEEK ===== */
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

    const doneInWeek = new Set<string>();
    const latestInWeekById = new Map<
      string,
      { calories_burned?: number; duration?: number; weight_completed_with?: string | number; completedAt?: Date }
    >();

    for (const c of completionsWeek) {
      const completedAt: Date | undefined =
        c.completed_date?.toDate?.() ||
        c.date_completed?.toDate?.() ||
        c.completed_at?.toDate?.() ||
        undefined;

      if (!completedAt || isNaN(completedAt.getTime())) continue;

      const ids = candidateIdsFromCompletion(c);
      if (!ids.length) continue;

      const row = {
        calories_burned: typeof c.calories_burned === "number" ? c.calories_burned : undefined,
        duration:
          typeof c.duration === "number"
            ? c.duration
            : typeof c.duration_minutes === "number"
            ? c.duration_minutes
            : undefined,
        weight_completed_with:
          c.weight_completed_with ?? c.weight_compelted_with ?? c.weight_used ?? undefined,
        completedAt,
      };

      for (const id of ids) {
        doneInWeek.add(id);
        const prev = latestInWeekById.get(id);
        if (!prev || (row.completedAt?.getTime() ?? 0) > (prev.completedAt?.getTime() ?? 0)) {
          latestInWeekById.set(id, row);
        }
      }
    }

    /** ===== BUILD DAYS ===== */
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
      const nutritionInfo = nutritionMap[ymd] || { logged: false, calories: 0, protein: 0, carbs: 0, fat: 0 };

      const todaysRecurring = recurringByDay.get(ymd) || [];
      const todaysProgrammed = programmedByDay.get(ymd) || [];
      const hasRecurringToday = todaysRecurring.length > 0;

      const mandatorySet = hasRecurringToday ? todaysRecurring : todaysProgrammed;
      const optionalSet = hasRecurringToday ? todaysProgrammed : [];

      const workoutIds = mandatorySet.map((w) => w.id);
      const hasWorkout = mandatorySet.length > 0;

      const recurringDone = hasRecurringToday && todaysRecurring.some((w) => doneInWeek.has(w.id));
      const workoutDone = hasWorkout && workoutIds.some((id) => doneInWeek.has(id));

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
          if (!latest || (row.completedAt?.getTime() ?? 0) > (latest.completedAt?.getTime() ?? 0)) {
            latest = row;
          }
        }

        if (latest) {
          workoutCalories = Number(latest.calories_burned || 0);
          workoutDuration = Number(latest.duration || 0);
          if (latest.weight_completed_with != null) {
            weightUsed =
              typeof latest.weight_completed_with === "number"
                ? `${latest.weight_completed_with} kg`
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
        nutritionSummary: {
          calories: nutritionInfo.calories,
          protein: nutritionInfo.protein,
          carbs: nutritionInfo.carbs,
          fat: nutritionInfo.fat,
        },

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

    const todaysDay = days.find((d) => d.dateKey === todayYMD);
    const todaysWorkouts = todaysDay?.hasRecurringToday
      ? todaysDay.recurringWorkouts || []
      : (programmedByDay.get(todayYMD) || []);

    res.setHeader("Cache-Control", "private, max-age=20, stale-while-revalidate=40");

    const payload: IronAcreHomeOverviewResponse = {
      weekStartYMD,
      weekEndYMD,
      fridayYMD,
      todayYMD,
      days,
      weeklyTotals: {
        totalTasks,
        completedTasks,
        totalWorkoutsCompleted,
        totalWorkoutTime,
        totalCaloriesBurned,
      },
      currentProgram,
      todaysWorkouts,
      nutritionToday: {
        logged: !nutritionTodaySnap.empty,
        entriesCount: nutritionTodaySnap.size,
        calories: nutritionTodayCalories,
        protein_g: nutritionTodayProtein,
        carbs_g: nutritionTodayCarbs,
        fat_g: nutritionTodayFat,
      },
      debug: {
        assignmentsMatched,
        programsActiveInWeek,
        scheduleRowsRead,
        uniqueWorkoutIds: workoutIds.size,
        recurringAssignmentsMatched,
      },
    };

    return res.status(200).json(payload);
  } catch (err: any) {
    console.error("[iron-acre/home-overview] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to build Iron Acre home overview" });
  }
}
