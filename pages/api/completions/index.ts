
// pages/api/completions/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

/** Safely normalise any Firestore/Date-like value to ISO string */
function isoFromAny(v: any): string | null {
  try {
    const d = v?.toDate?.() instanceof Date ? v.toDate() : v ? new Date(v) : null;
    if (!d || isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}
/** Clamp and parse number param */
function clampInt(n: any, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(v)));
}
/** Build start/end Date for Y-M-D */
function dayRange(dateYMD: string): { from: Date; to: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYMD)) return null;
  const d = new Date(`${dateYMD}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const from = new Date(d);
  const to = new Date(d);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

// Canonical collection name (do not change)
const COLLECTION = "workoutCompletions";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Query parameters
  const email = typeof req.query.email === "string" ? req.query.email : undefined;
  const workout_id = typeof req.query.workout_id === "string" ? req.query.workout_id : undefined;

  const from = (req.query.from as string | undefined)?.trim();
  const to = (req.query.to as string | undefined)?.trim();
  const user_email_param = (req.query.user_email as string | undefined)?.trim();

  const cursorId = (req.query.cursor as string | undefined)?.trim() || null;
  const limit = clampInt(req.query.limit, 1, 500, 200);

  const summary = (req.query.summary as string | undefined)?.toLowerCase();
  const dateYMD = (req.query.date as string | undefined)?.trim();
  const plannedId = (req.query.planned_workout_id as string | undefined)?.trim();

  // ---- MODE A: Point-check: "did I complete this workout?"
  // Only when from/to/summary are NOT provided.
  if (email && workout_id && !from && !to && !summary) {
    try {
      // Legacy composite id check
      const compositeId = `${email}_${workout_id}`;
      const legacyDoc = await firestore.collection(COLLECTION).doc(compositeId).get();

      if (legacyDoc.exists) {
        return res.status(200).json({
          completed: true,
          entry: { id: legacyDoc.id, ...(legacyDoc.data() as any) },
        });
      }

      // Fallback: query by fields (works with auto-IDs)
      const q = await firestore
        .collection(COLLECTION)
        .where("user_email", "==", email)
        .where("workout_id", "==", workout_id)
        .limit(1)
        .get();

      const hit = q.docs[0];
      return res.status(200).json({
        completed: !!hit,
        entry: hit ? { id: hit.id, ...(hit.data() as any) } : null,
      });
    } catch (err: any) {
      console.error("[completions/index:point] error:", err?.message || err);
      return res.status(500).json({ error: "Failed to check completion" });
    }
  }

  // ---- MODE C: Day summary (freestyle + planned) for Daily Tasks
  // /api/completions?summary=day&date=YYYY-MM-DD[&user_email=...][&planned_workout_id=...]
  if (summary === "day" && dateYMD) {
    try {
      const session = await getServerSession(req, res, authOptions);
      if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });
      const effectiveEmail = user_email_param || session.user.email;

      const range = dayRange(dateYMD);
      if (!range) return res.status(400).json({ error: "Invalid date" });

      // Query 1: completed_date in day
      const q1Snap = await firestore
        .collection(COLLECTION)
        .where("user_email", "==", effectiveEmail)
        .where("completed_date", ">=", range.from)
        .where("completed_date", "<=", range.to)
        .get();

      // Query 2: created_at in day (fallback for older docs that may not set completed_date)
      const q2Snap = await firestore
        .collection(COLLECTION)
        .where("user_email", "==", effectiveEmail)
        .where("created_at", ">=", range.from)
        .where("created_at", "<=", range.to)
        .get();

      // Merge unique docs by id
      const byId = new Map<string, FirebaseFirestore.DocumentData>();
      q1Snap.docs.forEach((d) => byId.set(d.id, d.data()));
      q2Snap.docs.forEach((d) => byId.set(d.id, d.data()));

      // Aggregate plan/freestyle
      let plannedWorkoutDone = false;

      // Track latest freestyle entry for the day (by completed_date, else created_at)
      let freestyleLatestTs = -Infinity;
      let freestyle:
        | {
            activity_type: string | null;
            duration: number | null;              // minutes
            calories_burned: number | null;       // kcal
            weight_completed_with: number | null; // kg or null
          }
        | null = null;

      for (const [, xAny] of byId) {
        const x = xAny as any;

        // Determine timestamp for "latest"
        const tCompleted =
          x.completed_date?.toDate?.() instanceof Date
            ? x.completed_date.toDate()
            : x.completed_date
            ? new Date(x.completed_date)
            : null;
        const tCreated =
          x.created_at?.toDate?.() instanceof Date
            ? x.created_at.toDate()
            : x.created_at
            ? new Date(x.created_at)
            : null;

        const ts =
          tCompleted && !isNaN(tCompleted.getTime())
            ? tCompleted.getTime()
            : tCreated && !isNaN(tCreated.getTime())
            ? tCreated.getTime()
            : -Infinity;

        // Planned workout done?
        if (plannedId && x.workout_id === plannedId) {
          plannedWorkoutDone = true;
        }

        // Freestyle capture (canonical names; duration fallback)
        const isFreestyle =
          x.is_freestyle === true || String(x.is_freestyle).toLowerCase() === "true";
        if (isFreestyle && ts > freestyleLatestTs) {
          freestyleLatestTs = ts;

          const act =
            typeof x.activity_type === "string" ? (x.activity_type as string) : null;
          // prefer new "duration" (minutes), fallback to legacy "duration_minutes"
          const dur = Number.isFinite(Number(x.duration))
            ? Number(x.duration)
            : Number.isFinite(Number(x.duration_minutes))
            ? Number(x.duration_minutes)
            : null;

          const cals = Number.isFinite(Number(x.calories_burned))
            ? Number(x.calories_burned)
            : null;

          const wt = Number.isFinite(Number(x.weight_completed_with))
            ? Number(x.weight_completed_with)
            : null;

          freestyle = {
            activity_type: act,
            duration: dur,
            calories_burned: cals,
            weight_completed_with: wt,
          };
        }
      }

      return res.status(200).json({
        date: dateYMD,
        user_email: effectiveEmail,
        planned: {
          workout_id: plannedId || null,
          done: plannedId ? plannedWorkoutDone : false,
        },
        // Freestyle summary uses canonical field names:
        // { activity_type, duration, calories_burned, weight_completed_with }
        freestyle: {
          logged: !!freestyle,
          summary: freestyle,
        },
      });
    } catch (err: any) {
      console.error("[completions/index:summary-day] error:", err?.message || err);
      return res.status(500).json({ error: "Failed to build day summary" });
    }
  }

  // ---- MODE B: Range listing for a user (from/to [+ user_email])
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const effectiveEmail = user_email_param || session.user.email;

    // Build inclusive date range
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (from) {
      const f = new Date(from);
      if (!isNaN(f.getTime())) {
        f.setHours(0, 0, 0, 0);
        fromDate = f;
      }
    }
    if (to) {
      const t = new Date(to);
      if (!isNaN(t.getTime())) {
        t.setHours(23, 59, 59, 999);
        toDate = t;
      }
    }

    // Base query: user + order by completed_date desc
    let q = firestore
      .collection(COLLECTION)
      .where("user_email", "==", effectiveEmail)
      .orderBy("completed_date", "desc") as FirebaseFirestore.Query;

    // Apply range constraints if present
    if (fromDate && toDate) {
      q = q.where("completed_date", ">=", fromDate).where("completed_date", "<=", toDate);
    } else if (fromDate) {
      q = q.where("completed_date", ">=", fromDate);
    } else if (toDate) {
      q = q.where("completed_date", "<=", toDate);
    }

    // Cursor pagination
    if (cursorId) {
      const cursorDoc = await firestore.collection(COLLECTION).doc(cursorId).get();
      if (cursorDoc.exists) q = q.startAfter(cursorDoc);
    }

    q = q.limit(limit);

    const snap = await q.get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // Normalise timestamps to ISO; keep key fields stable
    const results = docs.map((c) => {
      const completedIso =
        isoFromAny(c.completed_date) || isoFromAny(c.started_at) || isoFromAny(c.created_at);

      return {
        id: c.id,
        user_email: c.user_email || null,

        // Quick-log fields (regular + freestyle supported). Range mode
        // stays as before — it exposes duration_minutes, not duration.
        is_freestyle: c.is_freestyle === true || String(c.is_freestyle).toLowerCase() === "true",
        activity_type: c.activity_type ?? null,
        duration_minutes: Number.isFinite(Number(c.duration_minutes))
          ? Number(c.duration_minutes)
          : null,
        calories_burned: Number.isFinite(Number(c.calories_burned))
          ? Number(c.calories_burned)
          : null,
        rpe: Number.isFinite(Number(c.rpe)) ? Number(c.rpe) : null,

        // Compatibility fields
        is_benchmark: c.is_benchmark === true || String(c.is_benchmark).toLowerCase() === "true",
        benchmark_metrics: c.benchmark_metrics ?? null,
        workout_id: c.workout_id ?? null,
        sets_completed: Number.isFinite(Number(c.sets_completed)) ? Number(c.sets_completed) : null,
        weight_completed_with: Number.isFinite(Number(c.weight_completed_with))
          ? Number(c.weight_completed_with)
          : null,

        completed_date: completedIso, // ISO
        started_at: isoFromAny(c.started_at), // ISO
        created_at: isoFromAny(c.created_at), // ISO
        updated_at: isoFromAny(c.updated_at), // ISO

        // Passthrough (forward-compat)
        ...c,
      };
    });

    const lastDoc = snap.docs[snap.docs.length - 1];
    const nextCursor = lastDoc ? lastDoc.id : null;

    return res.status(200).json({ results, nextCursor });
  } catch (err: any) {
    console.error("[completions/index:range] error:", err?.message || err);
    // If Firestore suggests a composite index for (user_email + completed_date), create it in Firebase console.
    return res.status(500).json({ error: "Failed to fetch completions" });
  }
}
