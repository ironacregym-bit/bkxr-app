import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

const COLLECTION = "workoutCompletions";

function toJSDate(v: any): Date | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    if (v?.seconds) return new Date(v.seconds * 1000);
    if (typeof v === "string") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

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

    // Base query (with/without workout filter)
    let base = firestore.collection(COLLECTION).where("user_email", "==", userEmail) as FirebaseFirestore.Query;
    if (workoutId) base = base.where("workout_id", "==", workoutId);

    let doc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    // --- Try newest by completed_date (preferred) ---
    try {
      const snap = await base.orderBy("completed_date", "desc").limit(1).get();
      if (!snap.empty) doc = snap.docs[0];
    } catch {
      // index missing or other error -> fall through
    }

    // --- Fallback: legacy date_completed ---
    if (!doc) {
      try {
        const snap2 = await base.orderBy("date_completed", "desc").limit(1).get();
        if (!snap2.empty) doc = snap2.docs[0];
      } catch {
        // still nothing; we'll do a no-index scan
      }
    }

    // --- Final fallback: limited scan (no orderBy) and pick latest in memory ---
    if (!doc) {
      const scanLimit = workoutId ? 25 : 50;
      const snap3 = await base.limit(scanLimit).get();
      if (!snap3.empty) {
        doc = snap3.docs
          .map((d) => ({ d, data: d.data() as any }))
          .map(({ d, data }) => {
            const ts =
              toJSDate(data.completed_date) ||
              toJSDate(data.date_completed) ||
              toJSDate(data.created_at) ||
              toJSDate(data.updated_at) ||
              null;
            return { d, when: ts ? ts.getTime() : 0 };
          })
          .sort((a, b) => b.when - a.when)[0]?.d;
      }
    }

    if (!doc) {
      return res.status(200).json({ ok: true, last: null });
    }

    const x = doc.data() as any;

    const last = {
      id: doc.id,
      workout_id: x.workout_id ?? (workoutId || null),
      workout_name: x.workout_name ?? null,

      // timestamps (keep both names for client compat)
      completed_date: x.completed_date ?? null,
      date_completed: x.date_completed ?? null,

      // shared summaries
      calories_burned: typeof x.calories_burned === "number" ? x.calories_burned : null,
      duration_minutes: typeof x.duration_minutes === "number" ? x.duration_minutes : null,
      duration: typeof x.duration === "number" ? x.duration : null, // legacy (BXKR path)
      rpe: typeof x.rpe === "number" ? x.rpe : null,
      rating: typeof x.rating === "number" ? x.rating : null, // legacy (BXKR)
      notes: typeof x.notes === "string" ? x.notes : null,

      weight_completed_with:
        typeof x.weight_completed_with === "number"
          ? x.weight_completed_with
          : typeof x.weight_completed_with === "string"
          ? x.weight_completed_with
          : null,

      // gym details
      activity_type: x.activity_type ? String(x.activity_type) : null,
      sets: Array.isArray(x.sets) ? x.sets : [],

      // BXKR details
      is_benchmark: x.is_benchmark === true,
      benchmark_metrics:
        x.benchmark_metrics && typeof x.benchmark_metrics === "object" ? x.benchmark_metrics : null,
      sets_completed: typeof x.sets_completed === "number" ? x.sets_completed : null,
    };

    return res.status(200).json({ ok: true, last });
  } catch (err: any) {
    console.error("[completions/last] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch last completion" });
  }
}
