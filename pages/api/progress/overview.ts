// pages/api/progress/overview.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { FieldPath } from "@google-cloud/firestore";
import firestore from "../../../lib/firestoreClient";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole } from "../../../lib/rbac";

type ScopeMode = "program" | "all";
type TimeRange = "7d" | "30d" | "90d";
type LiftKey = "squat" | "bench" | "deadlift" | "ohp";

type SimpleCheckin = {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  photo_url?: string | null;
};

type StrengthPoint = {
  date: string;
  value: number;
};

type CurrentProgram = {
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

type Resp = {
  scope: ScopeMode;
  range: TimeRange;
  startYMD: string;
  endYMD: string;
  currentProgram: CurrentProgram;
  kpis: {
    sessions: number;
    calories: number;
    currentStreak: number;
    totalCompletionsAllTime: number;
  };
  weight: {
    start_weight_kg: number | null;
    current_weight_kg: number | null;
    delta_kg: number;
    delta_pct: number;
    points: Array<{ date: string; value: number }>;
  };
  strength: Record<
    LiftKey,
    {
      latest: number | null;
      previous: number | null;
      delta: number | null;
      points: StrengthPoint[];
    }
  >;
  checkins: SimpleCheckin[];
};

const CHECKINS_COLLECTION = "check_ins";
const COMPLETIONS_COLLECTION = "workoutCompletions";
const PROGRAM_ASSIGNMENTS_COLLECTION = "program_assignments";
const PROGRAMS_COLLECTION = "programs";

const LIFT_MATCHERS: Record<LiftKey, string[]> = {
  squat: ["squat", "back squat", "front squat"],
  bench: ["bench", "bench press"],
  deadlift: ["deadlift"],
  ohp: ["ohp", "overhead press", "strict press", "press"],
};

function formatYMD(d: Date) {
  return d.toLocaleDateString("en-CA");
}

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function startOfDay(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date) {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDate(v: any): Date | null {
  try {
    if (!v) return null;

    if (typeof v?.toDate === "function") {
      const d = v.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    }

    if (typeof v === "object" && typeof v._seconds === "number") {
      const ms =
        v._seconds * 1000 +
        (typeof v._nanoseconds === "number" ? v._nanoseconds / 1e6 : 0);
      const d = new Date(ms);
      return !isNaN(d.getTime()) ? d : null;
    }

    const d = new Date(v);
    return !isNaN(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

function toISO(v: any) {
  const d = toDate(v);
  return d ? d.toISOString() : null;
}

function getCompletionISO(c: any) {
  return (
    toISO(c.completed_date) ||
    toISO(c.date_completed) ||
    toISO(c.completed_at) ||
    toISO(c.started_at) ||
    toISO(c.created_at)
  );
}

function rangeDaysToNumber(range: TimeRange) {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  return 90;
}

function normaliseName(value: string) {
  return String(value || "").trim().toLowerCase();
}

function inferLiftKey(name: string): LiftKey | null {
  const n = normaliseName(name);

  for (const [lift, matchers] of Object.entries(LIFT_MATCHERS) as [LiftKey, string[]][]) {
    if (matchers.some((m) => n.includes(m))) return lift;
  }

  return null;
}

function getBenchmarkValue(part: any) {
  if (!part || typeof part !== "object") return null;

  const candidates = [
    part.one_rm,
    part.estimated_1rm,
    part.estimated1rm,
    part.rm_1,
    part.value,
    part.weight_kg,
    part.weight,
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
}

async function getCurrentProgram(userEmail: string): Promise<CurrentProgram> {
  const assignmentsSnap = await firestore
    .collection(PROGRAM_ASSIGNMENTS_COLLECTION)
    .where("user_email", "==", userEmail)
    .where("status", "==", "active")
    .get();

  if (assignmentsSnap.empty) return null;

  const now = startOfDay(new Date());

  const candidates = await Promise.all(
    assignmentsSnap.docs.map(async (doc) => {
      const a = doc.data() as any;
      const start = toDate(a.start_date);
      const end = toDate(a.end_date);
      const programId = String(a.program_id || "").trim();

      if (!programId || !start) return null;

      const programDoc = await firestore.collection(PROGRAMS_COLLECTION).doc(programId).get();
      const programData = programDoc.exists ? (programDoc.data() as any) : null;

      const weeks = Number(a.weeks || programData?.weeks || 0) || 0;
      const computedEnd =
        end || (weeks > 0 ? addDays(startOfDay(start), weeks * 7 - 1) : null);

      const isActiveToday =
        now >= startOfDay(start) &&
        (!computedEnd || now <= endOfDay(computedEnd));

      let currentWeek: number | null = null;
      if (isActiveToday) {
        const diffDays = Math.floor(
          (+startOfDay(now) - +startOfDay(start)) / (1000 * 60 * 60 * 24)
        );
        currentWeek = Math.floor(diffDays / 7) + 1;
      }

      return {
        assignment_id: doc.id,
        program_id: programId,
        program_name: String(programData?.name || a.program_name || "Program"),
        status: String(a.status || "active"),
        start_date: formatYMD(startOfDay(start)),
        end_date: computedEnd ? formatYMD(startOfDay(computedEnd)) : null,
        weeks,
        current_week: currentWeek,
        is_active_today: isActiveToday,
      } as CurrentProgram;
    })
  );

  const active = candidates.find((c) => c?.is_active_today) || candidates[0] || null;
  return active || null;
}

async function getCheckins(userEmail: string): Promise<SimpleCheckin[]> {
  try {
    const startKey = `${userEmail}__`;
    const endKey = `${userEmail}__\uf8ff`;

    const snap = await firestore
      .collection(CHECKINS_COLLECTION)
      .where(FieldPath.documentId(), ">=", startKey)
      .where(FieldPath.documentId(), "<=", endKey)
      .get();

    return snap.docs
      .map((doc) => {
        const data = doc.data() as any;
        const date = doc.id.split("__")[1] || "";

        return {
          date,
          weight_kg:
            typeof data?.weight_kg === "number"
              ? data.weight_kg
              : typeof data?.weight === "number"
              ? data.weight
              : null,
          body_fat_pct:
            typeof data?.body_fat_pct === "number" ? data.body_fat_pct : null,
          photo_url: data?.photo_url || null,
        };
      })
      .filter((r) => !!r.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    const all = await firestore.collection(CHECKINS_COLLECTION).get();

    return all.docs
      .filter((doc) => doc.id.startsWith(`${userEmail}__`))
      .map((doc) => {
        const data = doc.data() as any;
        const date = doc.id.split("__")[1] || "";

        return {
          date,
          weight_kg:
            typeof data?.weight_kg === "number"
              ? data.weight_kg
              : typeof data?.weight === "number"
              ? data.weight
              : null,
          body_fat_pct:
            typeof data?.body_fat_pct === "number" ? data.body_fat_pct : null,
          photo_url: data?.photo_url || null,
        };
      })
      .filter((r) => !!r.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

async function getCompletions(userEmail: string) {
  try {
    const snap = await firestore
      .collection(COMPLETIONS_COLLECTION)
      .where("user_email", "==", userEmail)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  } catch {
    const snap = await firestore.collection(COMPLETIONS_COLLECTION).get();

    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((row: any) => String(row.user_email || "").trim().toLowerCase() === userEmail);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp | { error: string }>
) {
  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ error: "Not signed in" });
    }

    if (!hasRole(session, ["user", "gym", "admin"])) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const userEmail = String((session.user as any)?.email || "").trim().toLowerCase();
    if (!userEmail) {
      return res.status(400).json({ error: "Unable to resolve user email" });
    }

    const rawScope = String(req.query.scope || "program").toLowerCase();
    const rawRange = String(req.query.range || "30d").toLowerCase();

    const scope: ScopeMode = rawScope === "all" ? "all" : "program";
    const range: TimeRange =
      rawRange === "7d" || rawRange === "90d" ? (rawRange as TimeRange) : "30d";

    const [currentProgram, allCheckins, allCompletions] = await Promise.all([
      getCurrentProgram(userEmail),
      getCheckins(userEmail),
      getCompletions(userEmail),
    ]);

    const today = new Date();
    const end = endOfDay(today);
    const defaultStart = startOfDay(addDays(today, -(rangeDaysToNumber(range) - 1)));

    let start = defaultStart;

    if (scope === "program" && currentProgram?.start_date) {
      const programStart = startOfDay(new Date(`${currentProgram.start_date}T00:00:00`));
      if (!isNaN(programStart.getTime()) && programStart > start) {
        start = programStart;
      }
    }

    let effectiveEnd = end;
    if (scope === "program" && currentProgram?.end_date) {
      const programEnd = endOfDay(new Date(`${currentProgram.end_date}T00:00:00`));
      if (!isNaN(programEnd.getTime()) && programEnd < effectiveEnd) {
        effectiveEnd = programEnd;
      }
    }

    const startYMD = formatYMD(start);
    const endYMD = formatYMD(effectiveEnd);

    const filteredCheckins = allCheckins.filter((c) => c.date >= startYMD && c.date <= endYMD);

    const filteredCompletions = allCompletions.filter((c) => {
      const iso = getCompletionISO(c);
      if (!iso) return false;
      const ymd = iso.slice(0, 10);
      return ymd >= startYMD && ymd <= endYMD;
    });

    const baselineCheckins =
      scope === "program" && currentProgram?.start_date
        ? allCheckins.filter((c) => {
            const endLimit = currentProgram.end_date || "9999-12-31";
            return c.date >= currentProgram.start_date && c.date <= endLimit;
          })
        : allCheckins;

    const firstWeight =
      baselineCheckins.find((c) => typeof c.weight_kg === "number" && c.weight_kg != null) ||
      null;

    const latestWeight =
      [...filteredCheckins]
        .reverse()
        .find((c) => typeof c.weight_kg === "number" && c.weight_kg != null) || null;

    const deltaKg =
      firstWeight?.weight_kg != null && latestWeight?.weight_kg != null
        ? latestWeight.weight_kg - firstWeight.weight_kg
        : 0;

    const deltaPct =
      firstWeight?.weight_kg != null &&
      latestWeight?.weight_kg != null &&
      firstWeight.weight_kg !== 0
        ? ((latestWeight.weight_kg - firstWeight.weight_kg) / firstWeight.weight_kg) * 100
        : 0;

    const allDaySet = new Set<string>();
    for (const c of allCompletions) {
      const iso = getCompletionISO(c);
      if (!iso) continue;
      allDaySet.add(iso.slice(0, 10));
    }

    let currentStreak = 0;
    for (let i = 0; i < 3650; i++) {
      const d = addDays(today, -i);
      const ymd = formatYMD(d);
      if (allDaySet.has(ymd)) currentStreak++;
      else break;
    }

    const sessions = filteredCompletions.length;
    const calories = filteredCompletions.reduce(
      (sum, c) => sum + Number(c.calories_burned || 0),
      0
    );

    const strength: Resp["strength"] = {
      squat: { latest: null, previous: null, delta: null, points: [] },
      bench: { latest: null, previous: null, delta: null, points: [] },
      deadlift: { latest: null, previous: null, delta: null, points: [] },
      ohp: { latest: null, previous: null, delta: null, points: [] },
    };

    for (const c of allCompletions) {
      const iso = getCompletionISO(c);
      if (!iso) continue;

      const ymd = iso.slice(0, 10);
      if (ymd < startYMD || ymd > endYMD) continue;

      const metrics = c.benchmark_metrics;
      if (!metrics || typeof metrics !== "object") continue;

      for (const [name, part] of Object.entries(metrics)) {
        const lift = inferLiftKey(name);
        if (!lift) continue;

        const value = getBenchmarkValue(part);
        if (!value) continue;

        strength[lift].points.push({
          date: ymd,
          value,
        });
      }
    }

    for (const key of Object.keys(strength) as LiftKey[]) {
      strength[key].points.sort((a, b) => a.date.localeCompare(b.date));

      const latest =
        strength[key].points.length > 0
          ? strength[key].points[strength[key].points.length - 1].value
          : null;

      const previous =
        strength[key].points.length > 1
          ? strength[key].points[strength[key].points.length - 2].value
          : null;

      strength[key].latest = latest;
      strength[key].previous = previous;
      strength[key].delta = latest != null && previous != null ? latest - previous : null;
    }

    const payload: Resp = {
      scope,
      range,
      startYMD,
      endYMD,
      currentProgram,
      kpis: {
        sessions,
        calories,
        currentStreak,
        totalCompletionsAllTime: allCompletions.length,
      },
      weight: {
        start_weight_kg: firstWeight?.weight_kg ?? null,
        current_weight_kg: latestWeight?.weight_kg ?? null,
        delta_kg: Number(deltaKg.toFixed(1)),
        delta_pct: Number(deltaPct.toFixed(1)),
        points: filteredCheckins
          .filter((c) => typeof c.weight_kg === "number" && c.weight_kg != null)
          .map((c) => ({
            date: c.date,
            value: c.weight_kg as number,
          })),
      },
      strength,
      checkins: [...filteredCheckins].reverse(),
    };

    res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error("[progress/overview] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to build progress overview" });
  }
}
