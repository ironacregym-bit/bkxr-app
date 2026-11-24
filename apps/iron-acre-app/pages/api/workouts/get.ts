import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb as db } from "../../../lib/firebaseAdmin";

/**
 * Workout fetch (public/internal)
 * - Loads workout doc + rounds + items
 * - Preserves Single.strength
 * - Preserves Superset.superset_items[].strength
 * - Normalises Superset items so consumers can rely on the structure
 * - Tolerates missing Firestore index by falling back when orderBy fails
 */

type ApiErr = { error: string };

function safeNumber(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const workout_id = (req.query.workout_id as string) || (req.query.id as string) || "";
  if (!workout_id.trim()) {
    return res.status(400).json({ error: "workout_id is required" });
  }

  try {
    const workoutRef = db.collection("workouts").doc(workout_id.trim());
    const doc = await workoutRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Workout not found" });

    const base = (doc.data() || {}) as any;

    // Collect rounds (ordered if possible, else fallback)
    let roundsSnap;
    try {
      roundsSnap = await workoutRef.collection("rounds").orderBy("order", "asc").get();
    } catch {
      roundsSnap = await workoutRef.collection("rounds").get();
    }

    const rounds = await Promise.all(
      roundsSnap.docs.map(async (rDoc) => {
        const rData = (rDoc.data() || {}) as any;

        // Collect items (ordered if possible, else fallback)
        let itemsSnap;
        try {
          itemsSnap = await workoutRef
            .collection("rounds")
            .doc(rDoc.id)
            .collection("items")
            .orderBy("order", "asc")
            .get();
        } catch {
          itemsSnap = await workoutRef.collection("rounds").doc(rDoc.id).collection("items").get();
        }

        const items = itemsSnap.docs
          .map((i) => {
            const d = (i.data() || {}) as any;

            // Preserve everything, but normalise Supersets so 'superset_items' always exists
            if (String(d.type || "").toLowerCase() === "superset") {
              const subs = Array.isArray(d.superset_items)
                ? d.superset_items
                : Array.isArray(d.items)
                ? d.items
                : [];

              const superset_items = subs.map((s: any) => ({
                exercise_id: String(s?.exercise_id || ""),
                reps: s?.reps ?? null,
                weight_kg: s?.weight_kg ?? null,
                // ✅ NEW: keep strength per sub item
                strength: s?.strength ?? null,
              }));

              return {
                item_id: i.id,
                ...d,
                superset_items,
              };
            }

            // For Single: strength already lives on the doc, ensure it is present (even if null)
            if (String(d.type || "").toLowerCase() === "single") {
              return {
                item_id: i.id,
                ...d,
                strength: d?.strength ?? null,
              };
            }

            // Unknown types pass-through
            return {
              item_id: i.id,
              ...d,
            };
          })
          .sort((a: any, b: any) => safeNumber(a?.order) - safeNumber(b?.order));

        return {
          round_id: rDoc.id,
          ...rData,
          items,
        };
      })
    );

    // Sort rounds in-memory too (in case orderBy fallback happened)
    rounds.sort((a: any, b: any) => safeNumber(a?.order) - safeNumber(b?.order));

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
