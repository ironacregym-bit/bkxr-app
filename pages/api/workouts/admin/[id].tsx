
// pages/api/workouts/admin/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb as db } from "../../../../lib/firebaseAdmin";

type ApiError = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any | ApiError>
) {
  try {
    const id = (Array.isArray(req.query.id) ? req.query.id[0] : req.query.id) || "";
    const workout_id = String(id).trim();
    if (!workout_id) return res.status(400).json({ error: "id is required" });

    // Load workout document
    const workoutRef = db.collection("workouts").doc(workout_id);
    const doc = await workoutRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Workout not found" });

    const base = doc.data() as any;

    // Load rounds ordered by 'order'
    const roundsSnap = await workoutRef
      .collection("rounds")
      .orderBy("order", "asc")
      .get();

    const rounds = await Promise.all(
      roundsSnap.docs.map(async (rDoc) => {
        const rData = rDoc.data() as any;

        // Load items ordered by 'order'
        const itemsSnap = await workoutRef
          .collection("rounds")
          .doc(rDoc.id)
          .collection("items")
          .orderBy("order", "asc")
          .get();

        // --- NORMALISE ITEMS ---
        const items = itemsSnap.docs.map((iDoc) => {
          const d = iDoc.data() as any;
          const out: any = { item_id: iDoc.id, ...d };

          // Superset detection
          const isSuperset =
            (d.type && String(d.type).toLowerCase() === "superset") ||
            d.is_superset === true;

          if (isSuperset) {
            // If UI expects `items` but current data uses `superset_items`, map it
            if (!Array.isArray(out.items) && Array.isArray(d.superset_items)) {
              out.items = d.superset_items;
            }
            // Optional extra fallbacks if you have other legacy keys (uncomment as needed):
            // else if (!Array.isArray(out.items) && Array.isArray(d.collection)) {
            //   out.items = d.collection;
            // }

            // Ensure items is an array for consumer safety
            if (!Array.isArray(out.items)) out.items = [];
          }

          return out;
        });

        return {
          round_id: rDoc.id,
          ...rData,
          items,
        };
      })
    );

    // Normalise to { warmup, main, finisher } by name (case/space insensitive)
    const byName = (name: string) =>
      rounds.find(
        (r) =>
          (r.name || "").toLowerCase().replace(/\s+/g, "") ===
          name.toLowerCase().replace(/\s+/g, "")
      ) || null;

    const warmup = byName("Warm Up") || byName("Warmup");
    const main = byName("Main Set") || byName("Main") || rounds.find((r) => r.order === 2) || null;
    const finisher = byName("Finisher");

    return res.status(200).json({
      workout_id: doc.id,
      ...base,
      warmup,
      main,
      finisher,
      // keep raw rounds if admin wants to inspect
      _rounds: rounds,
    });
  } catch (err: any) {
    console.error("[workouts/admin/[id]] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load workout for admin" });
  }
}
