import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient"; // Firestore client

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user_email, workout_id, completed_at, calories_burned, Rating, notes } = req.body;

  if (!user_email || !workout_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Composite ID for uniqueness
    const id = `${user_email}_${workout_id}`;
    const completedDate = completed_at ? new Date(completed_at) : new Date();

    await firestore.collection("workoutCompletions").doc(id).set({
      id: id,
      user_email: user_email,
      workout_id: workout_id,
      completed_date: completedDate,
      calories_burned: Number(calories_burned) || 0,
      rating: Number(Rating) || 0,
      notes: notes || ""
    });

    return res.status(200).json({ ok: true, id });
  } catch (err: any) {
    console.error("Completion logging failed:", err.message);
    return res.status(500).json({ error: "Failed to log completion" });
  }
}
