import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { FieldPath } from "@google-cloud/firestore";
import firestore from "../../../lib/firestoreClient";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole } from "../../../lib/rbac";

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

type SimpleCheckin = {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  photo_url?: string | null;
};

type CompletionSeriesRow = {
  date: string;
  calories_burned: number;
};

type StrengthPoint = {
  date: string;
  value: number;
};

type StrengthCard = {
  key: string;
  title: string;
  latest: number | null;
  baseline: number | null;
  delta: number | null;
  points: StrengthPoint[];
  best_e1rm_kg?: number | null;
  best_true_1rm_kg?: number | null;
  training_max_kg?: number | null;
};

type Resp = {
  currentProgram: CurrentProgram;
  checkins: SimpleCheckin[];
  completionSeries: CompletionSeriesRow[];
  strengthCards: StrengthCard[];
  kpis: {
    totalCompletionsAllTime: number;
    totalCaloriesAllTime: number;
    currentStreak: number;
  };
  debug?: {
    userEmail: string;
    checkinsFound: number;
    completionsFound: number;
    strengthExercisesFound: number;
    liftDocsFound: number;
    strengthCardsBuilt: number;
  };
};

type StrengthExerciseMeta = {
  id: string;
  exercise_name: string;
  tracked: boolean;
};

const CHECKINS_COLLECTION = "check_ins";
const COMPLETIONS_COLLECTION = "workoutCompletions";
const PROGRAM_ASSIGNMENTS_COLLECTION = "program_assignments";
const PROGRAMS_COLLECTION = "programs";
const STRENGTH_PROFILES_COLLECTION = "strength_profiles";
const STRENGTH_EXERCISES_COLLECTION = "strength_exercises";

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

function safeNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalise(value: string) {
  return String(value || "").trim().toLowerCase();
}

function humaniseKey(value: string) {
  const withSpaces = String(value || "")
    .replace(/[|_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withSpaces
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function chooseBest1RM(row: any) {
  const true1rm = safeNum(row?.true_1rm_kg);
  const e1rm = safeNum(row?.e1rm_kg);
  return true1rm ?? e1rm ?? null;
}

async function getCurrentProgram(userEmail: string): Promise<CurrentProgram> {
  try {
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

        let programName = String(a.program_name || "Program");
        let weeks = Number(a.weeks || 0) || 0;

        try {
          const programDoc = await firestore.collection(PROGRAMS_COLLECTION).doc(programId).get();
          if (programDoc.exists) {
            const programData = programDoc.data() as any;
            programName = String(programData?.name || programName);
            weeks = Number(programData?.weeks || weeks || 0) || 0;
          }
        } catch {
          // Soft fail, use assignment values
        }

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
          program_name: programName,
          status: String(a.status || "active"),
          start_date: formatYMD(startOfDay(start)),
          end_date: computedEnd ? formatYMD(startOfDay(computedEnd)) : null,
          weeks,
          current_week: currentWeek,
          is_active_today: isActiveToday,
        } as CurrentProgram;
      })
    );

    return candidates.find((c) => c?.is_active_today) || candidates[0] || null;
  } catch {
    return null;
  }
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

async function getTrackedStrengthExercises(): Promise<StrengthExerciseMeta[]> {
  try {
    const snap = await firestore.collection(STRENGTH_EXERCISES_COLLECTION).get();

    return snap.docs
      .map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          exercise_name: String(data?.exercise_name || doc.id),
          tracked: data?.tracked !== false,
        };
      })
      .filter((x) => x.tracked);
  } catch {
    return [];
  }
}

async function getStrengthCards(
  userEmail: string
): Promise<{
  cards: StrengthCard[];
  trackedExercisesFound: number;
  liftDocsFound: number;
}> {
  let trackedExercises: StrengthExerciseMeta[] = [];
  try {
    trackedExercises = await getTrackedStrengthExercises();
  } catch {
    trackedExercises = [];
  }

  const trackedById = new Map(
    trackedExercises.map((x) => [normalise(x.id), x])
  );

  const trackedByName = new Map(
    trackedExercises.map((x) => [normalise(x.exercise_name), x])
  );

  let liftsSnap;
  try {
    liftsSnap = await firestore
      .collection(STRENGTH_PROFILES_COLLECTION)
      .doc(userEmail)
      .collection("lifts")
      .get();
  } catch {
    return {
      cards: [],
      trackedExercisesFound: trackedExercises.length,
      liftDocsFound: 0,
    };
  }

  const cards: StrengthCard[] = [];

  for (const doc of liftsSnap.docs) {
    const data = doc.data() as any;

    const enrichedExercise =
      trackedById.get(normalise(doc.id)) ||
      trackedByName.get(normalise(data?.exercise_name || ""));

    const title =
      enrichedExercise?.exercise_name ||
      (data?.exercise_name ? String(data.exercise_name) : humaniseKey(doc.id));

    let entryRows: any[] = [];
    try {
      const entriesSnap = await doc.ref.collection("entries").get();
      entryRows = entriesSnap.docs.map((d) => d.data() || {});
    } catch {
      entryRows = [];
    }

    const rawPoints = entryRows
      .map((row) => {
        const dateKey =
          typeof row?.date_key === "string" && row.date_key ? row.date_key : null;

        if (!dateKey) return null;

        const value = chooseBest1RM(row);
        if (value == null || value <= 0) return null;

        return {
          date: dateKey,
          value: Number(value.toFixed(1)),
        } as StrengthPoint;
      })
      .filter(Boolean) as StrengthPoint[];

    rawPoints.sort((a, b) => a.date.localeCompare(b.date));

    // First point = baseline, after that only keep PR increases
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

    const fallbackBest =
      safeNum(data?.best_true_1rm_kg) ??
      safeNum(data?.best_e1rm_kg) ??
      null;

    const baseline = prPoints.length ? prPoints[0].value : fallbackBest;
    const latest = prPoints.length ? prPoints[prPoints.length - 1].value : fallbackBest;
    const delta =
      baseline != null && latest != null
        ? Number((latest - baseline).toFixed(1))
        : null;

    cards.push({
      key: doc.id,
      title,
      latest,
      baseline,
      delta,
      points: prPoints,
      best_e1rm_kg: safeNum(data?.best_e1rm_kg),
      best_true_1rm_kg: safeNum(data?.best_true_1rm_kg),
      training_max_kg: safeNum(data?.training_max_kg),
    });
  }

  cards.sort((a, b) => a.title.localeCompare(b.title));

  return {
    cards,
    trackedExercisesFound: trackedExercises.length,
    liftDocsFound: liftsSnap.size,
  };
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

    const [currentProgram, allCheckins, allCompletions, strengthResult] = await Promise.all([
      getCurrentProgram(userEmail),
      getCheckins(userEmail),
      getCompletions(userEmail),
      getStrengthCards(userEmail),
    ]);

    const allDaySet = new Set<string>();
    let totalCaloriesAllTime = 0;

    const completionSeries: CompletionSeriesRow[] = allCompletions
      .map((c: any) => {
        const iso = getCompletionISO(c);
        if (!iso) return null;

        const date = iso.slice(0, 10);
        const calories_burned = Number(c.calories_burned || 0);

        allDaySet.add(date);
        totalCaloriesAllTime += calories_burned;

        return {
          date,
          calories_burned,
        };
      })
      .filter(Boolean) as CompletionSeriesRow[];

    completionSeries.sort((a, b) => a.date.localeCompare(b.date));

    let currentStreak = 0;
    const today = new Date();

    for (let i = 0; i < 3650; i++) {
      const d = addDays(today, -i);
      const ymd = formatYMD(d);
      if (allDaySet.has(ymd)) currentStreak++;
      else break;
    }

    const payload: Resp = {
      currentProgram,
      checkins: allCheckins,
      completionSeries,
      strengthCards: strengthResult.cards,
      kpis: {
        totalCompletionsAllTime: allCompletions.length,
        totalCaloriesAllTime,
        currentStreak,
      },
      debug: {
        userEmail,
        checkinsFound: allCheckins.length,
        filteredCheckinsFound: allCheckins.length,
        completionsFound: allCompletions.length,
        filteredCompletionsFound: allCompletions.length,
        strengthExercisesFound: strengthResult.trackedExercisesFound,
        liftDocsFound: strengthResult.liftDocsFound,
        strengthCardsBuilt: strengthResult.cards.length,
      },
    };

    res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error("[progress/overview] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to build progress overview" });
  }
}
