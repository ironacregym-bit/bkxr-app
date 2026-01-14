
// pages/api/completions/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

/** Safely normalise any Firestore/Date-like value to ISO string */
function isoFromAny(v: any): string | null {
  try {
    const d =
      v?.toDate?.() instanceof Date
        ? v.toDate()
        : v
        ? new Date(v)
        : null;
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

  // ---- MODE A: Back-compat "did I complete this workout?" check (email + workout_id) ----
  // Only when from/to are NOT provided, we treat as point-check to preserve existing behaviour.
  if (email && workout_id && !from && !to) {
    try {
      const docId = `${email}_${workout_id}`;
      const docRef = firestore.collection("workoutCompletions").doc(docId);
      const docSnap = await docRef.get();

      return res.status(200).json({
        completed: docSnap.exists,
        entry: docSnap.exists ? docSnap.data() : null,
      });
    } catch (err: any) {
      console.error("[completions/index:point] error:", err?.message || err);
      return res.status(500).json({ error: "Failed to check completion" });
    }
  }

  // ---- MODE B: Range listing for a user (from/to [+ user_email]) ----
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
      .collection("workoutCompletions")
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
      const cursorDoc = await firestore.collection("workoutCompletions").doc(cursorId).get();
      if (cursorDoc.exists) {
        q = q.startAfter(cursorDoc);
      }
    }

    q = q.limit(limit);

    const snap = await q.get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // Normalise timestamps to ISO; keep key fields stable
    const results = docs.map((c) => {
      const completedIso =
        isoFromAny(c.completed_date) ||
        isoFromAny(c.started_at) ||
        isoFromAny(c.created_at);

      return {
        id: c.id,
        user_email: c.user_email || null,

        // quick-log fields (freestyle)
        is_freestyle: c.is_freestyle === true || String(c.is_freestyle).toLowerCase() === "true",
        activity_type: c.activity_type ?? null,
        duration_minutes: Number.isFinite(Number(c.duration_minutes)) ? Number(c.duration_minutes) : null,
        calories_burned: Number.isFinite(Number(c.calories_burned)) ? Number(c.calories_burned) : null,
        rpe: Number.isFinite(Number(c.rpe)) ? Number(c.rpe) : null,

        // compatibility fields
        is_benchmark: c.is_benchmark === true || String(c.is_benchmark).toLowerCase() === "true",
        benchmark_metrics: c.benchmark_metrics ?? null,
        workout_id: c.workout_id ?? null,
        sets_completed: Number.isFinite(Number(c.sets_completed)) ? Number(c.sets_completed) : null,
        weight_completed_with: Number.isFinite(Number(c.weight_completed_with)) ? Number(c.weight_completed_with) : null,

        completed_date: completedIso,          // ISO
        started_at: isoFromAny(c.started_at),  // ISO
        created_at: isoFromAny(c.created_at),  // ISO
        updated_at: isoFromAny(c.updated_at),  // ISO

        // passthrough (forward-compat)
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
