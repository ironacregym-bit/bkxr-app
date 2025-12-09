
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email, workout_id } = req.query;

  if (!email || !workout_id || typeof email !== "string" || typeof workout_id !== "string") {
    return res.status(400).json({ error: "Missing params" });
  }

  try {
    const docId = `${email}_${workout_id}`;
    const docRef = firestore.collection("workoutCompletions").doc(docId);
    const docSnap = await docRef.get();

    return res.status(200).json({
      completed: docSnap.exists,
      entry: docSnap.exists ? docSnap.data() : null,
    });
  } catch (err: any) {
    console.error("Completion check failed:", err?.message || err);
    return res.status(500).json({ error: "Failed to check completion" });
  }
}
