
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
 *
 * Collections used (confirmed):
 *  - nutrition_logs
 *  - habitLogs
 *  - check_ins
 */

type DayOverview = {
  dateKey: string;            // YYYY-MM-DD
  isFriday: boolean;
  nutritionLogged: boolean;
  habitAllDone: boolean;
  checkinComplete: boolean;   // only meaningful on Friday
};

type WeeklyOverviewResponse = {
  weekStartYMD: string;       // Monday YYYY-MM-DD
  weekEndYMD: string;         // Sunday YYYY-MM-DD
  fridayYMD: string;          // Friday YYYY-MM-DD
  days: DayOverview[];
};

// ----- Constants (your collections)
const HABITS_COLLECTION = "habitLogs";
const CHECKINS_COLLECTION = "check_ins";
const NUTRITION_COLLECTION = "nutrition_logs";

// ----- Helpers
function isYMD(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function formatYMD(d: Date): string {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n.toISOString().slice(0, 10);
}
function startOfAlignedWeek(d: Date): Date {
  const day = d.getDay();            // 0=Sun..6=Sat
  const diffToMon = (day + 6) % 7;   // Monday=0
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
  f.setDate(s.getDate() + 4);        // Monday + 4 = Friday
  f.setHours(0, 0, 0, 0);
  return f;
}
function buildDocId(email: string, ymd: string): string {
  return `${email}__${ymd}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth & RBAC
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not signed in" });
  if (!hasRole(session, ["user", "gym", "admin"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const userEmail: string | undefined = (session.user as any)?.email;
  if (!userEmail) return res.status(400).json({ error: "Unable to resolve user email" });

  // Input: week=YYYY-MM-DD (defaults to today)
  const weekQ = String(req.query.week || formatYMD(new Date()));
  if (!isYMD(weekQ)) return res.status(400).json({ error: "Invalid week format. Use YYYY-MM-DD." });

  const weekDate = new Date(`${weekQ}T00:00:00Z`);
  const weekStart = startOfAlignedWeek(weekDate);
  const weekEnd = endOfAlignedWeek(weekDate);
  const friday = fridayOfWeek(weekDate);

  const weekStartYMD = formatYMD(weekStart);
  const weekEndYMD = formatYMD(weekEnd);
  const fridayYMD = formatYMD(friday);

  // Build the seven dates of the week (Mon..Sun)
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  try {
    // ----- HABITS: batch read 7 deterministic docRefs in one go
    const habitDocRefs = weekDays.map((d) =>
      firestore.collection(HABITS_COLLECTION).doc(buildDocId(userEmail, formatYMD(d)))
    );
    const habitSnaps = await firestore.getAll(...habitDocRefs);
    const habitMap: Record<string, boolean> = {};
    habitSnaps.forEach((snap) => {
      // ymd from doc ID suffix
      const id = snap.id;
      const ymd = id.split("__")[1] || "";
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

    // ----- CHECK-IN: Friday deterministic docRef
    const checkinDocRef = firestore.collection(CHECKINS_COLLECTION).doc(buildDocId(userEmail, fridayYMD));
    const checkinSnap = await checkinDocRef.get();
    const checkinComplete = checkinSnap.exists;

    // ----- NUTRITION: query per day (user_email + date range)
    // This avoids assumptions about nutrition doc IDs.
    // Ensure an index exists for (user_email, date) if Firestore suggests it.
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

    // ----- Compose response
    const days: DayOverview[] = weekDays.map((d) => {
      const ymd = formatYMD(d);
      const isFriday = d.getDay() === 5;
      return {
        dateKey: ymd,
        isFriday,
        nutritionLogged: !!nutritionLoggedMap[ymd],
        habitAllDone: !!habitMap[ymd],
        checkinComplete: isFriday ? !!checkinComplete : false,
      };
    });

    // Helpful caching: reduces repeated reads on tab switches / short revisits
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
