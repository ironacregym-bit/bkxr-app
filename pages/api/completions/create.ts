
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      workout_id,
      user_email,
      // Optional fields your client may send
      calories_burned,
      duration,
      rating,
      sets_completed,
      weight_completed_with,
      notes,
      // Optional time inputs (for back-compat); if absent, we use "now"
      completed_at, // ISO string or undefined
      started_at,   // ISO string or undefined (stored only if provided)
    } = req.body || {};

    if (!workout_id || !user_email) {
      return res.status(400).json({ error: "workout_id and user_email are required" });
    }

    const now = new Date();
    const completedDateTS = completed_at
      ? Timestamp.fromDate(new Date(completed_at))
      : Timestamp.fromDate(now);

    // Deterministic doc id for idempotency and for your /api/completions check
    const docId = `${String(user_email)}_${String(workout_id)}`;
    const docRef = firestore.collection("workoutCompletions").doc(docId);

    const snap = await docRef.get();
    const payload: any = {
      id: docId,                                  // ✅ matches your collection
      workout_id: String(workout_id),
      user_email: String(user_email),
      completed_date: completedDateTS,            // ✅ key your history/orderBy relies on
      calories_burned: Number(calories_burned ?? 0),
      duration: Number(duration ?? 0),
      rating: rating != null ? Number(rating) : null,
      sets_completed: Number(sets_completed ?? 0),
      weight_completed_with: Number(weight_completed_with ?? 0),
      notes: typeof notes === "string" ? notes : "",
      updated_at: Timestamp.fromDate(now),        // optional audit field
    };

    // Optional fields: keep only if provided
    if (started_at) payload.started_at = Timestamp.fromDate(new Date(started_at));

    // Create vs update
    if (!snap.exists) {
      payload.created_at = Timestamp.fromDate(now);
    }

    await docRef.set(payload, { merge: true });

    const saved = (await docRef.get()).data() || null;
    return res.status(200).json({ ok: true, entry: saved });
  } catch (err: any) {
    console.error("Failed to create completion:", err?.message || err);
    return res.status(500).json({ error: "Failed to create completion" });
  }
}
