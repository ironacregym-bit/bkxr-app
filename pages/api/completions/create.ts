
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient"; // Firestore client

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    user_email,
    workout_id,
    completed_at,
    calories_burned,
    rating,
    notes,
    sets_completed,
    weight_completed_with
  } = req.body;

  if (!user_email || !workout_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Composite ID for uniqueness
    const id = `${user_email}_${workout_id}`;
    const completedDate = completed_at ? new Date(completed_at) : new Date();

    await firestore.collection("workoutCompletions").doc(id).set({
      id,
      user_email,
      workout_id,
      completed_date: completedDate,
      calories_burned: Number(calories_burned) || 0,
      rating: Number(rating) || 0,
      notes: notes || "",
      sets_completed: Number(sets_completed) || 0,
      weight_completed_with: Number(weight_completed_with) || 0
    });

    return res.status(200).json({ ok: true, id });
  } catch (err: any) {
    console.error("Completion logging failed:", err.message);
    return res.status(500).json({ error: "Failed to log completion" });
  }
}
