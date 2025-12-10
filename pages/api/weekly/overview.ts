
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole } from "../../../lib/rbac";

/**
 * Weekly overview endpoint
 * GET /api/weekly/overview?week=YYYY-MM-DD
 *
 * Returns per-day status for the Monday-aligned week containing "week":
 *  - nutritionLogged: any nutrition entry exists for the date
 *  - habitAllDone: all 6 habit booleans true in habitLogs
 *  - isFriday: whether day is Friday
 *  - checkinComplete: weekly check-in doc exists (Friday only)
 *  - hasWorkout: workout scheduled for that day
 *  - workoutDone: workout completed for that day
 */

type DayOverview = {
  dateKey: string;
  isFriday: boolean;
  nutritionLogged: boolean;
  habitAllDone: boolean;
  checkinComplete: boolean;
  hasWorkout: boolean;
  workoutDone: boolean;
};

type WeeklyOverviewResponse = {
  weekStartYMD: string;
  weekEndYMD: string;
  fridayYMD: string;
  days: DayOverview[];
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

  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  try {
    // HABITS
    const habitDocRefs = weekDays.map((d) =>
      firestore.collection(HABITS_COLLECTION).doc(buildDocId(userEmail, formatYMD(d)))
    );
    const habitSnaps = await firestore.getAll(...habitDocRefs);
    const habitMap: Record<string, boolean> = {};
    habitSnaps.forEach((snap) => {
      const ymd = snap.id.split("__")[1] || "";
      if (!snap.exists) {
        habitMap[ymd] = false;
      } else {
        const data = snap.data() || {};
        const allDone =
          !!data["2l_water"] &&
          !!data.assigned_workouts_completed &&
          !!data.macros_filled &&
          !!data.step_count &&
          !!data.time_outside;
        habitMap[ymd] = !!allDone;
      }
    });

    // CHECK-IN
    const checkinDocRef = firestore.collection(CHECKINS_COLLECTION).doc(buildDocId(userEmail, fridayYMD));
    const checkinSnap = await checkinDocRef.get();
    const checkinComplete = checkinSnap.exists;

    // NUTRITION
    const nutritionLoggedMap: Record<string, boolean> = {};
    for (const d of weekDays) {
      const ymd = formatYMD(d);
      const dayStart = new Date(`${ymd}T00:00:00Z`);
      const nextDay = new Date(dayStart);
      nextDay.setDate(dayStart.getDate() + 1);

      const qSnap = await firestore
        .collection(NUTRITION_COLLECTION)
        .where("user_email", "==", userEmail)
        .where("date", ">=", dayStart)
        .where("date", "<", nextDay)
        .limit(1)
        .get();

      nutritionLoggedMap[ymd] = !qSnap.empty;
    }

    // WORKOUTS for the week
    const workoutsSnap = await firestore
      .collection(WORKOUTS_COLLECTION)
      .where("week_start", "==", weekStartYMD)
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

    // Compose response
    const days: DayOverview[] = weekDays.map((d) => {
      const ymd = formatYMD(d);
      const isFriday = d.getDay() === 5;
      const dayName = d.toLocaleDateString(undefined, { weekday: "long" });

      // Find workouts for this day
      const dayWorkouts = workouts.filter(w => (w.day_name || "").toLowerCase() === dayName.toLowerCase());
      const hasWorkout = dayWorkouts.length > 0;

      // Check if any workout completed for this day
      const workoutDone = completions.some(c => {
        const completedDate = formatYMD(c.date_completed.toDate());
        return completedDate === ymd && dayWorkouts.some(w => w.workout_id === c.workout_id);
      });

      return {
        dateKey: ymd,
        isFriday,
        nutritionLogged: !!nutritionLoggedMap[ymd],
        habitAllDone: !!habitMap[ymd],
        checkinComplete: isFriday ? !!checkinComplete : false,
        hasWorkout,
        workoutDone,
      };
    });

    res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");

    const payload: WeeklyOverviewResponse = {
      weekStartYMD,
      weekEndYMD,
      fridayYMD,
      days,
    };

    return res.status(200).json(payload);
  } catch (err: any) {
    console.error("[weekly/overview] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to build weekly overview" });
  }
}
