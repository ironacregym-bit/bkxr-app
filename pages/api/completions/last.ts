// pages/api/completions/last.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

/**
 * Behaviour:
 * - If ?workout_id=... provided: latest completion for that workout.
 * - If omitted: latest completion across all workouts.
 *
 * Response: { ok: true, last: null | {...} }
 * Fields include both gym + BXKR keys so the client can branch without extra calls.
 */

const COLLECTION = "workoutCompletions";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email || "";
    if (!email) return res.status(401).json({ error: "Not signed in" });

    const userEmail = email.toLowerCase();
    const workoutId = String(req.query.workout_id || "").trim();

    // Base query (with or without workout_id)
    let qry: FirebaseFirestore.Query = firestore
      .collection(COLLECTION)
      .where("user_email", "==", userEmail);

    if (workoutId) qry = qry.where("workout_id", "==", workoutId);

    // Prefer completed_date ordering
    let snap = await qry.orderBy("completed_date", "desc").limit(1).get().catch(() => null);
    let doc = snap && !snap.empty ? snap.docs[0] : undefined;

    // Fallback to legacy date_completed
    if (!doc) {
      let q2: FirebaseFirestore.Query = firestore
        .collection(COLLECTION)
        .where("user_email", "==", userEmail);
      if (workoutId) q2 = q2.where("workout_id", "==", workoutId);
      const snap2 = await q2.orderBy("date_completed", "desc").limit(1).get().catch(() => null);
      doc = snap2 && !snap2.empty ? snap2.docs[0] : undefined;
    }

    if (!doc) return res.status(200).json({ ok: true, last: null });

    const d = doc.data() as any;

    const last = {
      id: doc.id,
      workout_id: d.workout_id ?? (workoutId || null),
      workout_name: d.workout_name ?? null,

      // timestamps (keep both for compatibility)
      completed_date: d.completed_date ?? null,
      date_completed: d.date_completed ?? null,

      // common summaries
      calories_burned: typeof d.calories_burned === "number" ? d.calories_burned : null,
      duration_minutes: typeof d.duration_minutes === "number" ? d.duration_minutes : null,
      duration: typeof d.duration === "number" ? d.duration : null, // legacy (BXKR)
      rpe: typeof d.rpe === "number" ? d.rpe : null,
      rating: typeof d.rating === "number" ? d.rating : null, // legacy (BXKR)
      notes: typeof d.notes === "string" ? d.notes : null,

      // weight summary may be number or string
      weight_completed_with:
        typeof d.weight_completed_with === "number"
          ? d.weight_completed_with
          : typeof d.weight_completed_with === "string"
          ? d.weight_completed_with
          : null,

      // gym details
      activity_type: d.activity_type ? String(d.activity_type) : null,
      sets: Array.isArray(d.sets) ? d.sets : [],

      // BXKR details
      is_benchmark: d.is_benchmark === true,
      benchmark_metrics: d.benchmark_metrics && typeof d.benchmark_metrics === "object" ? d.benchmark_metrics : null,
      sets_completed: typeof d.sets_completed === "number" ? d.sets_completed : null,
    };

    return res.status(200).json({ ok: true, last });
  } catch (err: any) {
    console.error("[completions/last] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch last completion" });
  }
}
