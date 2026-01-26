
// pages/api/workouts/admin/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb as db } from "../../../../lib/firebaseAdmin";

type ApiError = { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<any | ApiError>) {
  const { id } = req.query;
  const workout_id = (Array.isArray(id) ? id[0] : id)?.trim() || "";

  if (!workout_id) {
    return res.status(400).json({ error: "id is required" });
  }

  try {
    const workoutRef = db.collection("workouts").doc(workout_id);
    const doc = await workoutRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Workout not found" });

    const base = doc.data() as any;

    // Read rounds, ordered
    const roundsSnap = await workoutRef.collection("rounds").orderBy("order", "asc").get();

    // Map rounds with their items
    const rounds = await Promise.all(
      roundsSnap.docs.map(async (rDoc) => {
        const rData = rDoc.data() as any;
        const itemsSnap = await workoutRef
          .collection("rounds")
          .doc(rDoc.id)
          .collection("items")
          .orderBy("order", "asc")
          .get();

        const items = itemsSnap.docs.map((i) => ({
          item_id: i.id,
          ...i.data(),
        }));

        return {
          round_id: rDoc.id,
          ...rData,
          items,
        };
      })
    );

    // Normalize to { warmup, main, finisher }
    // If your names vary (e.g. "Warm Up" vs "Warmup"), normalise case/trim.
    const byName = (name: string) =>
      rounds.find(
        (r) => (r.name || "").toLowerCase().replace(/\s+/g, "") === name.toLowerCase().replace(/\s+/g, "")
      ) || null;

    const warmup = byName("Warm Up") || byName("Warmup");
    const main = byName("Main Set") || byName("Main");
    const finisher = byName("Finisher");

    // Fallback: if not named, assume order 1/2/3
    const mainByOrder = rounds.find((r) => r.order === 2) || null;

    return res.status(200).json({
      workout_id: doc.id,
      ...base,
      warmup,
      main: main || mainByOrder, // ensure main is present
      finisher,
      // include raw in case admin wants to inspect all rounds
      _rounds: rounds,
    });
  } catch (err: any) {
    console.error("[workouts/admin/[id]] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load workout for admin" });
  }
}
