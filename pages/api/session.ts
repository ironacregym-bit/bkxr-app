import { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../lib/firestoreClient"; // Google Cloud Firestore client

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const {
      email,
      workoutId,
      duration,
      calories,
      rating,
      setsCompleted,
      weightCompletedWith
    } = req.body;

    if (!email || !workoutId) {
      return res.status(400).json({ error: "Email and workoutId are required" });
    }

    // Composite ID for uniqueness: user_email + workout_id
    const id = `${email}_${workoutId}`;
    const completedDate = new Date(); // Firestore will store as timestamp

    // Add document to workoutCompletions collection
    await firestore.collection("workoutCompletions").doc(id).set({
      id: id,
      user_email: email,
      workout_id: workoutId,
      completed_date: completedDate,
      duration: Number(duration) || 0,
      calories_burned: Number(calories) || 0,
      rating: Number(rating) || 0,
      sets_completed: Number(setsCompleted) || 0,
      weight_completed_with: Number(weightCompletedWith) || 0
    });

    return res.json({ ok: true, id });
  } catch (err: any) {
    console.error("Firestore write failed:", err.message);
    return res.status(500).json({ error: "Failed to log workout completion" });
  }
}
