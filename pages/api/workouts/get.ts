
// pages/api/workouts/get.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb as db } from "../../../lib/firebaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const workout_id = (req.query.workout_id as string) || (req.query.id as string) || "";
  if (!workout_id.trim()) {
    return res.status(400).json({ error: "workout_id is required" });
  }

  try {
    const workoutRef = db.collection("workouts").doc(workout_id.trim());
    const doc = await workoutRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Workout not found" });

    const base = doc.data() as any;

    // Collect rounds
    const roundsSnap = await workoutRef.collection("rounds").orderBy("order", "asc").get();
    const rounds = await Promise.all(
      roundsSnap.docs.map(async (rDoc) => {
        const rData = rDoc.data() as any;
        const itemsSnap = await workoutRef.collection("rounds").doc(rDoc.id).collection("items").orderBy("order", "asc").get();
        const items = itemsSnap.docs.map((i) => {
          const d = i.data() as any;
          return {
            item_id: i.id,
            ...d,
          };
        });

        return {
          round_id: rDoc.id,
          ...rData,
          items,
        };
      })
    );

    return res.status(200).json({
      workout_id: doc.id,
      ...base,
      rounds,
    });
  } catch (err: any) {
    console.error("[workouts/get] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load workout" });
  }
}
