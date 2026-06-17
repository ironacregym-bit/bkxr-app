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
      best_e1rm_kg?: number | null;
      training_max_kg?: number | null;
      exercise_name?: string | null;
    }
  >;
  checkins: SimpleCheckin[];
};

const CHECKINS_COLLECTION = "check_ins";
const COMPLETIONS_COLLECTION = "workoutCompletions";
const PROGRAM_ASSIGNMENTS_COLLECTION = "program_assignments";
const PROGRAMS_COLLECTION = "programs";
const STRENGTH_PROFILES_COLLECTION = "strength_profiles";

const LIFT_MATCHERS: Record<LiftKey, string[]> = {
  squat: [
    "barbell_back_squat",
    "barbell_front_squat",
    "back squat",
    "front squat",
    "barbell squat",
    "squat",
  ],
  bench: [
    "barbell_bench_press",
    "bench press",
    "bench",
  ],
  deadlift: [
    "barbell_deadlift",
    "deadlift",
  ],
  ohp: [
    "barbell_strict_press",
    "strict press",
    "overhead press",
    "shoulder press",
    "press",
    "ohp",
  ],
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

function safeNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function inferLiftKey(...values: Array<string | undefined | null>): LiftKey | null {
  const search = values
    .map((v) => normaliseName(v || ""))
    .filter(Boolean)
    .join(" | ");

  if (!search) return null;

  for (const [lift, matchers] of Object.entries(LIFT_MATCHERS) as [LiftKey, string[]][]) {
    if (matchers.some((m) => search.includes(normaliseName(m)))) {
      return lift;
    }
  }

  return null;
}

function estimate1RM(weight: number, reps: number) {
  if (!(weight > 0) || !(reps > 0)) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

function dedupeStrengthPoints(points: StrengthPoint[]) {
  const byDate = new Map<string, number>();

  for (const p of points) {
    const prev = byDate.get(p.date);
    if (prev == null || p.value > prev) {
      byDate.set(p.date, p.value);
    }
  }

  return Array.from(byDate.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
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

async function getStrengthProfiles(
  userEmail: string,
  startYMD: string,
  endYMD: string
) {
  try {
    const liftsSnap = await firestore
      .collection(STRENGTH_PROFILES_COLLECTION)
      .doc(userEmail)
      .collection("lifts")
      .get();

    const out: Partial<
      Record<
        LiftKey,
        {
          latest: number | null;
          previous: number | null;
          delta: number | null;
          points: StrengthPoint[];
          best_e1rm_kg?: number | null;
          best_true_1rm_kg?: number | null;
          training_max_kg?: number | null;
          exercise_name?: string | null;
        }
      >
    > = {};

    for (const doc of liftsSnap.docs) {
      const data = doc.data() as any;
      const lift = inferLiftKey(doc.id, data?.exercise_name);

      if (!lift) continue;

      let entryDocs: any[] = [];
      try {
        const entriesSnap = await doc.ref.collection("entries").get();
        entryDocs = entriesSnap.docs.map((d) => d.data() || {});
      } catch {
        entryDocs = [];
      }

      const rawPoints: StrengthPoint[] = entryDocs
        .map((row: any) => {
          const dateKey =
            typeof row?.date_key === "string" && row.date_key
              ? row.date_key
              : null;

          if (!dateKey || dateKey < startYMD || dateKey > endYMD) return null;

          const true1rm = safeNum(row?.true_1rm_kg);
          const e1rm = safeNum(row?.e1rm_kg);

          // Prefer true 1RM when present, otherwise estimated 1RM
          const value = true1rm ?? e1rm;
          if (value == null || value <= 0) return null;

          return {
            date: dateKey,
            value: Number(value.toFixed(1)),
          } as StrengthPoint;
        })
        .filter(Boolean) as StrengthPoint[];

      rawPoints.sort((a, b) => a.date.localeCompare(b.date));

      // Keep only PR progression:
      // first session becomes baseline, then only later increases survive
      const prPoints: StrengthPoint[] = [];
      let bestSoFar: number | null = null;

      for (const p of rawPoints) {
        if (bestSoFar == null) {
          prPoints.push(p);
          bestSoFar = p.value;
          continue;
        }

        if (p.value > bestSoFar) {
          prPoints.push(p);
          bestSoFar = p.value;
        }
      }

      const latest =
        prPoints.length > 0 ? prPoints[prPoints.length - 1].value : null;
      const first =
        prPoints.length > 0 ? prPoints[0].value : null;

      out[lift] = {
        latest,
        previous: first,
        delta:
          latest != null && first != null
            ? Number((latest - first).toFixed(1))
            : null,
        points: prPoints,
        best_e1rm_kg: safeNum(data?.best_e1rm_kg),
        best_true_1rm_kg: safeNum(data?.best_true_1rm_kg),
        training_max_kg: safeNum(data?.training_max_kg),
        exercise_name: data?.exercise_name ? String(data.exercise_name) : null,
      };
    }

    return out;
  } catch {
    return {};
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
    const strengthProfiles = await getStrengthProfiles(userEmail, startYMD, endYMD);
    
    const filteredCheckins = allCheckins.filter((c) => c.date >= startYMD && c.date <= endYMD);

    const filteredCompletions = allCompletions.filter((c) => {
      const iso = getCompletionISO(c);
      if (!iso) return false;
      const ymd = iso.slice(0, 10);
      return ymd >= startYMD && ymd <= endYMD;
    });

    const baselineCheckins = (() => {
      if (scope !== "program") return allCheckins;
      if (!currentProgram?.start_date) return allCheckins;

      const startLimit = currentProgram.start_date;
      const endLimit = currentProgram.end_date || "9999-12-31";

      return allCheckins.filter((c) => c.date >= startLimit && c.date <= endLimit);
    })();

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

    for (const key of Object.keys(strength) as LiftKey[]) {
      const profile = strengthProfiles[key];

      if (!profile) continue;

      strength[key].points = Array.isArray(profile.points) ? profile.points : [];
      strength[key].latest = profile.latest ?? null;
      strength[key].previous = profile.previous ?? null;
      strength[key].delta = profile.delta ?? null;

      if (profile.best_e1rm_kg != null) {
        strength[key].best_e1rm_kg = profile.best_e1rm_kg;
      }
      if ((profile as any).best_true_1rm_kg != null) {
        (strength[key] as any).best_true_1rm_kg = (profile as any).best_true_1rm_kg;
      }
      if (profile.training_max_kg != null) {
        strength[key].training_max_kg = profile.training_max_kg;
      }
      if (profile.exercise_name) {
        strength[key].exercise_name = profile.exercise_name;
      }
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
