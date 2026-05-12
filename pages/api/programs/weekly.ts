// File: pages/api/programs/weekly.ts

import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole } from "../../../lib/rbac";

type SimpleWorkoutRef = { id: string; name?: string; order?: number; programId?: string };

type ProgramsWeeklyResponse = {
  weekStartYMD: string;
  weekEndYMD: string;
  days: Record<string, SimpleWorkoutRef[]>; // ymd -> workouts
  debug: {
    programsMatched: number;
    programsActiveInWeek: number;
    scheduleRowsRead: number;
    uniqueWorkoutIds: number;
  };
};

const WORKOUTS_COLLECTION = "workouts";
const PROGRAMS_COLLECTION = "programs";

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

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function normaliseDayName(v: any): string {
  const s = String(v || "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  const match = DAY_NAMES.find((dn) => dn.toLowerCase() === lower);
  return match || "";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProgramsWeeklyResponse | { error: string }>
) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: "Not signed in" });
    if (!hasRole(session, ["user", "gym", "admin"])) return res.status(403).json({ error: "Forbidden" });

    const userEmail = (session.user as any)?.email?.toLowerCase();
    if (!userEmail) return res.status(400).json({ error: "Unable to resolve user email" });

    const weekQ = String(req.query.week || formatYMD(new Date()));
    if (!isYMD(weekQ)) return res.status(400).json({ error: "Invalid week format. Use YYYY-MM-DD." });

    const weekDate = parseYMD(weekQ);
    const weekStart = startOfAlignedWeek(weekDate);
    const weekEnd = endOfAlignedWeek(weekDate);

    const weekStartYMD = formatYMD(weekStart);
    const weekEndYMD = formatYMD(weekEnd);

    const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });

    // Init output map for all 7 days (stable keys)
    const days: Record<string, SimpleWorkoutRef[]> = {};
    for (const d of weekDays) days[formatYMD(d)] = [];

    let programsMatched = 0;
    let programsActiveInWeek = 0;
    let scheduleRowsRead = 0;

    const programsSnap = await firestore
      .collection(PROGRAMS_COLLECTION)
      .where("assigned_to", "array-contains", userEmail)
      .get();

    programsMatched = programsSnap.docs.length;

    const placements: Array<{ ymd: string; workoutId: string; order: number; programId: string }> = [];
    const workoutIds = new Set<string>();

    for (const progDoc of programsSnap.docs) {
      const prog = progDoc.data() as any;
      const startDateRaw = toDate(prog.start_date);
      const weeks = Number(prog.weeks || 0);
      if (!startDateRaw || !weeks) continue;

      // ✅ Critical fix: normalise start to start-of-day so a midday timestamp doesn't drop the first day
      const startDay = startOfDay(startDateRaw);

      // Active window is half-open: [startDay, endExclusive)
      const endExclusive = startOfDay(addDays(startDay, weeks * 7));

      // Overlap with this week: [weekStart..weekEnd] vs [startDay..endExclusive)
      if (endExclusive <= weekStart || startDay > weekEnd) continue;

      programsActiveInWeek += 1;

      const scheduleSnap = await progDoc.ref.collection("schedule").get();
      scheduleRowsRead += scheduleSnap.size;

      const scheduleRows = scheduleSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() || {}) }))
        .map((row: any) => {
          const wid = String(row.workout_id || "").trim();
          const dayName = normaliseDayName(row.day_of_week); // always string (confirmed)
          const order = Number(row.order ?? 0);
          return { wid, dayName, order, id: String(row.id || "") };
        })
        .filter((r: any) => r.wid && r.dayName);

      // Sort by day name order in the week, then order
      const dayIndex = new Map<string, number>(DAY_NAMES.map((dn, idx) => [dn, idx]));
      scheduleRows.sort((a: any, b: any) => {
        const da = dayIndex.get(a.dayName) ?? 999;
        const db = dayIndex.get(b.dayName) ?? 999;
        if (da !== db) return da - db;
        const oa = Number(a.order ?? 0);
        const ob = Number(b.order ?? 0);
        if (oa !== ob) return oa - ob;
        return String(a.id).localeCompare(String(b.id));
      });

      for (const row of scheduleRows) {
        for (const day of weekDays) {
          const dayName = DAY_NAMES[day.getDay()];
          if (dayName !== row.dayName) continue;

          // Respect program active window (using normalised startDay/endExclusive)
          if (day < startDay || day >= endExclusive) continue;

          const ymd = formatYMD(day);
          placements.push({ ymd, workoutId: row.wid, order: row.order, programId: progDoc.id });
          workoutIds.add(row.wid);
        }
      }
    }

    // Resolve names (batch by unique IDs)
    const nameMap = new Map<string, string | undefined>();
    if (workoutIds.size) {
      const ids = Array.from(workoutIds);
      const snaps = await Promise.all(ids.map((id) => firestore.collection(WORKOUTS_COLLECTION).doc(id).get()));
      snaps.forEach((s) => {
        if (!s.exists) return;
        const w = s.data() as any;
        const name = typeof w?.workout_name === "string" ? w.workout_name : undefined;
        nameMap.set(s.id, name);
      });
    }

    // Apply to output (order preserved per day)
    // De-dupe per day by workoutId (keeping lowest order)
    const perDaySeen = new Map<string, Map<string, number>>();
    const perDayProgram = new Map<string, Map<string, string>>();
    for (const p of placements) {
      const existing = perDaySeen.get(p.ymd) || new Map<string, number>();
      const existingProg = perDayProgram.get(p.ymd) || new Map<string, string>();
      const prevOrder = existing.get(p.workoutId);
      if (prevOrder == null || p.order < prevOrder) {
        existing.set(p.workoutId, p.order);
        existingProg.set(p.workoutId, p.programId);
      }
      perDaySeen.set(p.ymd, existing);
      perDayProgram.set(p.ymd, existingProg);
    }

    for (const [ymd, byId] of perDaySeen.entries()) {
      const byProg = perDayProgram.get(ymd) || new Map<string, string>();
      const arr: SimpleWorkoutRef[] = Array.from(byId.entries())
        .map(([wid, order]) => ({
          id: wid,
          name: nameMap.get(wid),
          order,
          programId: byProg.get(wid),
        }))
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

      days[ymd] = arr;
    }

    res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");

    return res.status(200).json({
      weekStartYMD,
      weekEndYMD,
      days,
      debug: {
        programsMatched,
        programsActiveInWeek,
        scheduleRowsRead,
        uniqueWorkoutIds: workoutIds.size,
      },
    });
  } catch (err: any) {
    console.error("[programs/weekly] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to build programs weekly" });
  }
}
