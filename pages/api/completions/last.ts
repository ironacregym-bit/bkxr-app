// pages/api/completions/last.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

/**
 * Behaviour:
 * - If ?workout_id=... is provided: returns the user's latest completion for that workout.
 * - If not provided: returns the user's latest completion across all workouts.
 * 
 * Response:
 *   { ok: true, last: null | {
 *       workout_id: string|null,
 *       workout_name?: string|null,
 *       completed_date?: any,        // Firestore TS or ISO string (compat with your clients)
 *       date_completed?: any,        // legacy
 *       calories_burned?: number|null,
 *       duration_minutes?: number|null,
 *       duration?: number|null,      // legacy
 *       rpe?: number|null,
 *       rating?: number|null,        // legacy benchmark
 *       notes?: string|null,
 *       weight_completed_with?: number|string|null,
 *       sets?: Array<{ exercise_id: string; set: number; weight: number|null; reps: number|null }>
 *   } }
 */

const COLLECTION = "workoutCompletions";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Auth
    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email || "";
    if (!email) return res.status(401).json({ error: "Not signed in" });

    const userEmail = email.toLowerCase();
    const workoutId = String(req.query.workout_id || "").trim();

    // First attempt: order by completed_date (new field)
    let qry = firestore.collection(COLLECTION).where("user_email", "==", userEmail) as FirebaseFirestore.Query;

    if (workoutId) {
      qry = qry.where("workout_id", "==", workoutId);
    }

    // Try with completed_date
    let snap = await qry.orderBy("completed_date", "desc").limit(1).get().catch(() => null);

    // Fallback 1: if no doc or completed_date missing, try legacy date_completed
    let doc = snap && !snap.empty ? snap.docs[0] : undefined;

    if (!doc) {
      let qry2 = firestore.collection(COLLECTION).where("user_email", "==", userEmail) as FirebaseFirestore.Query;
      if (workoutId) qry2 = qry2.where("workout_id", "==", workoutId);

      const snap2 = await qry2.orderBy("date_completed", "desc").limit(1).get().catch(() => null);
      doc = snap2 && !snap2.empty ? snap2.docs[0] : undefined;
    }

    if (!doc) {
      // No completion yet (this is not an error)
      return res.status(200).json({ ok: true, last: null });
    }

    const d = doc.data() as any;

    // Build payload with all fields the client may need
    const last = {
      workout_id: d.workout_id ?? (workoutId || null),
      workout_name: d.workout_name ?? null,

      // Keep both for compatibility: Firestore TS if present; client can handle converting to ISO
      completed_date: d.completed_date ?? null,
      date_completed: d.date_completed ?? null,

      calories_burned: typeof d.calories_burned === "number" ? d.calories_burned : null,
      duration_minutes: typeof d.duration_minutes === "number" ? d.duration_minutes : null,
      duration: typeof d.duration === "number" ? d.duration : null, // legacy (benchmark path)
      rpe: typeof d.rpe === "number" ? d.rpe : null,
      rating: typeof d.rating === "number" ? d.rating : null, // legacy (benchmark)
      notes: typeof d.notes === "string" ? d.notes : null,

      // Allow number or string (you store either depending on the flow)
      weight_completed_with:
        typeof d.weight_completed_with === "number"
          ? d.weight_completed_with
          : typeof d.weight_completed_with === "string"
          ? d.weight_completed_with
          : null,

      sets: Array.isArray(d.sets) ? d.sets : [],
    };

    return res.status(200).json({ ok: true, last });
  } catch (err: any) {
    // Minimal logging without PII
    console.error("[completions/last] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch last completion" });
  }
}
