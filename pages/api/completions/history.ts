import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient"; // Firestore client

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email } = req.query;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    // Query workoutCompletions for this user
    const completionsSnap = await firestore
      .collection("workoutCompletions")
      .where("user_email", "==", email)
      .orderBy("completed_date", "desc")
      .get();

    if (completionsSnap.empty) {
      return res.status(200).json({ history: [] });
    }

    const history = completionsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        workout_id: data.workout_id,
        completed_at: data.completed_date.toDate().toISOString(),
        calories_burned: data.calories_burned,
        rating: data.rating || null,
        sets_completed: data.sets_completed || null,
        weight_completed_with: data.weight_completed_with || null,
        notes: data.notes || ""
      };
    });

    return res.status(200).json({ history });
  } catch (err: any) {
    console.error("Failed to fetch completion history:", err.message);
    return res.status(500).json({ error: "Failed to fetch completion history" });
  }
}
