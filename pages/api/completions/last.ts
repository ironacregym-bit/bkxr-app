
// pages/api/completions/last.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

const COLLECTION = "workoutCompletions";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Not signed in" });
    }

    const userEmail = (session.user.email || "").toLowerCase();
    const workout_id = String(req.query.workout_id || "").trim();

    if (!workout_id) {
      return res.status(400).json({ error: "Missing workout_id" });
    }

    // Try first: completed_date
    let snap = await firestore
      .collection(COLLECTION)
      .where("user_email", "==", userEmail)
      .where("workout_id", "==", workout_id)
      .orderBy("completed_date", "desc")
      .limit(1)
      .get();

    let doc = snap.docs[0];

    // Fallback: date_completed (legacy)
    if (!doc) {
      const snap2 = await firestore
        .collection(COLLECTION)
        .where("user_email", "==", userEmail)
        .where("workout_id", "==", workout_id)
        .orderBy("date_completed", "desc")
        .limit(1)
        .get();

      doc = snap2.docs[0];
    }

    if (!doc) return res.status(200).json({ ok: true, last: null });

    const d = doc.data();
    return res.status(200).json({
      ok: true,
      last: {
        sets: d.sets || [],
        completedAt:
          d.completed_date?.toDate?.()?.toISOString?.() ||
          d.date_completed?.toDate?.()?.toISOString?.() ||
          null,
      },
    });
  } catch (err: any) {
    console.error("[completions/last] error:", err);
    return res.status(500).json({ error: "Failed to fetch last completion" });
  }
}
